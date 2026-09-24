/**
 * Target-position generators for the particle field.
 *
 * Every chapter is just a different set of destinations for the SAME particles.
 * Each generator fills an RGBA32F buffer laid out as a GRID×GRID texture:
 *
 *   r, g  -> target position in NDC-ish space, roughly [-1, 1]
 *   b     -> brightness 0..1
 *   a     -> hue mix 0..1 (0 = signal cyan, 1 = ember orange)
 */

export const GRID = 256;
export const COUNT = GRID * GRID;

export type TargetBuffer = Float32Array; // COUNT * 4

function empty(): TargetBuffer {
  return new Float32Array(COUNT * 4);
}

/** Deterministic per-particle randomness, so layouts are stable across rebuilds. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Chapter II — the spacetime block. Rule 110, evaluated once; particles land on
 * the live cells, so the whole history is visible at once.
 */
export function spacetimeTargets(cols = 220, rows = 150): TargetBuffer {
  const cells = new Uint8Array(cols * rows);
  cells[Math.floor(cols * 0.62)] = 1;
  for (let t = 1; t < rows; t++) {
    const prev = (t - 1) * cols;
    const cur = t * cols;
    for (let x = 0; x < cols; x++) {
      const l = cells[prev + ((x - 1 + cols) % cols)];
      const c = cells[prev + x];
      const r = cells[prev + ((x + 1) % cols)];
      cells[cur + x] = (110 >> ((l << 2) | (c << 1) | r)) & 1;
    }
  }

  const live: number[] = [];
  for (let i = 0; i < cells.length; i++) if (cells[i]) live.push(i);

  const buf = empty();
  const rand = rng(11);
  for (let i = 0; i < COUNT; i++) {
    const cell = live[i % live.length];
    const x = cell % cols;
    const y = (cell / cols) | 0;
    const o = i * 4;
    buf[o] = (x / cols) * 2 - 1 + (rand() - 0.5) * 0.004;
    buf[o + 1] = 1 - (y / rows) * 2 + (rand() - 0.5) * 0.004;
    buf[o + 2] = 0.55 + rand() * 0.45;
    // Past (upper rows) cool, future (lower) warm — the block already drawn.
    buf[o + 3] = y / rows;
  }
  return buf;
}

/**
 * Chapter III — the attention graph. Word nodes on a ring; particles ride the
 * edges, and edge population is proportional to the real attention weight.
 */
export function attentionTargets(
  words: string[],
  weights: number[][]
): { buffer: TargetBuffer; nodes: { x: number; y: number; word: string }[] } {
  const n = Math.max(2, words.length);
  // Ring is pushed right so the chapter copy on the left stays readable.
  const CX = 0.58;
  const R = 0.40;
  const nodes = words.map((word, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: CX + Math.cos(a) * R, y: Math.sin(a) * R, word };
  });

  // Flatten (i, j, weight) and allocate particles proportionally.
  const edges: { i: number; j: number; w: number }[] = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const w = weights[i]?.[j] ?? 0;
      if (w <= 0.012) continue;
      edges.push({ i, j, w });
      total += w;
    }
  }

  const buf = empty();
  const rand = rng(29);
  let p = 0;

  for (const e of edges) {
    const share = Math.floor((e.w / (total || 1)) * COUNT * 0.86);
    const a = nodes[e.i];
    const b = nodes[e.j];
    for (let k = 0; k < share && p < COUNT; k++, p++) {
      const t = rand();
      // Bow the edge toward the centre so the ring reads as a graph, not a mesh.
      const bow = Math.sin(t * Math.PI) * 0.26;
      const o = p * 4;
      buf[o] = a.x + (b.x - a.x) * t - (a.x + b.x) * 0.5 * bow;
      buf[o + 1] = a.y + (b.y - a.y) * t - (a.y + b.y) * 0.5 * bow;
      buf[o + 2] = 0.35 + e.w * 2.2;
      buf[o + 3] = 0.1;
    }
  }

  // Remaining particles cluster tightly on the nodes themselves.
  for (; p < COUNT; p++) {
    const node = nodes[p % n];
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 0.055;
    const o = p * 4;
    buf[o] = node.x + Math.cos(a) * r;
    buf[o + 1] = node.y + Math.sin(a) * r;
    buf[o + 2] = 1;
    buf[o + 3] = 0.85;
  }

  return { buffer: buf, nodes };
}

/**
 * Chapter IV — the particles become the sentence the model just wrote.
 * Text is rasterised offscreen, then every opaque pixel claims particles.
 */
export function textTargets(text: string, width = 1240): TargetBuffer {
  const lineHeight = 74;
  const fontSize = 52;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const buf = empty();
  if (!ctx) return buf;

  // Wrap to a fixed column.
  canvas.width = width;
  ctx.font = `600 ${fontSize}px "Space Grotesk", system-ui, sans-serif`;
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > width - 150 && line) {
      lines.push(line);
      line = w;
      if (lines.length >= 5) break;
    } else {
      line = next;
    }
  }
  if (line && lines.length < 5) lines.push(line);

  const height = Math.max(lineHeight, lines.length * lineHeight);
  canvas.height = height;

  // Re-set after resize (resizing clears state).
  ctx.font = `600 ${fontSize}px "Space Grotesk", system-ui, sans-serif`;
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "top";
  lines.forEach((l, i) => ctx.fillText(l, 40, i * lineHeight + 8));

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const hits: number[] = [];
  // Step 2px: enough density for legibility without oversampling.
  for (let y = 0; y < canvas.height; y += 2) {
    for (let x = 0; x < canvas.width; x += 2) {
      if (img[(y * canvas.width + x) * 4 + 3] > 128) hits.push(y * canvas.width + x);
    }
  }
  if (!hits.length) return buf;

  const aspect = canvas.height / canvas.width;
  const rand = rng(53);
  for (let i = 0; i < COUNT; i++) {
    const hit = hits[i % hits.length];
    const x = hit % canvas.width;
    const y = (hit / canvas.width) | 0;
    const o = i * 4;
    buf[o] = (x / canvas.width) * 1.7 - 0.85 + (rand() - 0.5) * 0.004;
    // Biased upward: the chapter copy lives along the bottom of the viewport.
    buf[o + 1] = (0.5 - y / canvas.height) * 1.7 * aspect * 1.9 + 0.34 + (rand() - 0.5) * 0.004;
    buf[o + 2] = 0.8 + rand() * 0.2;
    buf[o + 3] = 0.06;
  }
  return buf;
}

/**
 * Chapter V — the agent's world. Walls take most of the particles; the rest
 * form a bright swarm at the agent, so it reads as a body moving through terrain.
 */
export function mazeTargets(
  maze: Uint8Array,
  cols: number,
  rows: number,
  agent: { x: number; y: number },
  goal: { x: number; y: number }
): TargetBuffer {
  const walls: number[] = [];
  for (let i = 0; i < maze.length; i++) if (maze[i] === 1) walls.push(i);

  const buf = empty();
  const rand = rng(83);
  const toX = (cx: number) => ((cx + 0.5) / cols) * 1.85 - 0.925;
  // Terrain sits in the upper band; the chapter copy runs along the bottom.
  const toY = (cy: number) => (0.5 - (cy + 0.5) / rows) * 0.92 + 0.40;

  const agentShare = Math.floor(COUNT * 0.1);
  const goalShare = Math.floor(COUNT * 0.04);
  const wallShare = COUNT - agentShare - goalShare;

  for (let i = 0; i < wallShare; i++) {
    const cell = walls[i % Math.max(1, walls.length)];
    const cx = cell % cols;
    const cy = (cell / cols) | 0;
    const o = i * 4;
    buf[o] = toX(cx) + (rand() - 0.5) * (1.85 / cols) * 0.9;
    buf[o + 1] = toY(cy) + (rand() - 0.5) * (1.15 / rows) * 0.9;
    buf[o + 2] = 0.3 + rand() * 0.2;
    buf[o + 3] = 0.72;
  }

  for (let i = 0; i < agentShare; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 0.035;
    const o = (wallShare + i) * 4;
    buf[o] = toX(agent.x) + Math.cos(a) * r;
    buf[o + 1] = toY(agent.y) + Math.sin(a) * r;
    buf[o + 2] = 1;
    buf[o + 3] = 0;
  }

  for (let i = 0; i < goalShare; i++) {
    const a = rand() * Math.PI * 2;
    const r = 0.03 + rand() * 0.012;
    const o = (wallShare + agentShare + i) * 4;
    buf[o] = toX(goal.x) + Math.cos(a) * r;
    buf[o + 1] = toY(goal.y) + Math.sin(a) * r;
    buf[o + 2] = 0.9;
    buf[o + 3] = 1;
  }

  return buf;
}
