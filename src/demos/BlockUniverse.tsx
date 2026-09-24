import { useEffect, useMemo, useRef, useState } from "react";
import { useInView } from "../components/Chapter";

/**
 * The block universe, made literal.
 *
 * Every row of this image is one moment of a deterministic 1-D universe
 * (elementary cellular automaton, rule 110 — which is Turing complete, so this
 * toy can in principle compute anything). The whole block is evaluated once,
 * before you touch anything. Nothing is generated as you scrub.
 *
 * So "now" is not a computation. It is a highlighted row. The future rows were
 * already there, below the line, the entire time.
 */

const W = 260;
const T = 340;
const RULE = 110;

function computeBlock(): Uint8Array {
  const cells = new Uint8Array(W * T);
  // Single live cell, slightly off-centre, so the structure is asymmetric.
  cells[Math.floor(W * 0.62)] = 1;

  for (let t = 1; t < T; t++) {
    const prev = (t - 1) * W;
    const cur = t * W;
    for (let x = 0; x < W; x++) {
      const l = cells[prev + ((x - 1 + W) % W)];
      const c = cells[prev + x];
      const r = cells[prev + ((x + 1) % W)];
      const pattern = (l << 2) | (c << 1) | r;
      cells[cur + x] = (RULE >> pattern) & 1;
    }
  }
  return cells;
}

export default function BlockUniverse() {
  const block = useMemo(computeBlock, []);
  const blockRef = useRef<HTMLCanvasElement | null>(null);
  const sliceRef = useRef<HTMLCanvasElement | null>(null);
  const [now, setNow] = useState(Math.floor(T * 0.35));
  const [playing, setPlaying] = useState(false);
  const { ref: wrapRef, inView } = useInView<HTMLDivElement>(0.2);

  // Autoplay the "now" line, so the present drifts like it does for us.
  useEffect(() => {
    if (!playing || !inView) return;
    const id = window.setInterval(() => {
      setNow((n) => (n + 1) % T);
    }, 45);
    return () => window.clearInterval(id);
  }, [playing, inView]);

  // The whole block, drawn once per "now" change.
  useEffect(() => {
    const canvas = blockRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (canvas.width !== cw * dpr) {
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    const img = ctx.createImageData(W, T);
    for (let t = 0; t < T; t++) {
      // Past: cool and settled. Future: present but faint. Now: hot.
      const isPast = t < now;
      const dist = Math.abs(t - now);
      for (let x = 0; x < W; x++) {
        const on = block[t * W + x];
        const o = (t * W + x) * 4;
        if (!on) {
          img.data[o] = 6;
          img.data[o + 1] = 8;
          img.data[o + 2] = 16;
          img.data[o + 3] = 255;
          continue;
        }
        if (dist < 1.5) {
          img.data[o] = 255; img.data[o + 1] = 255; img.data[o + 2] = 255;
        } else if (isPast) {
          img.data[o] = 52; img.data[o + 1] = 150; img.data[o + 2] = 200;
        } else {
          img.data[o] = 120; img.data[o + 1] = 95; img.data[o + 2] = 70;
        }
        img.data[o + 3] = isPast ? 235 : 150;
      }
    }

    // Blit at 1:1 then scale up with smoothing off, to keep cells crisp.
    const off = document.createElement("canvas");
    off.width = W;
    off.height = T;
    off.getContext("2d")!.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, cw, ch);

    // The "now" line.
    const y = (now / T) * ch;
    ctx.strokeStyle = "rgba(52,211,255,0.95)";
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "rgba(52,211,255,0.9)";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(cw, y);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, [block, now]);

  // The single row you are "experiencing".
  useEffect(() => {
    const canvas = sliceRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (canvas.width !== cw * dpr) {
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    const cell = cw / W;
    for (let x = 0; x < W; x++) {
      if (!block[now * W + x]) continue;
      ctx.fillStyle = "#34d3ff";
      ctx.fillRect(x * cell, 0, Math.max(1, cell), ch);
    }
  }, [block, now]);

  const alive = useMemo(() => {
    let n = 0;
    for (let x = 0; x < W; x++) n += block[now * W + x];
    return n;
  }, [block, now]);

  return (
    <div ref={wrapRef} className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <canvas
        ref={blockRef}
        className="h-[340px] w-full rounded-xl border border-white/10 sm:h-[420px]"
        role="img"
        aria-label="A spacetime block; the horizontal line marks the present moment"
      />

      <div className="flex flex-col gap-5">
        <div>
          <p className="eyebrow">The moment you are in</p>
          <canvas
            ref={sliceRef}
            className="mt-3 h-10 w-full rounded-lg border border-white/10 bg-black/40"
            role="img"
            aria-label="The present slice of the universe"
          />
          <div className="mt-3 flex items-center gap-4 font-mono text-[11px] text-slate-500">
            <span>
              t = <span className="text-signal-300 tabular-nums">{String(now).padStart(3, "0")}</span> / {T}
            </span>
            <span>
              alive = <span className="text-signal-300 tabular-nums">{alive}</span>
            </span>
          </div>
        </div>

        <div>
          <input
            type="range"
            min={0}
            max={T - 1}
            value={now}
            onChange={(e) => {
              setPlaying(false);
              setNow(Number(e.target.value));
            }}
            className="w-full"
            aria-label="Scrub the present moment through spacetime"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={() => setPlaying((p) => !p)}>
              {playing ? "❙❙ Stop time" : "▸ Let time run"}
            </button>
            <button className="btn" onClick={() => setNow(0)}>
              Jump to the beginning
            </button>
            <button className="btn" onClick={() => setNow(T - 1)}>
              Jump to the end
            </button>
          </div>
        </div>

        <p className="prose-line">
          The blue rows are your past. The <span className="text-ember-300">amber</span> rows below
          the line are your future — and they are already drawn. This entire block was computed
          before the page finished loading. Scrubbing does not create anything; it only moves where
          you are looking.
        </p>
      </div>
    </div>
  );
}
