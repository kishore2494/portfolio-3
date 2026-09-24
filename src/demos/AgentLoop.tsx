import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInView } from "../components/Chapter";

/**
 * A sense → plan → act → reflect loop, running for real.
 *
 * No language model is involved and the caption says so. What it demonstrates
 * is the thing the essay is actually about: the agent cannot see the whole
 * maze. It plans optimistically over what it believes, walks until reality
 * contradicts the plan, then replans. The intelligence is in the loop, not in
 * any single step.
 */

const COLS = 23;
const ROWS = 15;
const SIGHT = 2;

type Phase = "sense" | "plan" | "act" | "reflect";
const PHASES: Phase[] = ["sense", "plan", "act", "reflect"];

const START = { x: 1, y: Math.floor(ROWS / 2) };
const GOAL = { x: COLS - 2, y: Math.floor(ROWS / 2) };

function buildMaze(seed: number): Uint8Array {
  // Deterministic pseudo-random walls, with start/goal and a border kept clear.
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };

  const grid = new Uint8Array(COLS * ROWS);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const edge = x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1;
      grid[y * COLS + x] = edge || rand() < 0.28 ? 1 : 0;
    }
  }
  // Vertical baffles: the interesting failure mode is a wall you only see late.
  for (let b = 0; b < 4; b++) {
    const x = 4 + b * 4;
    const gap = 1 + Math.floor(rand() * (ROWS - 2));
    for (let y = 1; y < ROWS - 1; y++) grid[y * COLS + x] = y === gap ? 0 : 1;
  }
  grid[START.y * COLS + START.x] = 0;
  grid[GOAL.y * COLS + GOAL.x] = 0;
  return grid;
}

/** Reveal everything within SIGHT of a position. Mutates and returns `belief`. */
function senseInto(belief: Int8Array, maze: Uint8Array, at: { x: number; y: number }) {
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

/** A fresh belief map that already includes what the agent can see from the start. */
function initialBelief(maze: Uint8Array) {
  const b = new Int8Array(COLS * ROWS).fill(-1);
  senseInto(b, maze, START);
  return b;
}

/** BFS over the agent's *belief*; unknown cells are assumed passable. */
function planPath(belief: Int8Array, from: { x: number; y: number }) {
  const prev = new Int32Array(COLS * ROWS).fill(-1);
  const seen = new Uint8Array(COLS * ROWS);
  const queue = [from.y * COLS + from.x];
  seen[queue[0]] = 1;
  const goalIdx = GOAL.y * COLS + GOAL.x;

  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    if (cur === goalIdx) break;
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
      if (seen[ni] || belief[ni] === 1) continue; // 1 = known wall
      seen[ni] = 1;
      prev[ni] = cur;
      queue.push(ni);
    }
  }

  if (!seen[goalIdx]) return null;
  const path: number[] = [];
  for (let at = goalIdx; at !== -1; at = prev[at]) path.push(at);
  return path.reverse();
}

export default function AgentLoop() {
  const [seed, setSeed] = useState(7);
  const maze = useMemo(() => buildMaze(seed), [seed]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [belief, setBelief] = useState<Int8Array>(() => initialBelief(maze));
  const [pos, setPos] = useState(START);
  const [path, setPath] = useState<number[] | null>(null);
  const [phase, setPhase] = useState<Phase>("sense");
  const [log, setLog] = useState<string[]>(["agent initialised · goal unknown terrain"]);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState(0);
  const [replans, setReplans] = useState(0);
  const [done, setDone] = useState(false);
  const { ref: wrapRef, inView } = useInView<HTMLDivElement>(0.2);

  const reset = useCallback((nextSeed?: number) => {
    if (nextSeed !== undefined) setSeed(nextSeed);
    setBelief(initialBelief(nextSeed !== undefined ? buildMaze(nextSeed) : maze));
    setPos(START);
    setPath(null);
    setPhase("sense");
    setSteps(0);
    setReplans(0);
    setDone(false);
    setRunning(false);
    setLog(["agent initialised · goal unknown terrain"]);
  }, [maze]);

  const say = (line: string) =>
    setLog((l) => [line, ...l].slice(0, 7));

  // One turn of the loop per tick.
  const tick = useCallback(() => {
    if (done) return;

    setPhase((current) => {
      const next = PHASES[(PHASES.indexOf(current) + 1) % PHASES.length];

      if (current === "sense") {
        // Reveal everything within SIGHT; that is all the agent ever learns.
        setBelief((b) => {
          const nb = Int8Array.from(b);
          const revealed = senseInto(nb, maze, pos);
          if (revealed) say(`sense · ${revealed} new cells observed`);

          // The event this demo exists to show: something we just saw proves
          // the route we were committed to is impossible.
          setPath((p) => {
            if (p && p.some((i) => nb[i] === 1)) {
              setReplans((r) => r + 1);
              say("reflect · new evidence contradicts the plan — discarding it");
              return null;
            }
            return p;
          });
          return nb;
        });
      }

      if (current === "plan") {
        setBelief((b) => {
          setPath((existing) => {
            if (existing && existing.length > 1) return existing; // still valid
            const p = planPath(b, pos);
            if (!p) say("plan · no route through what I believe");
            else say(`plan · route found, ${p.length - 1} steps over believed map`);
            return p;
          });
          return b;
        });
      }

      if (current === "act") {
        setPath((p) => {
          if (!p || p.length < 2) return p;
          const nextIdx = p[1];
          const nx = nextIdx % COLS;
          const ny = (nextIdx / COLS) | 0;

          if (maze[nextIdx] === 1) {
            // The plan met reality and lost. This is the whole point.
            setBelief((b) => {
              const nb = Int8Array.from(b);
              nb[nextIdx] = 1;
              return nb;
            });
            setReplans((r) => r + 1);
            say("act · blocked — belief was wrong, discarding plan");
            return null;
          }

          setPos({ x: nx, y: ny });
          setSteps((s) => s + 1);
          if (nx === GOAL.x && ny === GOAL.y) {
            setDone(true);
            setRunning(false);
            say("act · goal reached");
          }
          return p.slice(1);
        });
      }

      if (current === "reflect") {
        // Cheap reflection: if we have no plan, we will re-sense and re-plan.
        setPath((p) => {
          if (!p) say("reflect · no viable plan, widening what I know");
          return p;
        });
      }

      return next;
    });
  }, [done, maze, pos]);

  useEffect(() => {
    if (!running || !inView || done) return;
    const id = window.setInterval(tick, 190);
    return () => window.clearInterval(id);
  }, [running, inView, done, tick]);

  // Render.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = canvas.clientWidth;
    const cell = cw / COLS;
    const ch = cell * ROWS;
    if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
      canvas.style.height = `${ch}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const i = y * COLS + x;
        const b = belief[i];
        ctx.fillStyle =
          b === -1 ? "#070912" : b === 1 ? "rgba(255,138,61,0.30)" : "rgba(52,211,255,0.07)";
        ctx.fillRect(x * cell + 0.5, y * cell + 0.5, cell - 1, cell - 1);
      }
    }

    if (path) {
      ctx.fillStyle = "rgba(52,211,255,0.30)";
      for (const i of path) {
        const x = i % COLS;
        const y = (i / COLS) | 0;
        ctx.fillRect(x * cell + cell * 0.32, y * cell + cell * 0.32, cell * 0.36, cell * 0.36);
      }
    }

    // Goal.
    ctx.strokeStyle = "#ff8a3d";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(GOAL.x * cell + 2, GOAL.y * cell + 2, cell - 4, cell - 4);

    // Agent.
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(52,211,255,0.9)";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(pos.x * cell + cell / 2, pos.y * cell + cell / 2, cell * 0.30, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }, [belief, path, pos]);

  return (
    <div ref={wrapRef} className="flex flex-col gap-5">
      <canvas
        ref={canvasRef}
        className="w-full rounded-xl border border-white/10 bg-black/40"
        role="img"
        aria-label="An agent exploring a partially observable maze"
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1.5">
            {PHASES.map((p) => (
              <span
                key={p}
                className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em]
                            transition-colors ${
                              phase === p
                                ? "border-signal-400/60 bg-signal-400/15 text-signal-300"
                                : "border-white/10 text-slate-600"
                            }`}
              >
                {p}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={() => setRunning((r) => !r)} disabled={done}>
              {running ? "❙❙ Pause" : "▸ Run the loop"}
            </button>
            <button className="btn" onClick={tick} disabled={running || done}>
              Step once
            </button>
            <button className="btn" onClick={() => reset(Math.floor(Math.random() * 9999))}>
              New maze
            </button>
          </div>

          <div className="flex gap-5 font-mono text-[11px] text-slate-500">
            <span>
              steps <span className="text-signal-300 tabular-nums">{steps}</span>
            </span>
            <span>
              replans <span className="text-ember-300 tabular-nums">{replans}</span>
            </span>
            <span>
              {done ? <span className="text-signal-300">goal reached</span> : "in progress"}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <p className="eyebrow">Decision log</p>
          <ul className="mt-3 space-y-1.5 font-mono text-[11px] leading-relaxed">
            {log.map((line, i) => (
              <li key={`${line}-${i}`} className={i === 0 ? "text-slate-300" : "text-slate-600"}>
                <span className="text-slate-700">›</span> {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
