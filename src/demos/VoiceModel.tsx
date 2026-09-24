import { useEffect, useRef, useState } from "react";
import { corpus } from "../lib/corpus";
import { generate, train, type MarkovModel } from "../lib/markov";

/**
 * Trains a model on Kishore's writing, in the visitor's browser, on click.
 *
 * It is an n-gram Markov chain, not a neural network, and the UI says so
 * plainly. What makes it worth showing is the training data: it has read
 * nothing but his 32 articles, so its vocabulary and cadence are entirely his.
 */

const SEEDS = ["entropy", "the agent", "intelligence", "the universe", "a model", "time"];

export default function VoiceModel() {
  const [model, setModel] = useState<MarkovModel | null>(null);
  const [order, setOrder] = useState(2);
  const [temperature, setTemperature] = useState(1);
  const [seed, setSeed] = useState("");
  const [output, setOutput] = useState("");
  const [typing, setTyping] = useState(false);
  const typer = useRef<number | null>(null);

  // Retrain whenever the order changes — it is fast enough to feel instant.
  useEffect(() => {
    let cancelled = false;
    // Defer so the button's pressed state paints before we block the thread.
    const id = window.setTimeout(() => {
      const m = train(corpus.text, order);
      if (!cancelled) setModel(m);
    }, 16);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [order]);

  useEffect(() => () => {
    if (typer.current) window.clearInterval(typer.current);
  }, []);

  const run = () => {
    if (!model) return;
    const text = generate(model, { words: 70, temperature, seed: seed.trim() || undefined });

    if (typer.current) window.clearInterval(typer.current);
    setOutput("");
    setTyping(true);

    let i = 0;
    typer.current = window.setInterval(() => {
      i += 2;
      setOutput(text.slice(0, i));
      if (i >= text.length) {
        if (typer.current) window.clearInterval(typer.current);
        setTyping(false);
      }
    }, 12);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="training corpus" value={`${corpus.articleCount} articles`} />
        <Stat label="tokens seen" value={corpus.wordCount.toLocaleString()} />
        <Stat
          label="trained in"
          value={model ? `${model.trainMs.toFixed(0)} ms` : "…"}
          accent
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="seed" className="eyebrow">
            Start it thinking about
          </label>
          <input
            id="seed"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="anything — or leave blank"
            spellCheck={false}
            className="mt-3 w-full rounded-xl border border-white/12 bg-black/40 px-4 py-2.5
                       font-mono text-sm text-slate-100 outline-none placeholder:text-slate-600
                       focus:border-signal-400/60"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SEEDS.map((s) => (
              <button
                key={s}
                onClick={() => setSeed(s)}
                className="rounded-full border border-white/10 px-2.5 py-1 font-mono text-[10px]
                           text-slate-400 transition-colors hover:border-signal-400/50 hover:text-signal-300"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <Slider
            label="context window"
            hint={`${order} words`}
            min={1}
            max={4}
            step={1}
            value={order}
            onChange={setOrder}
          />
          <Slider
            label="temperature"
            hint={temperature.toFixed(2)}
            min={0.4}
            max={1.8}
            step={0.05}
            value={temperature}
            onChange={setTemperature}
          />
        </div>
      </div>

      <div>
        <button className="btn btn-primary" onClick={run} disabled={!model || typing}>
          {typing ? "generating…" : "▸ Generate in my voice"}
        </button>
      </div>

      <blockquote
        aria-live="polite"
        className="min-h-[9rem] rounded-xl border border-white/10 bg-black/30 p-5
                   font-body text-[15px] leading-relaxed text-slate-200"
      >
        {output || (
          <span className="text-slate-600">
            The model is loaded and waiting. Press generate.
          </span>
        )}
        {typing && <span className="ml-0.5 inline-block w-2 animate-pulse text-signal-400">▌</span>}
      </blockquote>

      {model && (
        <p className="font-mono text-[11px] leading-relaxed text-slate-600">
          {model.contextCount.toLocaleString()} distinct {order}-word contexts · order {order} Markov
          chain · no network request, no API key — the model was built from the corpus shipped with
          this page and it is running on your CPU.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p
        className={`mt-1 font-mono text-lg tabular-nums ${
          accent ? "text-ember-300" : "text-slate-200"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Slider({
  label,
  hint,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="eyebrow">{label}</span>
        <span className="font-mono text-[11px] text-slate-400 tabular-nums">{hint}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full"
        aria-label={label}
      />
    </div>
  );
}
