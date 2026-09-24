# The Engine of Everything — Portfolio 3

A scroll-driven essay in five chapters, where every idea ends in something you can run.

**Live:** https://kishore2494.github.io/portfolio-3/

| Chapter | Source essay | Demo |
|---|---|---|
| I · Entropy | The Universe's Secret Driver | 900 particles; Shannon entropy measured live over a 12×12 grid |
| II · Time | The Universe is a Movie… | Rule 110 spacetime, fully precomputed — "now" is just a highlighted row |
| III · Intelligence | The Evolution of RAG | Real `softmax(QKᵀ/√d)V` over vectors built from the corpus |
| IV · Voice | Building a 2.54M Parameter SLM | An n-gram model trained in your browser on 32 essays |
| V · Agency | I Stopped Prompting My Agent… | Sense → plan → act → reflect under partial observability |

Everything computes client-side. No backend, no API key, no telemetry, no running cost.

## What is and is not real

The demos are honest about their own nature, because the alternative undercuts the point:

- **Chapter III** computes genuine scaled dot-product attention, but there are no *learned*
  projection matrices — Q = K = V = word vectors, so the weights are softmaxed cosine similarity.
  The vectors come from PPMI co-occurrence statistics over the corpus, not gradient descent.
- **Chapter IV** is a word-level Markov chain, not a transformer. It has no understanding. What it
  has is a training set consisting solely of Kishore's writing.
- **Chapter V** involves no language model. It is a plain BFS planner over a belief map.

## Architecture

```
scripts/vendor-content.mjs   copy articles from personal-site-2 into content/
scripts/build-corpus.mjs     -> src/generated/corpus.json  (prose + vocab + int8 vectors)
src/lib/                     corpus decode, markov, attention
src/demos/                   one lazy-loaded chunk per simulation
src/chapters/, src/App.tsx   the narrative
```

`corpus.json` is generated, not committed. `prebuild` regenerates it, so CI needs only
`content/articles/` — which `vendor-content.mjs` keeps in sync.

## Develop

```bash
npm install
npm run dev              # builds the corpus, then serves
npm run build            # type-check + bundle
npm run preview
node scripts/vendor-content.mjs   # after publishing new writing
```

## Deploy

Push to `main`. GitHub Actions builds and publishes to Pages.

To move to a custom domain later, set `BASE=/` and update the canonical URL in `index.html`.
