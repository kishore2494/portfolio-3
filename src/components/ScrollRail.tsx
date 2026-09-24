import { useEffect, useState } from "react";
import { CHAPTERS } from "../App";

/** Fixed chapter rail + a thin reading-progress bar across the top. */
export default function ScrollRail() {
  const [active, setActive] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      setProgress(max > 0 ? doc.scrollTop / max : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sections = CHAPTERS.map((c) => document.getElementById(c.id)).filter(
      (el): el is HTMLElement => el !== null
    );
    if (!sections.length || typeof IntersectionObserver === "undefined") return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { threshold: [0.2, 0.5], rootMargin: "-20% 0px -40% 0px" }
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, []);

  return (
    <>
      <div
        className="fixed inset-x-0 top-0 z-50 h-[2px] origin-left bg-signal-400/80"
        style={{ transform: `scaleX(${progress})` }}
        aria-hidden
      />

      <nav
        aria-label="Chapters"
        className="fixed right-5 top-1/2 z-40 hidden -translate-y-1/2 lg:block"
      >
        <ul className="space-y-3">
          {CHAPTERS.map((c) => {
            const on = active === c.id;
            return (
              <li key={c.id}>
                <a
                  href={`#${c.id}`}
                  className="group flex items-center justify-end gap-2.5"
                  aria-current={on ? "true" : undefined}
                >
                  <span
                    className={`font-mono text-[10px] uppercase tracking-[0.16em] transition-all ${
                      on
                        ? "text-signal-300 opacity-100"
                        : "text-slate-600 opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    {c.title}
                  </span>
                  <span
                    className={`block h-px transition-all ${
                      on ? "w-7 bg-signal-400" : "w-3.5 bg-slate-700 group-hover:w-5"
                    }`}
                  />
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
