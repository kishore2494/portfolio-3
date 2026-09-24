import { lazy, Suspense } from "react";
import Opening from "./chapters/Opening";
import { Chapter, DemoFrame, Reveal } from "./components/Chapter";
import ScrollRail from "./components/ScrollRail";
import Closing from "./chapters/Closing";

// Each demo is its own chunk: the opening paints before the simulations load.
const EntropyBox = lazy(() => import("./demos/EntropyBox"));
const BlockUniverse = lazy(() => import("./demos/BlockUniverse"));
const AttentionViz = lazy(() => import("./demos/AttentionViz"));
const VoiceModel = lazy(() => import("./demos/VoiceModel"));
const AgentLoop = lazy(() => import("./demos/AgentLoop"));

const SITE_1 = "https://kishore2494.github.io/personal-site";
const SITE_2 = "https://kishore2494.github.io/personal-site-2";

function DemoFallback() {
  return (
    <div className="flex h-56 items-center justify-center rounded-xl border border-white/10 bg-black/20">
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-600">
        loading simulation…
      </span>
    </div>
  );
}

export const CHAPTERS = [
  { id: "entropy", numeral: "I", title: "Entropy" },
  { id: "time", numeral: "II", title: "Time" },
  { id: "intelligence", numeral: "III", title: "Intelligence" },
  { id: "voice", numeral: "IV", title: "Voice" },
  { id: "agency", numeral: "V", title: "Agency" },
];

export default function App() {
  return (
    <>
      <ScrollRail />
      <Opening />

      <main>
        <Chapter
          id="entropy"
          numeral="I"
          title="Entropy"
          standfirst="The Earth takes in energy from the Sun and radiates almost exactly the same amount back out. So if the books balance, what are we actually living on? Not energy. Order."
          source={{
            title: "The Universe's Secret Driver: Why Everything Happens",
            href: `${SITE_2}/articles/universe-secret-driver-why-everything-happens`,
          }}
        >
          <Suspense fallback={<DemoFallback />}>
            <DemoFrame
              label="live simulation"
              note="900 particles · Shannon entropy over a 12×12 grid"
            >
              <EntropyBox />
            </DemoFrame>
          </Suspense>

          <Reveal>
            <p className="prose-line mt-8 max-w-2xl">
              There is no force pushing those particles apart. Each one just moves. Spreading out
              simply has overwhelmingly more ways to happen than staying in the corner, so it wins —
              every time, without anything intending it. That statistical landslide is the closest
              thing the universe has to a purpose, and it is the reason the next four chapters are
              possible at all.
            </p>
          </Reveal>
        </Chapter>

        <Chapter
          id="time"
          numeral="II"
          title="Time"
          standfirst="We feel time move. But the physics does not obviously agree: every moment may sit in the block already, finished, and the only thing that travels is our attention."
          source={{
            title: "The Universe is a Movie Where Every Frame Exists Forever",
            href: `${SITE_2}/articles/universe-movie-every-frame-exists-forever`,
          }}
        >
          <Suspense fallback={<DemoFallback />}>
            <DemoFrame
              label="precomputed spacetime"
              note="rule 110 · 340 moments, all evaluated before you arrived"
            >
              <BlockUniverse />
            </DemoFrame>
          </Suspense>

          <Reveal>
            <p className="prose-line mt-8 max-w-2xl">
              Chapter I gave time a direction — entropy only climbs. This chapter takes away the
              travelling. Both can be true: the block is fixed, and the arrow inside it still points
              one way. What we call the present is a reading position.
            </p>
          </Reveal>
        </Chapter>

        <Chapter
          id="intelligence"
          numeral="III"
          title="Intelligence"
          standfirst="Then something in the block started modelling the rest of it. The mechanism that made modern machine intelligence work is smaller than people expect: decide what to look at, and look at it."
          source={{
            title: "The Evolution of RAG: From Static to Self-Aware to Agentic",
            href: `${SITE_2}/articles/evolution-rag-static-self-aware-agentic`,
          }}
        >
          <Suspense fallback={<DemoFallback />}>
            <DemoFrame
              label="real attention math"
              note="softmax(QKᵀ/√d)V · vectors from my corpus, not a trained transformer"
              footer={
                <>
                  Honest about what this is: there are no learned projection matrices here, because
                  there is no trained transformer behind this page. Q = K = V = word vectors built
                  from PPMI co-occurrence across my articles, so the weights are softmaxed cosine
                  similarity. The arithmetic is exactly the real operation; the vectors are corpus
                  statistics rather than gradient-descended parameters.
                </>
              }
            >
              <AttentionViz />
            </DemoFrame>
          </Suspense>
        </Chapter>

        <Chapter
          id="voice"
          numeral="IV"
          title="Voice"
          standfirst="A model is a compression of what it has read. This one has read nothing but me — 32 essays, and not a single other word. It trains in your browser, in milliseconds, when you press the button."
          source={{
            title: "Building a 2.54M Parameter Small Language Model with Python",
            href: `${SITE_2}/articles/building-2-54m-parameter-small-language-model-python`,
          }}
        >
          <Suspense fallback={<DemoFallback />}>
            <DemoFrame
              label="trains on your device"
              note="word-level n-gram Markov chain — not a neural network"
              footer={
                <>
                  This is an n-gram model, not a transformer, and it would be dishonest to dress it
                  up as one. It has no understanding. What it does have is my vocabulary and my
                  sentence rhythms, because that is the only text it has ever seen — which is
                  precisely what makes the output recognisable.
                </>
              }
            >
              <VoiceModel />
            </DemoFrame>
          </Suspense>
        </Chapter>

        <Chapter
          id="agency"
          numeral="V"
          title="Agency"
          standfirst="The last step is wanting something. An agent is not a clever answer — it is a loop that survives being wrong, which is the only condition it will ever actually operate in."
          source={{
            title: "I Stopped Prompting My Agent and Started Designing Its Loop",
            href: `${SITE_2}/articles/i-stopped-prompting-my-agent-and-started-designing-its-loop`,
          }}
        >
          <Suspense fallback={<DemoFallback />}>
            <DemoFrame
              label="live agent"
              note="breadth-first planning under partial observability · no LLM"
              footer={
                <>
                  The agent sees two cells in every direction and assumes everything beyond that is
                  walkable. So its plan is confidently wrong, it walks into a wall, updates what it
                  believes, and plans again. Watch the replan counter: that number is the demo. No
                  language model is involved — this is a plain sense/plan/act loop.
                </>
              }
            >
              <AgentLoop />
            </DemoFrame>
          </Suspense>

          <Reveal>
            <p className="prose-line mt-8 max-w-2xl">
              Entropy gave the universe a direction. Time gave it a shape. Attention let a part of it
              model the rest. And a loop that tolerates being wrong turns all of that into something
              that acts. That is the whole engine — and it is what I build with.
            </p>
          </Reveal>
        </Chapter>
      </main>

      <Closing site1={SITE_1} site2={SITE_2} />
    </>
  );
}
