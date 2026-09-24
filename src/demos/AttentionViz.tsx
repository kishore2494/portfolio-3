import { useMemo, useState } from "react";
import { attend, tokenizeSentence } from "../lib/attention";
import { nearest } from "../lib/corpus";

const PRESETS = [
  "entropy drives the universe toward disorder",
  "the agent plans an action then observes the world",
  "ollama runs the model locally on my own machine",
  "retrieval gives the language model real context",
];

function heat(w: number, max: number): string {
  const t = max > 0 ? Math.min(1, w / max) : 0;
  // Dim slate -> signal cyan, with alpha carrying most of the signal.
  return `rgba(52, 211, 255, ${(0.06 + t * 0.9).toFixed(3)})`;
}

export default function AttentionViz() {
  const [text, setText] = useState(PRESETS[0]);
  const [focus, setFocus] = useState<number | null>(null);

  const result = useMemo(() => {
    const tokens = tokenizeSentence(text);
    return tokens.length ? attend(tokens) : null;
  }, [text]);

  const neighbours = useMemo(() => {
    if (!result || focus === null) return [];
    const tok = result.tokens[focus];
    return tok?.known ? nearest(tok.word, 5) : [];
  }, [result, focus]);

  const rowMax = useMemo(() => {
    if (!result) return [];
    return result.weights.map((row) => Math.max(...row));
  }, [result]);

  const unknown = result?.tokens.filter((t) => !t.known).length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <label htmlFor="attn-input" className="eyebrow">
          Type a sentence
        </label>
        <input
          id="attn-input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setFocus(null);
          }}
          spellCheck={false}
          className="mt-3 w-full rounded-xl border border-white/12 bg-black/40 px-4 py-3
                     font-mono text-sm text-slate-100 outline-none transition-colors
                     placeholder:text-slate-600 focus:border-signal-400/60"
          placeholder="attention is all you need"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => {
                setText(p);
                setFocus(null);
              }}
              className="rounded-full border border-white/10 px-3 py-1 font-mono text-[10px]
                         text-slate-400 transition-colors hover:border-signal-400/50 hover:text-signal-300"
            >
              {p.split(" ").slice(0, 3).join(" ")}…
            </button>
          ))}
        </div>
      </div>

      {result && result.tokens.length > 1 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-1 text-center">
              <caption className="sr-only">
                Attention weights: each row shows how one word attends to every other word
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="w-24" />
                  {result.tokens.map((t, j) => (
                    <th
                      key={j}
                      scope="col"
                      className="px-1 pb-1 font-mono text-[10px] font-normal text-slate-500"
                    >
                      <span className="block max-w-[4.5rem] truncate">{t.word}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.weights.map((row, i) => (
                  <tr key={i}>
                    <th
                      scope="row"
                      onMouseEnter={() => setFocus(i)}
                      onFocus={() => setFocus(i)}
                      tabIndex={0}
                      className={`cursor-default whitespace-nowrap pr-2 text-right font-mono text-[11px]
                                  transition-colors ${
                                    focus === i ? "text-signal-300" : "text-slate-400"
                                  } ${result.tokens[i].known ? "" : "line-through opacity-50"}`}
                    >
                      {result.tokens[i].word}
                    </th>
                    {row.map((w, j) => (
                      <td key={j} className="p-0">
                        <div
                          title={`${result.tokens[i].word} → ${result.tokens[j].word}: ${(w * 100).toFixed(1)}%`}
                          className="h-7 w-full rounded-[3px] transition-transform duration-150"
                          style={{
                            background: heat(w, rowMax[i]),
                            transform: focus === i ? "scaleY(1.12)" : "none",
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/25 p-4">
              <p className="eyebrow">What the sentence looks at most</p>
              <ul className="mt-3 space-y-2">
                {result.tokens
                  .map((t, i) => ({ word: t.word, score: result.received[i], known: t.known }))
                  .sort((a, b) => b.score - a.score)
                  .slice(0, 4)
                  .map((t) => (
                    <li key={t.word} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 truncate font-mono text-xs text-slate-300">
                        {t.word}
                      </span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
                        <span
                          className="block h-full rounded-full bg-signal-400"
                          style={{ width: `${Math.min(100, t.score * 100 * result.tokens.length)}%` }}
                        />
                      </span>
                    </li>
                  ))}
              </ul>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/25 p-4">
              <p className="eyebrow">
                {focus !== null ? `Nearest to “${result.tokens[focus].word}”` : "Hover a row"}
              </p>
              {focus !== null && neighbours.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {neighbours.map((n) => (
                    <li
                      key={n.word}
                      className="rounded-full border border-white/10 px-2.5 py-1 font-mono text-[11px] text-slate-300"
                    >
                      {n.word}
                      <span className="ml-1.5 text-slate-600">{n.score.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="prose-line mt-3">
                  Hover any row to see which words sit closest to it in the vector space built from
                  my articles.
                </p>
              )}
            </div>
          </div>

          {unknown > 0 && (
            <p className="font-mono text-[11px] text-ember-300/80">
              {unknown} word{unknown > 1 ? "s" : ""} struck through — not in the corpus vocabulary,
              so {unknown > 1 ? "they carry" : "it carries"} no vector and attend{unknown > 1 ? "" : "s"} flat.
            </p>
          )}
        </>
      ) : (
        <p className="prose-line">Type at least two words.</p>
      )}
    </div>
  );
}
