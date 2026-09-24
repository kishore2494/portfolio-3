import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createField, type FieldHandle } from "./field";
import {
  attentionTargets,
  mazeTargets,
  spacetimeTargets,
  textTargets,
  type TargetBuffer,
} from "./targets";
import { attend, tokenizeSentence } from "../lib/attention";
import { corpus } from "../lib/corpus";
import { generate, train, type MarkovModel } from "../lib/markov";
import { buildMaze, COLS, GOAL, initialBelief, planPath, ROWS, senseInto, START } from "../lib/agent";

export type ChapterId = "entropy" | "time" | "intelligence" | "voice" | "agency";

export const CHAPTER_IDS: ChapterId[] = ["entropy", "time", "intelligence", "voice", "agency"];

type StageApi = {
  active: ChapterId;
  /** 0..1 within the active chapter */
  local: number;
  entropy: number;
  peakEntropy: number;
  reversalAttempts: number;
  voice: {
    model: MarkovModel | null;
    text: string;
    generate: () => void;
  };
  agent: {
    steps: number;
    replans: number;
    done: boolean;
    log: string[];
    running: boolean;
    toggle: () => void;
    reset: () => void;
  };
  attentionNodes: { x: number; y: number; word: string }[];
  setAttentionText: (s: string) => void;
  attentionText: string;
  particleCount: number;
  supported: boolean;
};

const DEFAULT_ATTENTION = "entropy drives the universe toward disorder";

export function useStage(canvasRef: React.RefObject<HTMLCanvasElement>): StageApi {
  const fieldRef = useRef<FieldHandle | null>(null);
  const [supported, setSupported] = useState(true);
  const [particleCount, setParticleCount] = useState(0);

  const [active, setActive] = useState<ChapterId>("entropy");
  const [local, setLocal] = useState(0);

  // --- chapter I: entropy that will not run backwards ------------------------
  const [entropy, setEntropy] = useState(0);
  const peak = useRef(0);
  const [peakEntropy, setPeakEntropy] = useState(0);
  const [reversalAttempts, setReversalAttempts] = useState(0);
  const reversing = useRef(false);

  // --- chapter III: attention ------------------------------------------------
  const [attentionText, setAttentionText] = useState(DEFAULT_ATTENTION);
  const [attentionNodes, setAttentionNodes] = useState<{ x: number; y: number; word: string }[]>([]);
  const attention = useMemo(() => {
    const tokens = tokenizeSentence(attentionText).slice(0, 9);
    if (tokens.length < 2) return null;
    return { tokens, result: attend(tokens) };
  }, [attentionText]);

  // --- chapter IV: the model -------------------------------------------------
  const [model, setModel] = useState<MarkovModel | null>(null);
  const [voiceText, setVoiceText] = useState("");

  // --- chapter V: the agent --------------------------------------------------
  const [mazeSeed, setMazeSeed] = useState(7);
  const maze = useMemo(() => buildMaze(mazeSeed), [mazeSeed]);
  const agentState = useRef({
    pos: { ...START },
    belief: initialBelief(maze),
    path: null as number[] | null,
  });
  const [agentSteps, setAgentSteps] = useState(0);
  const [agentReplans, setAgentReplans] = useState(0);
  const [agentDone, setAgentDone] = useState(false);
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentLog, setAgentLog] = useState<string[]>(["agent initialised"]);

  // Static target sets, computed once.
  const spacetime = useMemo(() => spacetimeTargets(), []);

  // ---------------------------------------------------------------------------
  // Field lifecycle
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let handle: FieldHandle | null = null;
    try {
      handle = createField(canvas);
    } catch (err) {
      console.error("particle field failed:", err);
    }
    if (!handle) {
      setSupported(false);
      return;
    }
    fieldRef.current = handle;
    setParticleCount(handle.particleCount);
    handle.setTarget(null, true); // start as gas

    return () => {
      handle?.destroy();
      fieldRef.current = null;
    };
  }, [canvasRef]);

  // ---------------------------------------------------------------------------
  // Pointer force
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = 1 - (e.clientY / window.innerHeight) * 2;
      fieldRef.current?.setMouse(x * 1.9, y, 1);
    };
    const onLeave = () => fieldRef.current?.setMouse(9, 9, 0);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Scroll -> chapter + local progress
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let ticking = false;

    const read = () => {
      ticking = false;
      const vh = window.innerHeight;
      let best: { id: ChapterId; local: number } | null = null;

      for (const id of CHAPTER_IDS) {
        const el = document.getElementById(id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        // A chapter is "active" while its box straddles the middle of the screen.
        if (r.top <= vh * 0.5 && r.bottom >= vh * 0.5) {
          const span = Math.max(1, r.height - vh);
          best = { id, local: Math.min(1, Math.max(0, -r.top / span)) };
          break;
        }
      }

      if (best) {
        setActive(best.id);
        setLocal(best.local);
      }
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(read);
    };

    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Chapter I — entropy only ever increases. Scrolling back does not undo it.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (active !== "entropy") return;
    const target = local;
    if (target > peak.current + 0.001) {
      peak.current = target;
      setPeakEntropy(target);
    }

    // Count one attempt per gesture, not one per scroll frame — otherwise a
    // single flick upward reads as "you scrolled back up 69 times".
    if (target < peak.current - 0.08) {
      if (!reversing.current) {
        reversing.current = true;
        setReversalAttempts((n) => (n < 99 ? n + 1 : n));
      }
    } else if (target > peak.current - 0.02) {
      reversing.current = false;
    }

    setEntropy(target);
    fieldRef.current?.setDiffuse(peak.current);
  }, [active, local]);

  // ---------------------------------------------------------------------------
  // Chapter transitions — hand the field a new destination
  // ---------------------------------------------------------------------------
  const applyTarget = useCallback((buffer: TargetBuffer | null) => {
    fieldRef.current?.setTarget(buffer);
  }, []);

  useEffect(() => {
    if (!fieldRef.current) return;

    if (active === "entropy") {
      applyTarget(null);
      return;
    }
    if (active === "time") {
      applyTarget(spacetime);
      return;
    }
    if (active === "intelligence") {
      if (attention) {
        const t = attentionTargets(attention.tokens.map((x) => x.word), attention.result.weights);
        setAttentionNodes(t.nodes);
        applyTarget(t.buffer);
      }
      return;
    }
    if (active === "voice") {
      applyTarget(textTargets(voiceText || "Press generate and I will write in his voice."));
      return;
    }
    if (active === "agency") {
      const a = agentState.current;
      applyTarget(mazeTargets(maze, COLS, ROWS, a.pos, GOAL));
    }
  }, [active, applyTarget, spacetime, attention, voiceText, maze]);

  // Live updates while a chapter is already on screen.
  useEffect(() => {
    if (active !== "intelligence" || !attention || !fieldRef.current) return;
    const t = attentionTargets(attention.tokens.map((x) => x.word), attention.result.weights);
    setAttentionNodes(t.nodes);
    fieldRef.current.setTarget(t.buffer);
  }, [attention, active]);

  // ---------------------------------------------------------------------------
  // Chapter IV — train once, then re-form the particles into each new sentence
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const id = window.setTimeout(() => setModel(train(corpus.text, 2)), 120);
    return () => window.clearTimeout(id);
  }, []);

  const runGenerate = useCallback(() => {
    if (!model) return;
    const text = generate(model, { words: 20, temperature: 1 });
    setVoiceText(text);
    if (fieldRef.current) fieldRef.current.setTarget(textTargets(text));
  }, [model]);

  // ---------------------------------------------------------------------------
  // Chapter V — the loop
  // ---------------------------------------------------------------------------
  const say = useCallback((line: string) => {
    setAgentLog((l) => [line, ...l].slice(0, 5));
  }, []);

  const stepAgent = useCallback(() => {
    const a = agentState.current;
    if (a.pos.x === GOAL.x && a.pos.y === GOAL.y) return;

    const revealed = senseInto(a.belief, maze, a.pos);
    if (revealed) say(`sense · ${revealed} cells`);

    if (a.path && a.path.some((i) => a.belief[i] === 1)) {
      a.path = null;
      setAgentReplans((r) => r + 1);
      say("reflect · evidence contradicts the plan");
    }

    if (!a.path || a.path.length < 2) {
      a.path = planPath(a.belief, a.pos);
      if (a.path) say(`plan · ${a.path.length - 1} steps`);
      else say("plan · no route through what I believe");
    }

    if (a.path && a.path.length > 1) {
      const next = a.path[1];
      const nx = next % COLS;
      const ny = (next / COLS) | 0;
      if (maze[next] === 1) {
        a.belief[next] = 1;
        a.path = null;
        setAgentReplans((r) => r + 1);
        say("act · blocked");
      } else {
        a.pos = { x: nx, y: ny };
        a.path = a.path.slice(1);
        setAgentSteps((s) => s + 1);
        if (nx === GOAL.x && ny === GOAL.y) {
          setAgentDone(true);
          setAgentRunning(false);
          say("act · goal reached");
        }
      }
    }

    fieldRef.current?.updateCurrent(mazeTargets(maze, COLS, ROWS, a.pos, GOAL));
  }, [maze, say]);

  useEffect(() => {
    if (!agentRunning || active !== "agency" || agentDone) return;
    const id = window.setInterval(stepAgent, 210);
    return () => window.clearInterval(id);
  }, [agentRunning, active, agentDone, stepAgent]);

  const resetAgent = useCallback(() => {
    const seed = Math.floor(Math.random() * 9999);
    const m = buildMaze(seed);
    agentState.current = { pos: { ...START }, belief: initialBelief(m), path: null };
    setMazeSeed(seed);
    setAgentSteps(0);
    setAgentReplans(0);
    setAgentDone(false);
    setAgentRunning(false);
    setAgentLog(["agent initialised"]);
    fieldRef.current?.updateCurrent(mazeTargets(m, COLS, ROWS, START, GOAL));
  }, []);

  return {
    active,
    local,
    entropy,
    peakEntropy,
    reversalAttempts,
    voice: { model, text: voiceText, generate: runGenerate },
    agent: {
      steps: agentSteps,
      replans: agentReplans,
      done: agentDone,
      log: agentLog,
      running: agentRunning,
      toggle: () => setAgentRunning((r) => !r),
      reset: resetAgent,
    },
    attentionNodes,
    setAttentionText,
    attentionText,
    particleCount,
    supported,
  };
}
