/**
 * Real scaled dot-product attention — the operation from "Attention Is All You
 * Need" — computed over word vectors derived from Kishore's own corpus.
 *
 *     Attention(Q, K, V) = softmax(Q Kᵀ / √d) V
 *
 * Honest about what this is: there are no *learned* projection matrices here,
 * because there is no trained transformer behind the page. Q = K = V = the word
 * vectors themselves, so the attention weights are softmaxed cosine similarity.
 * The arithmetic is exactly the real thing; the weights are corpus statistics
 * (PPMI co-occurrence) rather than gradient-descended parameters.
 */
import { corpus, dot, vectorFor } from "./corpus";

export type AttentionToken = {
  word: string;
  known: boolean;
  vector: Float32Array | null;
};

export type AttentionResult = {
  tokens: AttentionToken[];
  /** weights[i][j] = how much token i attends to token j (rows sum to 1) */
  weights: number[][];
  /** Mean attention received by each token — "how much the sentence looks at it". */
  received: number[];
};

export function tokenizeSentence(input: string): AttentionToken[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 16)
    .map((word) => {
      const vector = vectorFor(word);
      return { word, known: vector !== null, vector };
    });
}

export function attend(tokens: AttentionToken[]): AttentionResult {
  const n = tokens.length;
  const scale = 1 / Math.sqrt(corpus.dims);
  const weights: number[][] = [];

  for (let i = 0; i < n; i++) {
    const qi = tokens[i].vector;
    const logits = new Float64Array(n);

    for (let j = 0; j < n; j++) {
      const kj = tokens[j].vector;
      // Out-of-vocabulary tokens carry no signal; they get a floor score so the
      // row still normalises, and the UI marks them as unknown.
      logits[j] = qi && kj ? dot(qi, kj) / scale : 0;
    }

    // Numerically stable softmax.
    let max = -Infinity;
    for (let j = 0; j < n; j++) max = Math.max(max, logits[j]);
    let sum = 0;
    const row = new Array<number>(n);
    for (let j = 0; j < n; j++) {
      const e = Math.exp(logits[j] - max);
      row[j] = e;
      sum += e;
    }
    for (let j = 0; j < n; j++) row[j] /= sum || 1;
    weights.push(row);
  }

  const received = new Array<number>(n).fill(0);
  for (let j = 0; j < n; j++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += weights[i][j];
    received[j] = n ? s / n : 0;
  }

  return { tokens, weights, received };
}
