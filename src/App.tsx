import { useRef } from "react";
import { CHAPTER_IDS, useStage, type ChapterId } from "./engine/Stage";
import { corpus } from "./lib/corpus";

const SITE_1 = "https://kishore2494.github.io/personal-site";
const SITE_2 = "https://kishore2494.github.io/personal-site-2";

const TITLES: Record<ChapterId, { numeral: string; title: string }> = {
  entropy: { numeral: "I", title: "Entropy" },
  time: { numeral: "II", title: "Time" },
  intelligence: { numeral: "III", title: "Intelligence" },
  voice: { numeral: "IV", title: "Voice" },
  agency: { numeral: "V", title: "Agency" },
};

/** Each chapter is a tall scroll box; the text sits in a sticky panel inside it. */
function Act({
  id,
  children,
  height = "300vh",
  align = "center",
}: {
  id: ChapterId;
  children: React.ReactNode;
  height?: string;
  /** "bottom" keeps the copy clear of whatever the field is drawing above it. */
  align?: "center" | "bottom";
}) {
  return (
    <section id={id} style={{ height }} className="relative">
      <div
        className={`sticky top-0 flex min-h-[100svh] ${
          align === "bottom" ? "items-end pb-14" : "items-center"
        }`}
      >
        <div className="pad w-full">
          <div className="max-w-xl">
            <p className="eyebrow">
              Chapter {TITLES[id].numeral} · {TITLES[id].title}
            </p>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stage = useStage(canvasRef);

  return (
    <>
      {/* The one field. Fixed, behind everything, for the whole page. */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 h-full w-full"
        aria-hidden
      />

      {/* Word labels pinned to the attention nodes. Same clip-space mapping as
          the vertex shader: screen = (ndc * 0.5 + 0.5) * size. */}
      {stage.active === "intelligence" && (
        <div className="pointer-events-none fixed inset-0 z-20 hidden md:block">
          {stage.attentionNodes.map((n) => (
            <span
              key={n.word + n.x}
              className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full
                         border border-white/15 bg-ink-950/80 px-2.5 py-1 font-mono text-[11px]
                         text-slate-200 backdrop-blur-sm"
              style={{
                left: `${(n.x * 0.5 + 0.5) * 100}%`,
                top: `${(1 - (n.y * 0.5 + 0.5)) * 100}%`,
              }}
            >
              {n.word}
            </span>
          ))}
        </div>
      )}

      {!stage.supported && (
        <div className="fixed inset-x-0 top-0 z-50 bg-ember-500/20 px-4 py-2 text-center text-xs text-ember-300">
          Your browser blocked WebGL2, so the particle field cannot run.{" "}
          <a className="underline" href="v1/">
            The earlier version of this site
          </a>{" "}
          works without it.
        </div>
      )}

      {/* Chapter rail */}
      <nav
        aria-label="Chapters"
        className="fixed right-6 top-1/2 z-40 hidden -translate-y-1/2 md:block"
      >
        <ul className="space-y-3.5">
          {CHAPTER_IDS.map((id) => {
            const on = stage.active === id;
            return (
              <li key={id}>
                <a href={`#${id}`} className="group flex items-center justify-end gap-2.5">
                  <span
                    className={`font-mono text-[10px] uppercase tracking-[0.16em] transition-opacity ${
                      on ? "text-signal-300 opacity-100" : "text-slate-600 opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    {TITLES[id].title}
                  </span>
                  <span
                    className={`block h-px transition-all ${
                      on ? "w-8 bg-signal-400" : "w-3.5 bg-slate-700 group-hover:w-5"
                    }`}
                  />
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <main className="relative z-10">
        {/* ---------------------------------------------------------------- */}
        <header className="relative flex min-h-[100svh] items-center">
          <div className="pad">
            <p className="eyebrow">Kishore Kumar A · Portfolio 3</p>
            <h1 className="mt-6 font-display text-[clamp(2.75rem,10vw,7.5rem)] font-bold leading-[0.92] text-white">
              The Engine
              <br />
              of Everything
            </h1>
            <p className="lede mt-8 max-w-lg">
              Every particle on this page is the same particle, all the way down. It will become a
              gas, a universe, a thought, my handwriting, and something that wants.
            </p>
            <p className="mt-6 max-w-lg text-sm text-slate-500">
              {stage.particleCount.toLocaleString()} of them, running on your GPU. Nothing here is a
              video and nothing reloads between chapters.
            </p>
            <a href="#entropy" className="btn btn-primary mt-10">
              ▾ Begin
            </a>
          </div>
        </header>

        {/* ---------------------------------------------------------------- */}
        <Act id="entropy" height="340vh">
          <h2 className="act-title">It starts in a corner.</h2>
          <p className="prose-line mt-6">
            Every particle begins packed into one small space — the most ordered this page will ever
            be. Keep scrolling and they spread, not because anything pushes them, but because
            spreading has overwhelmingly more ways to happen.
          </p>

          <div className="mt-8 flex items-baseline gap-4">
            <span className="font-mono text-5xl font-semibold tabular-nums text-ember-400">
              {stage.peakEntropy.toFixed(3)}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-widest text-slate-500">
              entropy
            </span>
          </div>

          {stage.reversalAttempts > 0 && (
            <p className="mt-6 max-w-md border-l-2 border-ember-400/60 pl-4 font-mono text-[12px] leading-relaxed text-ember-300">
              You scrolled back up{stage.reversalAttempts > 1 ? ` ${stage.reversalAttempts} times` : ""}. The
              text moved. The particles did not un-mix.
              <span className="mt-1 block text-slate-500">
                Nothing in the universe lets you take that back either.
              </span>
            </p>
          )}
        </Act>

        {/* ---------------------------------------------------------------- */}
        <Act id="time">
          <h2 className="act-title">Then it all exists at once.</h2>
          <p className="prose-line mt-6">
            The same particles have frozen into a spacetime block. Every row is one moment of a
            deterministic universe, and the whole thing was computed before you arrived.
          </p>
          <p className="prose-line mt-4">
            The <span className="text-signal-300">cool</span> rows are the past. The{" "}
            <span className="text-ember-300">warm</span> rows are the future. They are already drawn.
            Nothing is generated as you scroll — you are only moving where you look.
          </p>
        </Act>

        {/* ---------------------------------------------------------------- */}
        <Act id="intelligence">
          <h2 className="act-title">Something inside starts looking.</h2>
          <p className="prose-line mt-6">
            Now they are an attention graph. Each node is a word; the particles riding each edge are
            proportional to how hard one word attends to another — real{" "}
            <span className="font-mono text-signal-300">softmax(QKᵀ/√d)</span>, over vectors built
            from my own articles.
          </p>

          <label htmlFor="attn" className="eyebrow mt-8 block">
            Rewire it
          </label>
          <input
            id="attn"
            value={stage.attentionText}
            onChange={(e) => stage.setAttentionText(e.target.value)}
            spellCheck={false}
            className="mt-3 w-full rounded-xl border border-white/12 bg-black/50 px-4 py-3
                       font-mono text-sm text-slate-100 outline-none backdrop-blur
                       focus:border-signal-400/60"
          />
          <p className="mt-3 font-mono text-[11px] text-slate-600">
            {stage.attentionNodes.length} tokens · the field re-forms as you type
          </p>

          <p className="mt-6 max-w-md text-[12px] leading-relaxed text-slate-600">
            Honest about this one: the arithmetic is the real operation, but there are no learned
            projection matrices — Q = K = V, so the weights are softmaxed cosine similarity over
            corpus co-occurrence statistics, not a trained transformer.
          </p>
        </Act>

        {/* ---------------------------------------------------------------- */}
        <Act id="voice" align="bottom">
          <h2 className="act-title">Then it writes.</h2>
          <p className="prose-line mt-6">
            A model trained in your browser, on {corpus.articleCount} essays and nothing else —{" "}
            {corpus.wordCount.toLocaleString()} words of my prose. Press the button and the particles
            become the sentence it produces.
          </p>

          <button
            className="btn btn-primary mt-8"
            onClick={stage.voice.generate}
            disabled={!stage.voice.model}
          >
            {stage.voice.model ? "▸ Write something" : "training…"}
          </button>

          {stage.voice.model && (
            <p className="mt-4 font-mono text-[11px] text-slate-600">
              trained in {stage.voice.model.trainMs.toFixed(0)} ms ·{" "}
              {stage.voice.model.contextCount.toLocaleString()} contexts · word-level n-gram, not a
              neural network
            </p>
          )}
        </Act>

        {/* ---------------------------------------------------------------- */}
        <Act id="agency" align="bottom">
          <h2 className="act-title">And then it wants something.</h2>
          <p className="prose-line mt-6">
            The particles are terrain now, and one bright knot of them is an agent that can only see
            two cells in any direction. It plans confidently across everything it has not checked,
            walks until reality disagrees, and plans again.
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={stage.agent.toggle} disabled={stage.agent.done}>
              {stage.agent.running ? "❙❙ Pause" : "▸ Run the loop"}
            </button>
            <button className="btn" onClick={stage.agent.reset}>
              New world
            </button>
          </div>

          <div className="mt-5 flex gap-6 font-mono text-[11px] text-slate-500">
            <span>
              steps <span className="tabular-nums text-signal-300">{stage.agent.steps}</span>
            </span>
            <span>
              replans <span className="tabular-nums text-ember-300">{stage.agent.replans}</span>
            </span>
            <span className={stage.agent.done ? "text-signal-300" : ""}>
              {stage.agent.done ? "goal reached" : "searching"}
            </span>
          </div>

          <ul className="mt-5 space-y-1 font-mono text-[11px]">
            {stage.agent.log.map((line, i) => (
              <li key={`${line}-${i}`} className={i === 0 ? "text-slate-300" : "text-slate-600"}>
                <span className="text-slate-700">›</span> {line}
              </li>
            ))}
          </ul>
        </Act>

        {/* ---------------------------------------------------------------- */}
        <footer className="relative min-h-[100svh] bg-gradient-to-b from-transparent to-ink-950/95 py-28">
          <div className="pad">
            <p className="eyebrow">The source</p>
            <h2 className="mt-4 font-display text-4xl font-bold text-white sm:text-5xl">
              All of it came out of {corpus.articleCount} essays
            </h2>
            <p className="prose-line mt-5 max-w-xl">
              The same corpus trained the model, produced the vectors, and supplied every idea above.
              {corpus.wordCount.toLocaleString()} words, once the code blocks are stripped.
            </p>

            <ul className="mt-10 grid max-w-4xl gap-x-10 gap-y-2.5 sm:grid-cols-2">
              {corpus.meta.slice(0, 10).map((a) => (
                <li key={a.slug}>
                  <a
                    href={`${SITE_2}/articles/${a.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-baseline gap-3 py-0.5"
                  >
                    <span className="font-mono text-[10px] tabular-nums text-slate-700">
                      {a.date.slice(0, 7)}
                    </span>
                    <span className="text-[15px] leading-snug text-slate-400 transition-colors group-hover:text-signal-300">
                      {a.title}
                    </span>
                  </a>
                </li>
              ))}
            </ul>

            <div className="mt-14 border-t border-white/10 pt-8">
              <div className="flex flex-wrap gap-3">
                <a href={SITE_1} target="_blank" rel="noreferrer" className="btn">
                  Portfolio 1 — the writing ↗
                </a>
                <a href={SITE_2} target="_blank" rel="noreferrer" className="btn">
                  Portfolio 2 — the work ↗
                </a>
                <a href="v1/" className="btn">
                  The earlier version of this page ↗
                </a>
              </div>

              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] text-slate-600">
                <a className="hover:text-signal-300" href="mailto:akishorekumar2494@gmail.com">
                  akishorekumar2494@gmail.com
                </a>
                <a className="hover:text-signal-300" href="https://github.com/kishore2494" target="_blank" rel="noreferrer">
                  github.com/kishore2494
                </a>
                <a className="hover:text-signal-300" href="https://www.linkedin.com/in/kishore-kumar-11184a196/" target="_blank" rel="noreferrer">
                  linkedin
                </a>
              </div>

              <p className="mt-8 font-mono text-[10px] text-slate-700">
                © {new Date().getFullYear()} Kishore Kumar A · {stage.particleCount.toLocaleString()}{" "}
                particles, one field, no server.
              </p>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
