import { useCallback, useEffect, useRef, useState } from "react";
import { useInView } from "../components/Chapter";

/**
 * Particles in a box, started in one corner (ordered / low entropy).
 *
 * The number on screen is a real measurement, not a prop: the box is divided
 * into a CELLS×CELLS grid and we compute the Shannon entropy of the occupancy
 * distribution, H = -Σ p log p, normalised by log(CELLS²) so 1.0 is "perfectly
 * spread". Press reset and watch it climb — and never fall.
 */

const N = 900;
const CELLS = 12;
const MAX_H = Math.log(CELLS * CELLS);
const HISTORY = 220;

type P = { x: number; y: number; vx: number; vy: number };

function seedParticles(corner: boolean): P[] {
  const ps: P[] = [];
  for (let i = 0; i < N; i++) {
    const speed = 0.0016 + Math.random() * 0.0022;
    const angle = Math.random() * Math.PI * 2;
    ps.push({
      x: corner ? Math.random() * 0.18 + 0.02 : Math.random(),
      y: corner ? Math.random() * 0.18 + 0.02 : Math.random(),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    });
  }
  return ps;
}

function shannon(ps: P[]): number {
  const grid = new Float64Array(CELLS * CELLS);
  for (const p of ps) {
    const cx = Math.min(CELLS - 1, Math.max(0, (p.x * CELLS) | 0));
    const cy = Math.min(CELLS - 1, Math.max(0, (p.y * CELLS) | 0));
    grid[cy * CELLS + cx] += 1;
  }
  let h = 0;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === 0) continue;
    const p = grid[i] / N;
    h -= p * Math.log(p);
  }
  return h / MAX_H;
}

export default function EntropyBox() {
  const boxRef = useRef<HTMLCanvasElement | null>(null);
  const plotRef = useRef<HTMLCanvasElement | null>(null);
  const particles = useRef<P[]>(seedParticles(true));
  const history = useRef<number[]>([]);
  const frame = useRef(0);
  const [entropy, setEntropy] = useState(0);
  const [running, setRunning] = useState(true);
  const { ref: wrapRef, inView } = useInView<HTMLDivElement>(0.2);

  const reset = useCallback((corner: boolean) => {
    particles.current = seedParticles(corner);
    history.current = [];
    frame.current = 0;
    setEntropy(shannon(particles.current));
    setRunning(true);
  }, []);

  useEffect(() => {
    setEntropy(shannon(particles.current));
  }, []);

  useEffect(() => {
    // Pause off-screen: no point burning a rAF loop nobody is looking at.
    if (!inView || !running) return;
    let raf = 0;

    const step = () => {
      const ps = particles.current;
      for (const p of ps) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) { p.x = -p.x; p.vx = -p.vx; }
        if (p.x > 1) { p.x = 2 - p.x; p.vx = -p.vx; }
        if (p.y < 0) { p.y = -p.y; p.vy = -p.vy; }
        if (p.y > 1) { p.y = 2 - p.y; p.vy = -p.vy; }
      }

      frame.current++;
      if (frame.current % 3 === 0) {
        const h = shannon(ps);
        history.current.push(h);
        if (history.current.length > HISTORY) history.current.shift();
        setEntropy(h);
      }

      draw();
      raf = requestAnimationFrame(step);
    };

    const draw = () => {
      const canvas = boxRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const size = canvas.clientWidth;
      if (canvas.width !== size * dpr) {
        canvas.width = size * dpr;
        canvas.height = size * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      ctx.fillStyle = "rgba(8,10,20,0.9)";
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.strokeRect(0.5, 0.5, size - 1, size - 1);

      for (const p of particles.current) {
        const x = p.x * size;
        const y = p.y * size;
        ctx.fillStyle = "rgba(120,225,255,0.9)";
        ctx.fillRect(x, y, 2, 2);
      }

      // Entropy over time.
      const plot = plotRef.current;
      const pctx = plot?.getContext("2d");
      if (!plot || !pctx) return;
      const pw = plot.clientWidth;
      const ph = plot.clientHeight;
      if (plot.width !== pw * dpr) {
        plot.width = pw * dpr;
        plot.height = ph * dpr;
      }
      pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pctx.clearRect(0, 0, pw, ph);

      pctx.strokeStyle = "rgba(255,255,255,0.07)";
      pctx.beginPath();
      pctx.moveTo(0, ph - 1);
      pctx.lineTo(pw, ph - 1);
      pctx.stroke();

      const hist = history.current;
      if (hist.length > 1) {
        pctx.beginPath();
        hist.forEach((h, i) => {
          const x = (i / (HISTORY - 1)) * pw;
          const y = ph - h * (ph - 4) - 2;
          i === 0 ? pctx.moveTo(x, y) : pctx.lineTo(x, y);
        });
        pctx.strokeStyle = "#ff8a3d";
        pctx.lineWidth = 1.6;
        pctx.stroke();
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, running]);

  return (
    <div ref={wrapRef} className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <canvas
        ref={boxRef}
        className="aspect-square w-full max-w-full rounded-xl"
        role="img"
        aria-label="A box of particles spreading out from one corner"
      />

      <div className="flex flex-col justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-4xl font-semibold text-ember-400 tabular-nums">
              {entropy.toFixed(3)}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-widest text-slate-500">
              normalised entropy
            </span>
          </div>
          <p className="prose-line mt-3">
            Shannon entropy of the particle distribution across a {CELLS}×{CELLS} grid,
            divided by its maximum. Start it in the corner and it climbs. It will not
            fall on its own — that asymmetry is the arrow of time.
          </p>
          <canvas
            ref={plotRef}
            className="mt-4 h-20 w-full rounded-lg border border-white/10 bg-black/30"
            role="img"
            aria-label="Entropy plotted over time, rising and flattening"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={() => reset(true)}>
            ⟲ Start ordered
          </button>
          <button className="btn" onClick={() => reset(false)}>
            Start mixed
          </button>
          <button className="btn" onClick={() => setRunning((r) => !r)}>
            {running ? "Pause" : "Resume"}
          </button>
        </div>
      </div>
    </div>
  );
}
