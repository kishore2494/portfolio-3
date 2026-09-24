import { useEffect, useRef, useState, type ReactNode } from "react";

export function useInView<T extends HTMLElement>(threshold = 0.25) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold, rootMargin: "0px 0px -8% 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, inView };
}

/** Fades and lifts its children the first time they scroll into view. */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>(0.15);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (inView) setSeen(true);
  }, [inView]);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        seen ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${className}`}
      style={{ transitionDelay: seen ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}

export function Chapter({
  id,
  numeral,
  title,
  standfirst,
  source,
  children,
}: {
  id: string;
  numeral: string;
  title: string;
  standfirst: string;
  source?: { title: string; href: string };
  children: ReactNode;
}) {
  return (
    <section id={id} className="relative scroll-mt-16 py-24 sm:py-32">
      <div className="pad">
        <Reveal>
          <p className="eyebrow">Chapter {numeral}</p>
          <h2 className="mt-3 font-display text-4xl font-bold leading-[1.05] text-white sm:text-6xl">
            {title}
          </h2>
          <p className="lede mt-6 max-w-2xl">{standfirst}</p>
          {source && (
            <a
              href={source.href}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center gap-2 font-mono text-[11px] uppercase
                         tracking-[0.18em] text-slate-500 transition-colors hover:text-signal-300"
            >
              <span aria-hidden>▸</span> from my essay: {source.title}
            </a>
          )}
        </Reveal>

        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
}

/** Frames a demo and states plainly what is actually being computed. */
export function DemoFrame({
  label,
  note,
  children,
  footer,
}: {
  label: string;
  note: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Reveal>
      <figure className="panel overflow-hidden">
        <figcaption
          className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10
                     px-4 py-3 sm:px-5"
        >
          <span className="tag-live">
            <span className="h-1.5 w-1.5 rounded-full bg-signal-400" aria-hidden />
            {label}
          </span>
          <span className="font-mono text-[10px] leading-relaxed text-slate-500">{note}</span>
        </figcaption>
        <div className="p-4 sm:p-6">{children}</div>
        {footer && (
          <div className="border-t border-white/10 px-4 py-3 text-[12px] text-slate-500 sm:px-6">
            {footer}
          </div>
        )}
      </figure>
    </Reveal>
  );
}
