/**
 * A word-level Markov chain, trained in the browser on Kishore's own prose.
 *
 * This is deliberately NOT a neural network — it is an n-gram frequency model,
 * and the demo says so. The point is that the statistics are his: the model has
 * never seen any text but his 32 articles, so what it emits is his vocabulary,
 * his cadence and his obsessions, recombined.
 */

export type MarkovModel = {
  order: number;
  /** context -> [nextWord, cumulativeWeight][] for O(log n) sampling */
  table: Map<string, { words: string[]; cumulative: Float64Array; total: number }>;
  starts: string[];
  tokenCount: number;
  contextCount: number;
  trainMs: number;
};

const SENTENCE_END = /[.!?]$/;

function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

export function train(text: string, order = 2): MarkovModel {
  const t0 = performance.now();
  const tokens = tokenize(text);

  // Build raw counts first, then convert to cumulative arrays for fast sampling.
  const counts = new Map<string, Map<string, number>>();
  const starts: string[] = [];

  for (let i = 0; i + order < tokens.length; i++) {
    const context = tokens.slice(i, i + order).join(" ").toLowerCase();
    const next = tokens[i + order];

    let bucket = counts.get(context);
    if (!bucket) {
      bucket = new Map();
      counts.set(context, bucket);
    }
    bucket.set(next, (bucket.get(next) ?? 0) + 1);

    // A context that follows a sentence end, and starts with a capital, is a
    // plausible opening.
    if (i > 0 && SENTENCE_END.test(tokens[i - 1]) && /^[A-Z]/.test(tokens[i])) {
      starts.push(context);
    }
  }

  const table: MarkovModel["table"] = new Map();
  for (const [context, bucket] of counts) {
    const words: string[] = [];
    const cumulative = new Float64Array(bucket.size);
    let running = 0;
    let idx = 0;
    for (const [word, count] of bucket) {
      running += count;
      words.push(word);
      cumulative[idx++] = running;
    }
    table.set(context, { words, cumulative, total: running });
  }

  return {
    order,
    table,
    starts: starts.length ? starts : [...table.keys()].slice(0, 200),
    tokenCount: tokens.length,
    contextCount: table.size,
    trainMs: performance.now() - t0,
  };
}

function sample(
  entry: { words: string[]; cumulative: Float64Array; total: number },
  temperature: number,
  rand: () => number
): string {
  // temperature 1 = true corpus frequencies. Lower biases toward the most
  // common continuation; higher flattens toward uniform.
  if (Math.abs(temperature - 1) < 0.02) {
    const r = rand() * entry.total;
    let lo = 0;
    let hi = entry.cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (entry.cumulative[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    return entry.words[lo];
  }

  // Re-weight p^(1/T) and renormalise.
  const inv = 1 / Math.max(0.05, temperature);
  const weights: number[] = [];
  let prev = 0;
  let sum = 0;
  for (let i = 0; i < entry.words.length; i++) {
    const raw = entry.cumulative[i] - prev;
    prev = entry.cumulative[i];
    const w = Math.pow(raw / entry.total, inv);
    weights.push(w);
    sum += w;
  }
  let r = rand() * sum;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return entry.words[i];
  }
  return entry.words[entry.words.length - 1];
}

export type GenerateOptions = {
  words?: number;
  temperature?: number;
  seed?: string;
  rand?: () => number;
};

export function generate(model: MarkovModel, opts: GenerateOptions = {}): string {
  const { words = 60, temperature = 1, rand = Math.random } = opts;

  let context =
    (opts.seed && findContext(model, opts.seed)) ||
    model.starts[Math.floor(rand() * model.starts.length)];

  const out: string[] = context.split(" ");

  for (let i = 0; i < words; i++) {
    const entry = model.table.get(context.toLowerCase());
    if (!entry) break;

    const next = sample(entry, temperature, rand);
    out.push(next);

    // Stop on a sentence boundary once we are near the target length.
    if (i > words * 0.6 && SENTENCE_END.test(next)) break;

    const parts = context.split(" ");
    parts.shift();
    parts.push(next);
    context = parts.join(" ");
  }

  const text = out.join(" ").replace(/\s+([,.;:!?])/g, "$1").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Find a context containing the seed word, so "entropy" starts an entropy thought. */
function findContext(model: MarkovModel, seed: string): string | null {
  const needle = seed.trim().toLowerCase();
  if (!needle) return null;

  const matches: string[] = [];
  for (const key of model.table.keys()) {
    if (key.includes(needle)) {
      matches.push(key);
      if (matches.length > 400) break;
    }
  }
  if (!matches.length) return null;
  return matches[Math.floor(Math.random() * matches.length)];
}
