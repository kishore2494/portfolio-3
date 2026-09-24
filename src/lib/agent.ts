/**
 * The agent's world, separated from any rendering so the particle field and the
 * readout can share one source of truth.
 *
 * No language model is involved: this is breadth-first search over a *belief*
 * map, where anything unobserved is optimistically assumed walkable. That
 * optimism is the point — the agent commits to a plan, reality contradicts it,
 * and it plans again.
 */

export const COLS = 33;
export const ROWS = 19;
export const SIGHT = 2;

export const START = { x: 1, y: Math.floor(ROWS / 2) };
export const GOAL = { x: COLS - 2, y: Math.floor(ROWS / 2) };

export function buildMaze(seed: number): Uint8Array {
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };

  const grid = new Uint8Array(COLS * ROWS);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const edge = x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1;
      grid[y * COLS + x] = edge || rand() < 0.26 ? 1 : 0;
    }
  }

  // Baffles with a single gap: the interesting failure is a wall found late.
  const gaps: number[] = [];
  for (let b = 0; b < 6; b++) {
    const x = 4 + b * 4;
    if (x >= COLS - 2) break;
    const gap = 1 + Math.floor(rand() * (ROWS - 2));
    gaps[x] = gap;
    for (let y = 1; y < ROWS - 1; y++) grid[y * COLS + x] = y === gap ? 0 : 1;
  }

  // Carve a guaranteed corridor start -> goal, threading each baffle's gap.
  // Without this, random walls routinely seal the agent in and the loop stalls
  // on "no route through what I believe".
  let cy = START.y;
  for (let x = START.x; x <= GOAL.x; x++) {
    const target = gaps[x] !== undefined ? gaps[x] : x === GOAL.x ? GOAL.y : cy;
    // Walk vertically to meet this column's required row, opening as we go.
    const step = target > cy ? 1 : -1;
    while (cy !== target) {
      grid[cy * COLS + x] = 0;
      cy += step;
    }
    grid[cy * COLS + x] = 0;
  }

  grid[START.y * COLS + START.x] = 0;
  grid[GOAL.y * COLS + GOAL.x] = 0;
  return grid;
}

/** Reveal everything within SIGHT of `at`. Mutates `belief`, returns new cells seen. */
export function senseInto(belief: Int8Array, maze: Uint8Array, at: { x: number; y: number }) {
  let revealed = 0;
  for (let dy = -SIGHT; dy <= SIGHT; dy++) {
    for (let dx = -SIGHT; dx <= SIGHT; dx++) {
      const x = at.x + dx;
      const y = at.y + dy;
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
      const i = y * COLS + x;
      if (belief[i] === -1) revealed++;
      belief[i] = maze[i] === 1 ? 1 : 0;
    }
  }
  return revealed;
}

export function initialBelief(maze: Uint8Array): Int8Array {
  const b = new Int8Array(COLS * ROWS).fill(-1);
  senseInto(b, maze, START);
  return b;
}

/** BFS over belief; -1 (unknown) counts as passable. */
export function planPath(belief: Int8Array, from: { x: number; y: number }): number[] | null {
  const prev = new Int32Array(COLS * ROWS).fill(-1);
  const seen = new Uint8Array(COLS * ROWS);
  const start = from.y * COLS + from.x;
  const goal = GOAL.y * COLS + GOAL.x;
  const queue = [start];
  seen[start] = 1;

  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    if (cur === goal) break;
    const cx = cur % COLS;
    const cy = (cur / COLS) | 0;
    const moves = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ];
    for (const [nx, ny] of moves) {
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const ni = ny * COLS + nx;
      if (seen[ni] || belief[ni] === 1) continue;
      seen[ni] = 1;
      prev[ni] = cur;
      queue.push(ni);
    }
  }

  if (!seen[goal]) return null;
  const path: number[] = [];
  for (let at = goal; at !== -1; at = prev[at]) path.push(at);
  return path.reverse();
}
