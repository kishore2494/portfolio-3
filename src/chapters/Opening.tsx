import { useEffect, useRef, useState } from "react";
import { corpus } from "../lib/corpus";

/** A slow starfield that drifts toward the viewer — cheap, and it sets the register. */
function Starfield() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const COUNT = 260;
    const stars = Array.from({ length: COUNT }, () => ({
      x: Math.random() * 2 - 1,
      y: Math.random() * 2 - 1,
      z: Math.random(),
    }));

    let raf = 0;
    let w = 0;
    let h = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        if (!reduced) {
          s.z -= 0.0011;
          if (s.z <= 0.02) {
            s.x = Math.random() * 2 - 1;
            s.y = Math.random() * 2 - 1;
            s.z = 1;
          }
        }
        const k = 0.5 / s.z;
        const x = w / 2 + s.x * k * w * 0.5;
        const y = h / 2 + s.y * k * h * 0.5;
        if (x < 0 || x > w || y < 0 || y > h) continue;
        const size = Math.max(0.4, (1 - s.z) * 2.1);
        ctx.fillStyle = `rgba(190,225,255,${(1 - s.z) * 0.85})`;
        ctx.fillRect(x, y, size, size);
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden />;
}

const LINES = [
  "Nothing in the universe happens without a reason.",
  "Not one that anybody chose.",
  "Everything that has ever happened — every star, every thought, every line of code —",
  "runs on the same engine.",
];

export default function Opening() {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setVisible(LINES.length);
      return;
    }
    const id = window.setInterval(() => {
      setVisible((v) => {
        if (v >= LINES.length) {
          window.clearInterval(id);
          return v;
        }
        return v + 1;
      });
    }, 900);
    return () => window.clearInterval(id);
  }, []);

  return (
    <header className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden">
      <Starfield />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 42%, rgba(52,211,255,0.10), transparent 62%)",
        }}
        aria-hidden
      />

      <div className="pad relative">
        <p className="eyebrow">Kishore Kumar A · Portfolio 3</p>

        <h1 className="mt-6 font-display text-5xl font-bold leading-[0.98] text-white sm:text-7xl lg:text-8xl">
          The Engine
          <br />
          of Everything
        </h1>

        <div className="mt-10 max-w-xl space-y-2">
          {LINES.map((line, i) => (
            <p
              key={line}
              className={`prose-line transition-all duration-700 ${
                i < visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
              } ${i === LINES.length - 1 ? "text-signal-300" : ""}`}
            >
              {line}
            </p>
          ))}
        </div>

        <p className="mt-10 max-w-xl text-sm leading-relaxed text-slate-500">
          Five chapters, drawn from {corpus.articleCount} essays I have written. Each one ends in
          something you can run. Every simulation on this page computes in your browser — there is no
          server, no API key, and nothing is pre-recorded.
        </p>

        <a
          href="#entropy"
          className="btn btn-primary mt-8"
          aria-label="Begin reading at chapter one"
        >
          ▾ Begin
        </a>
      </div>

      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-32
                   bg-gradient-to-b from-transparent to-ink-950"
        aria-hidden
      />
    </header>
  );
}
