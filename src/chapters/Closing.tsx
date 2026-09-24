import { corpus } from "../lib/corpus";
import { Reveal } from "../components/Chapter";

/** The index of everything the page was built from, plus the way back out. */
export default function Closing({ site1, site2 }: { site1: string; site2: string }) {
  const featured = corpus.meta.slice(0, 12);

  return (
    <footer className="relative border-t border-white/10 bg-ink-900/60 py-24">
      <div className="pad">
        <Reveal>
          <p className="eyebrow">The source</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl">
            Everything above was built from these
          </h2>
          <p className="prose-line mt-4 max-w-2xl">
            {corpus.articleCount} essays, {corpus.wordCount.toLocaleString()} words of prose after
            code blocks are stripped. The same corpus trains the model in Chapter IV and produces the
            vectors in Chapter III.
          </p>
        </Reveal>

        <Reveal delay={80}>
          <ul className="mt-10 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {featured.map((a) => (
              <li key={a.slug}>
                <a
                  href={`${site2}/articles/${a.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-baseline gap-3 py-1"
                >
                  <span className="font-mono text-[10px] text-slate-700 tabular-nums">
                    {a.date.slice(0, 7)}
                  </span>
                  <span className="text-[15px] leading-snug text-slate-400 transition-colors group-hover:text-signal-300">
                    {a.title}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={120}>
          <div className="mt-16 border-t border-white/10 pt-10">
            <p className="eyebrow">My other two sites</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href={site1} target="_blank" rel="noreferrer" className="btn">
                <span className="h-1.5 w-1.5 rounded-full bg-signal-400" aria-hidden />
                Portfolio 1 — the writing ↗
              </a>
              <a href={site2} target="_blank" rel="noreferrer" className="btn">
                <span className="h-1.5 w-1.5 rounded-full bg-signal-400" aria-hidden />
                Portfolio 2 — the work ↗
              </a>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] text-slate-600">
              <a
                href="mailto:akishorekumar2494@gmail.com"
                className="transition-colors hover:text-signal-300"
              >
                akishorekumar2494@gmail.com
              </a>
              <a
                href="https://github.com/kishore2494"
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-signal-300"
              >
                github.com/kishore2494
              </a>
              <a
                href="https://www.linkedin.com/in/kishore-kumar-11184a196/"
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-signal-300"
              >
                linkedin
              </a>
            </div>

            <p className="mt-8 font-mono text-[10px] leading-relaxed text-slate-700">
              © {new Date().getFullYear()} Kishore Kumar A · every simulation on this page runs
              locally in your browser — no server, no API key, no telemetry.
            </p>
          </div>
        </Reveal>
      </div>
    </footer>
  );
}
