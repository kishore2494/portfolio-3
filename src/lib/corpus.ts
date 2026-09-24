import raw from "../generated/corpus.json";

export type ArticleMeta = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  tags: string[];
  categories: string[];
  words: number;
};

type RawCorpus = {
  builtAt: string;
  articleCount: number;
  wordCount: number;
  meta: ArticleMeta[];
  text: string;
  vocab: string[];
  dims: number;
  vectors: string; // base64 int8
};

const data = raw as RawCorpus;

/** Decode the base64 int8 block into L2-normalised float vectors, once. */
function decodeVectors(): Float32Array {
  const bin = atob(data.vectors);
  const bytes = new Int8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = (bin.charCodeAt(i) << 24) >> 24;

  const { dims } = data;
  const count = bytes.length / dims;
  const out = new Float32Array(bytes.length);

  for (let i = 0; i < count; i++) {
    const off = i * dims;
    let norm = 0;
    for (let d = 0; d < dims; d++) {
      const v = bytes[off + d] / 127;
      out[off + d] = v;
      norm += v * v;
    }
    norm = Math.sqrt(norm) || 1;
    for (let d = 0; d < dims; d++) out[off + d] /= norm;
  }
  return out;
}

let vectorCache: Float32Array | null = null;

export const corpus = {
  builtAt: data.builtAt,
  articleCount: data.articleCount,
  wordCount: data.wordCount,
  meta: data.meta,
  text: data.text,
  vocab: data.vocab,
  dims: data.dims,

  get vectors(): Float32Array {
    if (!vectorCache) vectorCache = decodeVectors();
    return vectorCache;
  },
};

const indexByWord = new Map(data.vocab.map((w, i) => [w, i]));

export function vectorFor(word: string): Float32Array | null {
  const i = indexByWord.get(word.toLowerCase());
  if (i === undefined) return null;
  const { dims } = data;
  return corpus.vectors.subarray(i * dims, (i + 1) * dims);
}

export function hasWord(word: string): boolean {
  return indexByWord.has(word.toLowerCase());
}

export function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** Nearest neighbours by cosine similarity (vectors are pre-normalised). */
export function nearest(word: string, k = 6): { word: string; score: number }[] {
  const v = vectorFor(word);
  if (!v) return [];
  const { dims, vocab } = data;
  const all = corpus.vectors;
  const out: { word: string; score: number }[] = [];

  for (let i = 0; i < vocab.length; i++) {
    if (vocab[i] === word.toLowerCase()) continue;
    let s = 0;
    const off = i * dims;
    for (let d = 0; d < dims; d++) s += v[d] * all[off + d];
    out.push({ word: vocab[i], score: s });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, k);
}
