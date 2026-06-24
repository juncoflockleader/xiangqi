# Xiangqi Engine + Teaching App — Roadmap & Direction

_Last updated: 2026-06-23_

This document steers the project toward two stated goals:

1. **Teaching** — give genuinely good reasonings, advice, and branches.
2. **Strength** — be close to Pikafish, or at minimum stronger than human grandmasters.

It starts with an honest diagnosis of where the code is today, then proposes a
redirected plan.

---

## 1. Diagnosis: where we actually are

### What's strong
- **Search is real.** Both the JS engine (`src/search.js`, ~4k lines) and the C++
  engine (`native/xiangqi_native.cpp`) implement a modern search stack: PVS,
  iterative deepening, aspiration windows, null-move, LMR, futility/reverse-futility,
  razoring, ProbCut, SEE pruning, singular extensions, killer/history/continuation
  ordering, quiescence with delta pruning, TT. This is genuinely competitive
  search engineering.
- **Move generation is correct** (JS side has perft validation).
- **The explanation layer is unusually rich** for a hobby engine: PV traces,
  candidate lines, tactical motifs (fork/pin/skewer/discovered check), pressure
  analysis, mistake classification, progressive hints, lesson cards, Chinese
  notation (`炮二平五`). This is the real differentiator.

### The core problem
**Effort is being spent on the lever that moves neither goal.**

- `timedOpeningRootBonus()` in `native/xiangqi_native.cpp` is a hand-maintained
  `if (position == FEN_X) return bonus` chain spanning **lines ~6,645 → ~15,244**
  — roughly **8,600 of the file's 16,236 lines (>50%)**. It hardcodes Pikafish's
  preferred move in **1,467 specific positions** (1,660 move→bonus entries).
- `src/book.js` mirrors this with **500 hardcoded entries across 170 positions**.
- The git log shows **43+ commits** of "Tune engine priors for random oracle N"
  (numbered into the 1800s), each adding 30–40 more hardcoded positions.

This approach has three fatal limits for the stated goals:

1. **It only helps in the exact memorized positions.** A 1,467-entry lookup is a
   rounding error against Xiangqi's ~10⁴⁸ positions. The first time the opponent
   deviates (move ~8–12), you're back to the raw engine. Games are won and lost
   in the middlegame and endgame — which this work does not touch at all.
2. **It is not measured.** There is **no Elo, no match-play, no win/loss/draw
   tracking** anywhere in the repo. `compareEngineToOracle()` measures
   *per-position centipawn agreement with Pikafish on ~16 benchmark positions* —
   not playing strength. You can agree with Pikafish on every opening move and
   still lose every game. **We do not currently know how strong the engine is.**
3. **It does not scale.** 8,600 lines of generated `if`/`return` is unmaintainable,
   bloats the binary, and slows compilation. An opening book belongs in a *data
   file* loaded at runtime, not in source code.

### Strength reality check (be precise about the target)
- **Human GM ≈ 2600 Elo.** **Pikafish ≈ 3200+ Elo.** These are very different bars.
- **"Stronger than GMs" is achievable without a neural net.** A well-tuned
  hand-crafted-eval (HCE) engine with this search stack, fast move generation, and
  a few seconds/move can realistically reach ~2600–2800. (Stockfish's HCE was
  ~3400 in chess before NNUE.) The blockers here are: eval quality is hand-tuned
  but **never validated**, move generation is mailbox (slow), and effort went to
  opening hardcoding instead.
- **"Close to Pikafish" effectively requires NNUE.** Pikafish's strength *is* its
  trained network. No HCE engine is close. Reaching that tier means committing to
  a data-generation + network-training pipeline.

---

## 2. Strategic direction

Two tracks, run in parallel. **Track A makes strength real and measurable;
Track B makes teaching genuinely good.** The teaching app is the product; the
engine is the means.

### Decision that gates Track A scope
How far do we push the *self-owned* engine?

- **Option 1 — "Beat GMs" with HCE (pragmatic).** Stop here for engine R&D. Make
  the HCE engine measurably ~2600–2800 via measurement + real eval tuning + speed.
  Months, not years. Good enough for the teaching goal.
- **Option 2 — "Approach Pikafish" with NNUE (ambitious).** Everything in Option 1,
  then build an NNUE pipeline. Large, multi-month R&D effort.
- **Option 3 — Pikafish is the analysis backend; we own the teaching layer.**
  Pikafish is GPLv3 and already installed (`.engines/pikafish/Pikafish-2026-01-02`).
  Use it for ground-truth analysis; keep our engine as a lightweight always-on
  fallback. Fastest path to a great *product*; "self-owned engine" becomes
  decoupled R&D rather than a release dependency.

These are not mutually exclusive — Option 3 can ship the product now while
Option 1/2 proceed as R&D. The recommendation below assumes we want a real
self-owned engine (Option 1 as the committed floor, Option 2 as aspiration) **and**
use Pikafish as the oracle/teaching backend in the meantime (Option 3 for shipping).

---

## 3. Track A — Engine strength (measurable)

### A0. Stop the bleeding (immediate)
- **Freeze the "random oracle priors" commit loop.** It is not improving strength.
- Move the opening book **out of source code into a data file**: serialize the
  useful (position → ranked moves + scores) entries to a binary/JSON book keyed by
  Zobrist hash, loaded at engine init. Delete `timedOpeningRootBonus()`'s 8,600-line
  chain. Target: shrink `xiangqi_native.cpp` from ~16k to ~7–8k lines.
- Keep the *good* extracted data — just store it as data, and make the book
  generator a script, not hand-commits.

### A1. Measurement harness — ✅ COMPLETE (2026-06-24)
Nothing else on the NNUE path is verifiable without this; it is the fitness
function the whole effort optimizes against. All four pillars are now in place.

- **✅ Engine-vs-engine match runner with Elo.** `src/match.js`
  (+ `examples/match.mjs`, `npm run match`, `test/match.test.js`, 9 tests).
  Alternating colors over a seeded diverse opening suite; books each game W/L/D;
  reports Elo(A−B) with 95% margin + likelihood-of-superiority. Built on
  `runSparringMatch`.
  - **✅ SPRT early-stopping** (`computeSprt`, `--sprt e0,e1[,α,β]`): stops as soon
    as H0/H1 is accepted, with a `minGames` guard against tiny-sample noise.
  - **✅ JSON result persistence** (`--out FILE`) for tracking strength over time.
  - **✅ Per-side handicap** (`--a-depth/-time`, `--b-depth/-time`, `--a-elo/--b-elo`
    via UCI_LimitStrength) so Pikafish can be throttled to a gradient.
  - **✅ Material-based adjudication** of unfinished games (`adjudicateMaterialCp`,
    default 300cp) — a decisive but unconcluded game is no longer silently drawn.
  - **Baseline:** native C++ beats the JS engine decisively — latest run **8–0** at
    200ms/move, SPRT accepting "native > JS by >50 Elo" at the 8-game minimum.
    (Native perft depth-4 is ~30× faster than JS: 35ms vs 1063ms.)
- **✅ Native perft suite.** Added a `perft N` command to
  `native/xiangqi_native.cpp` (`runPerft`/`handlePerft`); `test/native-perft.test.js`
  cross-checks it against `src/perft.js` on startpos (44/1920/79666/3290240) and a
  seeded set of diverse positions. Move generation is now proven correct.
- **✅ Tactics regression suite.** `tactics` suite in `src/benchmark.js`
  (`--suite tactics`, `test/tactics-suite.test.js`): sharp unique-solution
  positions (cannon-over-screen captures, rook wins, forced mate) verified
  solvable from shallow depth. Both JS and native solve 5/5.
- **Remaining (smaller) follow-ups:**
  - Gauntlet vs *handicapped* Pikafish for an *absolute* Elo anchor (the
    `--b-elo` plumbing exists; just needs a scripted sweep).
  - Larger fixed-N matches (≥100 games) when a tight margin is needed.
  - **CI gate:** wire perft (must stay exact) + tactics-solved % + a quick
    self-play Elo sanity match into the test run.

### A2. Speed — ⚠️ COURSE-CORRECTED (2026-06-24): movegen is NOT the bottleneck
**Measured, not assumed.** Native search ≈ 1.48M nps, but pure perft (movegen +
legality) ≈ **89M nodes/sec** — movegen is ~60× faster than search throughput. A
`sample` profile shows `evaluateRed` + its per-piece lambda dominate (~50% of leaf
samples), then move ordering, then quiet-check generation. **A bitboard movegen
rewrite — the original A2 plan — would buy almost nothing.** This finding alone
saved weeks of misdirected effort and is the main A2 deliverable.
- **The bottleneck is evaluation.** But A4 (NNUE) *replaces* the eval, so heavy
  HCE-eval speed work is largely throwaway. Verdict: do not deep-optimize the HCE;
  invest in A4.
- **Lazy evaluation, done right (kept).** The cheap baseline
  (`materialScore+positionalScore+guardPairScore`) is already incremental, so a
  windowed lazy fast-path skips the expensive positional terms when the score is
  decided. Margin = 800cp (measured max |positional| = 565, ~40% headroom → sound).
  - **The harness caught a trap:** applying lazy to the *interior* static eval
    regressed **−88 Elo** (it corrupts the "improving"/trend heuristic). Applying
    it to **qsearch stand-pat only** is sound and neutral-to-positive (+66 ± 112,
    LOS 87%), ~4% nps (1.48M→1.54M). Kept qsearch-only. This is exactly why every
    change is A/B'd against the harness.
- Remaining (low priority, deferred behind A4): micro-opt the hottest eval terms;
  if ever needed, revisit movegen only after eval is no longer dominant.

### A3. Evaluation tuning — ✅ PIPELINE BUILT; HCE retune deferred (2026-06-24)
- **Texel tuning pipeline (kept):** `src/tuning.js` (`materialEval`, `winExpectancy`,
  `texelLoss`, `findOptimalK`, `tunePieceValues` with L2-toward-priors regularization,
  `buildTuningDataset`), data-gen via `runEngineMatch({collectPositions})`, CLI
  `examples/tune.mjs` (`npm run tune`), `test/tuning.test.js` (6 tests). Unit tests
  prove the optimizer recovers a deliberately-mistuned value from clean synthetic
  data.
- **Finding (do NOT ship a retune yet):** on ~3.7k positions from native self-play,
  the tuner with no regularization *overfits* (horse value collapses to ~1.4 pawns);
  with regularization the values stay plausible (and hint advisors/elephants are
  mildly *under*valued), but the **held-out test loss gets worse** (0.1205 vs
  baseline 0.1140) — the fit does **not generalize**. So the current piece values
  are already near-optimal for this eval; changing them would risk a regression.
  The harness's holdout check caught the overfit, mirroring the A2 lazy-eval catch.
- **Why low ROI now:** equal-engine self-play is drawish + material-balanced → low
  material variance → reliable HCE material tuning needs ~100k+ positions and more
  decisive games (hours of self-play), and the eval is replaced by A4 anyway.
- **Reusable for A4:** the `collectPositions` data-gen + dataset-builder are exactly
  the position-harvesting NNUE training needs. Tuning energy now flows to A4.

### A4. NNUE — ✅ PIPELINE BUILT END-TO-END; strength gated on data (2026-06-24)
The full train→export→infer→play loop works and is correctness-verified. What's
missing for strength is **data scale**, not the machinery.
- **JS trainer + evaluator (`src/nnue.js`, `test/nnue.test.js`):** piece-square
  features (red POV, 2×7×90 = 1260) → 1 hidden layer (clipped ReLU) → scalar cp.
  Forward/backward with Adam + L2, serialize (JSON + flat text), 5 unit tests
  (learns a material target, round-trips, forward/eval consistent).
- **Training CLI (`examples/nnue-train.mjs`, `npm run nnue:train`):** self-play
  data-gen (reuses `collectPositions`), train, and a **held-out viability test**
  (does the learned eval beat tuned material-only?), with dataset caching
  (`--save-data`/`--data`) for fast hyperparameter iteration.
- **C++ inference (`native/xiangqi_native.cpp`):** `nnueEvalRed` + `loadNnueFile`,
  behind off-by-default UCI options `UseNnue` / `NnueFile`; HCE path untouched
  (102 native tests + perft still green). **Cross-check: C++ eval == JS eval
  bit-exact (max diff 0cp over 9 positions)** — the "perft of NNUE". Feature
  index + square numbering verified identical to the trainer, so JS-trained
  weights run unchanged in the engine.
- **Honest result at current scale:** trained on ~4.6k self-play positions the net
  *overfits* (train loss → 0, held-out loss ≫ material) and loses **0–12 to the
  HCE** (−800 Elo). The pipeline is proven; the net is starved of data.
- **Path to strength (the remaining work, in order):**
  1. **Data, by 2–3 orders of magnitude** (100k–10M positions). Generate offline
     in bulk; label with a **teacher eval** (Pikafish/deep search score) blended
     with game result, not result alone — far less label noise.
  2. **Bigger feature set + net:** king-bucketed (HalfKA-style) features; hidden
     256–512. Add dropout/weight-decay tuned via the held-out test.
  3. **Incremental accumulator** in make/unmake (the first layer is a sum over
     active features — update by add/remove on the moved piece) + int16
     quantization + SIMD, so NNUE eval is as fast as (or faster than) the HCE.
  4. **A/B every step** with the match harness; ship only on a positive SPRT.
- This remains the only route to genuinely approaching Pikafish; it is now a
  data+compute problem on top of a working, verified pipeline.

---

## 4. Track B — Teaching quality (the product)

The explanation layer today is **competent rule-based NLG**: it accurately states
tactics ("wins a rook cleanly", "gives check", "safe capture") and restates eval
deltas ("improves mobility by 30 centipawns"). But it lacks strategic narrative,
explains variations as bare move lists, has no learner adaptation, and offers thin
"why-not" reasoning. It's a strong *annotation* system, a weak *pedagogy* system.

### B1. Strategic narrative via LLM-over-engine-facts (highest leverage)
- We are building a *teaching* app and have LLMs available. The right division of
  labor: **the engine supplies ground-truth structured facts** (PV, candidate
  lines with scores, motifs, eval-term deltas, pressure, threats, mistake class,
  confidence); **an LLM turns them into genuine coaching prose** — explaining
  *why* mobility/king-safety/coordination matters *in this position*, narrating
  variations move-by-move, and adapting tone to skill level.
- Because the engine constrains the facts, the LLM can't hallucinate chess
  content — it explains, it doesn't invent. This directly delivers "good reasonings
  and advice."
- Keep the existing template NLG as the offline/no-LLM fallback.

### B2. Narrated branches & deeper why-not
- Turn PV move lists into narrated lines: "After R e9-e2, Black's rook must move
  (e0-f0); then e2-e1 keeps the rook and the check." (`src/plan-comparison.js` and
  `src/reasoning.js` already have the scaffolding.)
- For each top alternative, generate *why a human would consider it* and *why it's
  worse* — not just the centipawn gap.

### B3. Learner model & curriculum
- Add skill levels (beginner/intermediate/advanced) that change hint depth and
  vocabulary. Today hints are one-size-fits-all (`src/coach.js`).
- Track recurring mistake categories per user (`src/mistakes.js` already classifies
  them) → drive a spaced-repetition queue of `src/lesson.js` cards targeting weak
  areas.
- Order tactical concepts by prerequisite (captures → forks → pins → discovered
  attacks → batteries) into a real curriculum, not isolated positions.

### B4. Endgame- and opening-aware explanations
- Shift vocabulary by phase: "passed-soldier pressure +50cp" should read as "your
  soldier is breaking into the palace" in the endgame. Opening book hits should
  expand the one-line `idea` into real opening principles.

### B5. Full localization
- Move notation is already idiomatic (`炮二平五`). Extend Chinese to the
  explanation/hint/lesson text, not just the UI chrome.

---

## 5. Sequencing (suggested)

| Phase | Track A (Engine) | Track B (Teaching) |
|-------|------------------|--------------------|
| **0 (now)** | Freeze prior-hardcoding loop; move book to data file | — |
| **1** | Native perft + match runner + Elo + tactics suite (A1) | LLM-over-facts narrative prototype (B1) |
| **2** | Bitboard movegen for speed (A2) | Narrated branches + why-not (B2) |
| **3** | Texel/SPSA eval tuning (A3) | Learner model + curriculum + SRS (B3) |
| **4** | (If committed) NNUE pipeline (A4) | Phase-aware + full localization (B4/B5) |

**Phase 1 is the unlock for everything.** Until strength is measured, no engine
change can be called an improvement, and the opening-prior loop will keep consuming
effort with no feedback signal.

---

## 6. Committed scope (decided 2026-06-23)
- **Engine ambition: Approach Pikafish via NNUE (Option 2).** The full path —
  HCE measurement + speed + tuning *and* a data-generation + NNUE training
  pipeline — is committed. This is the only route that genuinely nears Pikafish.
- **First execution: the Phase 1 measurement harness (A1).** Nothing on the NNUE
  path is verifiable without it — perft proves correctness, the match runner gives
  Elo, the tactics suite catches regressions. Build this before any further engine
  changes.

Track B (teaching) proceeds in parallel regardless.

### Why measurement must precede NNUE specifically
An NNUE pipeline is a loop of "generate data → train net → did it get stronger?".
That loop is *useless without a strength signal*. The match runner + tactics suite
are the fitness function the whole NNUE effort optimizes against. Building them
first is not optional overhead — it is the substrate NNUE training runs on.
