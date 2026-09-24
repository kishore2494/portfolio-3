/**
 * Builds the data the demos actually compute on, from Kishore's own articles.
 *
 * Outputs src/generated/corpus.json:
 *   - meta      : article titles/slugs/tags (for the closing index + chapter cites)
 *   - text      : cleaned prose, used to train the Markov model in the browser
 *   - vocab     : top-N words by frequency
 *   - vectors   : int8-quantised semantic vectors for those words
 *
 * The vectors are real, not decorative: a PPMI co-occurrence matrix over the
 * corpus, randomly projected to DIMS. Random projection preserves cosine
 * similarity (Johnson-Lindenstrauss), so nearest-neighbours and the attention
 * demo reflect genuine statistical structure in his writing.
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "src/generated");

// Articles live in the sibling repo; fall back to a vendored copy when absent
// (CI checks out only this repo, so the vendored copy is what ships).
const SOURCES = [
  path.resolve(ROOT, "../personal-site-2/src/content/articles"),
  path.join(ROOT, "content/articles"),
];

const VOCAB_SIZE = 900;
const DIMS = 64;
const WINDOW = 10;
const MIN_COUNT = 4;

const STOP = new Set(
  `the a an and or but if then than that this these those of to in on at for with from by as is are was were be been being it its it's i you he she they we them his her their our your my me not no so do does did have has had can could will would should may might must about into over under more most some any each other only just also very much many few own same too s t don now what which who whom when where why how all both nor own re ve ll d m o y ain aren couldn didn doesn hadn hasn haven isn ma mightn mustn needn shan shouldn wasn weren won wouldn`
    .split(/\s+/)
    .filter(Boolean)
);

function readArticles() {
  const dir = SOURCES.find((d) => fs.existsSync(d));
  if (!dir) {
    throw new Error(
      `No article source found. Looked in:\n  ${SOURCES.join("\n  ")}\n` +
        `Run scripts/vendor-content.mjs while personal-site-2 is available.`
    );
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  if (!files.length) throw new Error(`No .md files in ${dir}`);

  return files.map((f) => {
    const raw = fs.readFileSync(path.join(dir, f), "utf8");
    const { data, content } = matter(raw);
    return {
      slug: f.replace(/\.md$/, ""),
      title: String(data.title ?? f),
      excerpt: String(data.excerpt ?? "").trim(),
      date: data.date ? new Date(data.date).toISOString().slice(0, 10) : "",
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      categories: Array.isArray(data.categories) ? data.categories.map(String) : [],
      body: content,
    };
  });
}

/** Strip markdown to readable prose so the Markov model learns sentences, not syntax. */
function cleanProse(md) {
  return md
    .replace(/```[\s\S]*?```/g, " ")          // fenced code
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/`[^`\n]*`/g, " ")               // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")    // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")  // links -> text
    // Delete heading LINES outright. Previously only the "#" was stripped, which
    // left titles and tables of contents in the prose — the Markov model then
    // happily generated things like "II. Core Technical Drivers: Compute".
    .replace(/^\s{0,3}#{1,6}[^\n]*$/gm, "\n")
    .replace(/^[^\n]*\|[^\n]*\|[^\n]*$/gm, " ")   // table rows
    .replace(/^\s*[IVXLC]+\.\s+[^\n]*$/gm, " ")   // roman-numeral section headers
    .replace(/^\s{0,3}>\s?/gm, "")            // quotes
    .replace(/^\s{0,3}[-*+]\s+/gm, "")        // bullets
    .replace(/^\s{0,3}\d+\.\s+/gm, "")        // ordered lists
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[*_~]{1,3}/g, "")               // emphasis
    .replace(/<[^>]+>/g, " ")                 // stray html
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Sentence-preserving tokens (keeps . ! ?) — used for word counts only. */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s.!?]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Bare word tokens — punctuation stripped, so "entropy." and "entropy" agree. */
function wordTokens(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ""))
    .filter((w) => w.length > 0);
}

/** Deterministic PRNG so builds are reproducible. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildVectors(tokens) {
  // --- frequencies -> vocabulary -------------------------------------------
  const freq = new Map();
  for (const w of tokens) {
    if (w.length < 2 || STOP.has(w) || /^[\d'.]+$/.test(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  const vocab = [...freq.entries()]
    .filter(([, c]) => c >= MIN_COUNT)
    .sort((a, b) => b[1] - a[1])
    .slice(0, VOCAB_SIZE)
    .map(([w]) => w);

  const index = new Map(vocab.map((w, i) => [w, i]));
  const V = vocab.length;

  // --- co-occurrence counts -------------------------------------------------
  const co = new Map(); // "i,j" -> count
  const rowSum = new Float64Array(V);
  let total = 0;

  const ids = tokens.map((w) => index.get(w) ?? -1);
  for (let p = 0; p < ids.length; p++) {
    const i = ids[p];
    if (i < 0) continue;
    const lo = Math.max(0, p - WINDOW);
    const hi = Math.min(ids.length - 1, p + WINDOW);
    for (let q = lo; q <= hi; q++) {
      if (q === p) continue;
      const j = ids[q];
      if (j < 0) continue;
      // Closer words carry more signal than distant ones.
      const w = 1 / Math.abs(p - q);
      const key = i * V + j;
      co.set(key, (co.get(key) ?? 0) + w);
      rowSum[i] += w;
      total += w;
    }
  }

  // --- PPMI, projected to DIMS ---------------------------------------------
  const rand = mulberry32(20260924);
  // Random projection matrix, entries +-1/sqrt(DIMS) (Achlioptas-style).
  const proj = new Float32Array(V * DIMS);
  for (let i = 0; i < proj.length; i++) proj[i] = rand() < 0.5 ? -1 : 1;

  const vecs = new Float32Array(V * DIMS);
  for (const [key, c] of co) {
    const i = Math.floor(key / V);
    const j = key % V;
    // PPMI = max(0, log( p(i,j) / (p(i)p(j)) ))
    const pmi = Math.log((c * total) / (rowSum[i] * rowSum[j] || 1));
    if (pmi <= 0) continue;
    const base = j * DIMS;
    const out = i * DIMS;
    for (let d = 0; d < DIMS; d++) vecs[out + d] += pmi * proj[base + d];
  }

  // L2-normalise, then quantise to int8 for a small payload.
  const q = new Int8Array(V * DIMS);
  for (let i = 0; i < V; i++) {
    const off = i * DIMS;
    let norm = 0;
    for (let d = 0; d < DIMS; d++) norm += vecs[off + d] ** 2;
    norm = Math.sqrt(norm) || 1;
    for (let d = 0; d < DIMS; d++) {
      const v = vecs[off + d] / norm; // in [-1, 1]
      q[off + d] = Math.max(-127, Math.min(127, Math.round(v * 127)));
    }
  }

  return { vocab, dims: DIMS, quantized: Buffer.from(q.buffer).toString("base64") };
}

// ---------------------------------------------------------------------------

const articles = readArticles();
const prose = articles.map((a) => cleanProse(a.body));
const allText = prose.join("\n\n");
const tokens = tokenize(allText);
const words = wordTokens(allText);

const { vocab, dims, quantized } = buildVectors(words);

const meta = articles
  .map((a, i) => ({
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    date: a.date,
    tags: a.tags,
    categories: a.categories,
    words: prose[i].split(/\s+/).filter(Boolean).length,
  }))
  .sort((a, b) => (a.date < b.date ? 1 : -1));

const payload = {
  builtAt: new Date().toISOString(),
  articleCount: articles.length,
  wordCount: tokens.length,
  meta,
  // Prose is what the in-browser Markov model trains on. Keep sentence
  // punctuation so generated text can terminate naturally.
  text: allText.replace(/\s+/g, " ").trim(),
  vocab,
  dims,
  vectors: quantized,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "corpus.json"), JSON.stringify(payload));

const kb = (n) => `${(n / 1024).toFixed(0)} kB`;
console.log(
  `corpus: ${articles.length} articles · ${tokens.length.toLocaleString()} tokens · ` +
    `vocab ${vocab.length} × ${dims}d · ${kb(JSON.stringify(payload).length)} raw`
);
