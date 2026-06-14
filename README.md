# Xiangqi

An early Chinese chess learning-app foundation focused on the engine layer.

The current engine is dependency-free JavaScript and includes:

- Full Xiangqi board representation and FEN parsing.
- Legal move generation for generals, advisors, elephants, horses, rooks, cannons, and pawns.
- Check detection, flying-general rules, and make/unmake-style immutable position updates.
- Iterative-deepening negamax search with alpha-beta and principal variation search.
- Zobrist hashing, bounded depth-preferred transposition table, aspiration windows, quiescence search with bounded quiet-check search and delta pruning, capture/check/positive and negative history/countermove/root-score-based move ordering, mate-distance pruning, bounded check and recapture extensions, static-exchange pruning, ProbCut capture pruning, shallow razoring, guarded null-move pruning, shallow futility pruning, late-move reductions, repetition diagnostics, and root candidate analysis.
- Explainable opening-book support with a curated early repertoire, heuristic fallback for off-book opening positions, deterministic selection, and pure-search opt-out.
- Evaluation terms for material, piece-square placement, mobility, threats, pawn progress, king safety, blocked-horse coordination, and rook/cannon line pressure.
- Static exchange analysis for distinguishing clean wins, tactically poisoned captures, and defended captures that remain sound after recaptures.
- Immediate pressure/threat analysis for both sides.
- Perft helpers for validating move generation while the engine grows.
- Explainable move output for learning-app use cases, including structured confidence, depth-by-depth search trace, best-move stability, alternative-line verdicts, expected replies, why-not reasons, and draw-assumed repetition notes.
- Progressive coach hints that can reveal an idea, tactical clue, candidate focus, and full best-move reasoning.
- Player-move review with centipawn loss, best-line comparison, and lesson-ready reasons.
- Whole-game review with side summaries, opening-book matches, and key learning moments.
- Lesson-plan generation that turns reviewed games into prompt, hint, and answer cards.
- Position-study bundles that combine best move, candidate lines, hints, pressure, optional move review, and oracle evidence for UI screens.
- Game-history helpers for play sessions, reviewed move logs, engine decision logs, position history, repeated-position detection with cycle/check diagnostics, and async native-backend play.
- A backend adapter contract and async UCI/UCCI process wrapper so the JS reference engine can sit beside a native C++/WASM engine without changing the learning-app API.
- Named engine profiles for fast play, balanced play, deeper analysis, and native UCI/UCCI analysis setups.
- Shared time-control budgeting for fixed movetime and clock-based `wtime`/`btime`/increment searches, with phase-aware moves-to-go estimates, soft-stop management, low-clock caps, and configurable move overhead.
- Starter benchmark positions for opening, tactical, and forcing-search regressions.
- A minimal UCCI-style protocol adapter for GUI/app integration and engine smoke testing.

## Quick Start

```sh
npm run play
npm run study
node examples/engine-demo.mjs
node examples/benchmark.mjs
node examples/oracle-benchmark.mjs --help
node examples/oracle-opening.mjs --help
node examples/sparring.mjs --plies 12
node examples/native-probe.mjs --help
node examples/perft.mjs 2
node bin/xiangqi-ucci.mjs
npm test
```

For an interactive terminal game, run `npm run play`. The default demo lets you play
red against the fast JavaScript engine; use `npm run play -- --side black`,
`--depth 3`, `--time 1500`, `--book ./oracle-opening-book.json`, or `--no-book`
to experiment. Moves use coordinate notation such as `h9-g7` or `h9g7`, and the
`hint`, `best`, and `why` commands show the learning-oriented explanation layer
while you play.

For a one-position learning report, run `npm run study`. It prints the best move,
candidate lines, progressive hints, pressure, and an optional review of a move
you are considering:

```sh
npm run study -- --fen "4k4/9/4r4/9/9/9/9/9/9/3KR4 r" \
  --move e9-f9 \
  --depth 2 \
  --time 1000
```

Use `--json` to get the same study bundle as machine-readable data for a UI
prototype, and pass the same native/oracle flags as the play demo when you want
stronger analysis:

```sh
npm run study -- \
  --engine-command /path/to/pikafish \
  --engine-protocol uci \
  --engine-option EvalFile=/path/to/pikafish.nnue \
  --oracle-command /path/to/pikafish \
  --oracle-protocol uci \
  --json
```

The same demo can play through a native UCI/UCCI engine, with JavaScript fallback
by default:

```sh
npm run play -- --side black \
  --engine-command /path/to/pikafish \
  --engine-protocol uci \
  --engine-option Threads=4 \
  --engine-option Hash=512 \
  --engine-option EvalFile=/path/to/pikafish.nnue
```

Or keep the fast local engine for move choice while a stronger oracle grades
engine picks and player move reviews:

```sh
npm run play -- --side black \
  --oracle-command /path/to/pikafish \
  --oracle-protocol uci \
  --oracle-depth 8 \
  --oracle-time 3000
```

## API Sketch

```js
import { createEngine, createInitialPosition } from "./src/index.js";

const position = createInitialPosition();
const engine = createEngine({ profile: "balanced" });
const result = engine.chooseMove(position);

console.log(result.bestMove.notation);
console.log(result.explanation.summary);
console.log(result.explanation.confidence.level);
console.log(result.explanation.linePlan.summary);
```

`chooseMove` returns the selected legal move, search score, principal variation, root candidates, selective-search stats, per-depth iteration trace, and a learning-friendly explanation. The explanation is based on engine-visible facts such as search score, tactical features, evaluation deltas, best-move stability across depths, and comparison against alternatives. `explanation.alternatives` includes verdicts, centipawn loss, expected replies, motifs, and concise reasons explaining why each candidate is better or worse than the top line. `explanation.confidence` gives the UI a structured score, level, label, and factor list derived from depth, candidate gaps, stability, timeout status, or opening-database evidence. `explanation.linePlan` turns the principal variation into a teaching plan with the first move, expected reply, continuation moves, tactical motifs, and score-by-ply annotations from the root side's perspective.

For a learning-app screen, ask for a position study instead of stitching several
engine calls together:

```js
const study = engine.studyPosition(position, {
  lines: 3,
  depth: 3,
  timeLimitMs: 1000,
  playedMove: "h7-e7" // optional player move to review
});

console.log(study.summary);
console.log(study.bestMove);
console.log(study.hints.map((hint) => hint.text));
console.log(study.candidateLines.map((line) => [line.move, line.scoreText]));
console.log(study.playedMoveReview?.classification);
```

`studyPosition` returns one UI-ready bundle with the selected move, explanation,
candidate lines, progressive hints, pressure/threat summary, optional played-move
review, and any oracle-review evidence attached by the active backend.

For a full played game, ask for a game study. It reuses the review pipeline,
turns key moments into lesson cards, and attaches deeper position studies for
the most important decisions:

```js
const gameStudy = engine.gameStudy(["h7-e7", "h0-g2", "h9-g7"], {
  maxPositionStudies: 2,
  reviewOptions: { depth: 2, timeLimitMs: 1000 },
  studyOptions: { lines: 3, depth: 2, timeLimitMs: 1000 },
  lessonOptions: { maxCards: 3 }
});

console.log(gameStudy.summary);
console.log(gameStudy.lessonPlan.cards[0]?.prompt);
console.log(gameStudy.positionStudies[0]?.summary);
```

`gameStudy` returns the full move review, compact key moments, lesson cards,
position-study bundles for selected plies, final FEN, and next-step prompts so a
learning UI can move from game recap into focused practice.

You can also generate the same artifact from the command line, which is handy
after online sparring or imported game records:

```sh
npm run study:game -- --moves "h7-e7 h0-g2 h9-g7" --json
npm run study:game -- --file ./game.json --max-position-studies 3
```

Use named engine profiles when wiring the app:

```js
import { createEngine, listEngineProfiles } from "./src/index.js";

console.log(listEngineProfiles().map((profile) => profile.id));

const fastEngine = createEngine({ profile: "fast" });
const analysisEngine = createEngine({ profile: "analysis", depth: 6 });
```

Profiles are presets only: explicit options such as `depth`, `timeLimitMs`, `lines`, or `maxTranspositionEntries` override the profile defaults.

Use the opening book or opt into pure search:

```js
const bookMove = engine.chooseMove(position);
const searchMove = engine.chooseMove(position, { useBook: false });
const book = engine.openingBook(position);
const exactOnly = engine.openingBook(position, { openingHeuristics: false });
```

The built-in book is intentionally small but structured as opening data: named entries, ideas, tags, and multi-ply lines. When an early position is not in the exact table, the engine can fall back to opening heuristics such as developing horses, contesting the central file, and activating rooks. Heuristic opening moves are tactically validated by search before play by default; set `validateOpeningHeuristics: false` to inspect the raw heuristic recommendation, or tune `openingHeuristicValidationDepth`, `openingHeuristicValidationTimeMs`, and `openingHeuristicMaxCentipawnLoss` for different play profiles. This is a bridge toward importing a larger Xiangqi opening database later.

Import or merge opening data:

```js
import {
  createEngine,
  createOpeningBookFromCsv,
  createOpeningBookFromRecords,
  createOpeningBookFromText,
  DEFAULT_OPENING_BOOK,
  mergeOpeningBooks
} from "./src/index.js";

const imported = createOpeningBookFromText(`
  h9g7 h0g2 | games=120 | name=Horse Opening | tags=database,horse
  h7e7 h0g2 | games=80 | name=Central Cannon | tags=database,cannon
`);

const book = mergeOpeningBooks(DEFAULT_OPENING_BOOK, imported);
const engine = createEngine({ book });

const databaseBook = createOpeningBookFromRecords([
  {
    moves: ["h7-e7", "h0-g2"],
    games: 1200,
    redWinRate: 0.54,
    drawRate: 0.24,
    blackWinRate: 0.22,
    source: "master-game-db",
    name: "Central Cannon Main Line"
  }
]);

const csvBook = createOpeningBookFromCsv(`
  moves,games,red_win_rate,draw_rate,black_win_rate,cp,source,name,tags
  "h7-e7 h0-g2",1200,0.54,0.24,0.22,32,master-db,Central Cannon,csv
`);
```

The text importer accepts move lines plus optional `weight`, `count`, `frequency`, or `games` metadata. The structured-record importer also accepts common database priors such as `games`, `redWinRate`, `drawRate`, `blackWinRate`, `engineScore`, `source`, and `year`; the CSV/TSV importer recognizes common headers such as `moves`, `red_win_rate`, `draw_rate`, `black_win_rate`, `cp`, `source`, `name`, and `tags`. Imported records weight each continuation for the side to move and carry a database summary into the explanation. Repeated lines aggregate their weights, which makes it suitable for converting a larger opening database into engine heuristics.

Generate opening records from a native oracle when no curated opening database is
available yet:

```sh
XIANGQI_ORACLE_ENGINE_COMMAND=/path/to/pikafish \
npm run book:oracle -- --protocol uci \
  --option Threads=4 \
  --option Hash=512 \
  --option EvalFile=/path/to/pikafish.nnue \
  --plies 16 \
  --lines 3 \
  --depth 8 \
  --time 3000 \
  --out ./oracle-opening-book.json
```

The command follows the oracle's best line for the requested opening plies and
records the top MultiPV alternatives at each visited position. The `--out`
artifact is versioned and can be inspected, committed, or loaded later:

```js
import { readFile } from "node:fs/promises";
import {
  createEngine,
  createOpeningBookFromOracleArtifact,
  DEFAULT_OPENING_BOOK,
  mergeOpeningBooks
} from "./src/index.js";

const artifact = JSON.parse(await readFile("./oracle-opening-book.json", "utf8"));
const oracleBook = createOpeningBookFromOracleArtifact(artifact);
const engine = createEngine({
  book: mergeOpeningBooks(DEFAULT_OPENING_BOOK, oracleBook)
});
```

You can also try the generated book directly in the terminal game:

```sh
npm run play -- --side black --book ./oracle-opening-book.json
```

Use `--records-only` when you only want the raw records array for
`createOpeningBookFromRecords`. Keeping generated oracle books outside the
default repertoire makes native-engine choices reviewable before they become
learning-app heuristics.

Choose an engine backend:

```js
import {
  createJavaScriptEngineBackend,
  createLearningEngineBackend,
  createOracleReviewEngineBackend,
  createUcciEngineBackend,
  describeEngineBackend,
  ENGINE_BACKEND_FEATURES
} from "./src/index.js";

const backend = createJavaScriptEngineBackend({ depth: 3, timeLimitMs: 1000 });

console.log(describeEngineBackend(backend));
console.log(backend.supports(ENGINE_BACKEND_FEATURES.EXPLANATION));

const nativeBackend = createUcciEngineBackend({
  command: "/path/to/pikafish-or-other-native-engine",
  profile: "native-uci",
  depth: 8,
  engineOptions: {
    Threads: 4,
    Hash: 512,
    EvalFile: "/path/to/pikafish.nnue"
  }
});

const nativeResult = await nativeBackend.chooseMove(position);
console.log(nativeResult.bestMove.notation);
console.log(nativeResult.explanation.summary);

const pureNativeResult = await nativeBackend.chooseMove(position, { useBook: false });
console.log(pureNativeResult.source);

const nativeReview = await nativeBackend.reviewMove(position, "h7-e7");
console.log(nativeReview.explanation.summary);

const nativeGameReview = await nativeBackend.reviewGame(["h7-e7", "h0-g2"]);
console.log(nativeGameReview.summary);
await nativeBackend.close();
```

For app wiring, use `createLearningEngineBackend` to prefer a configured native
engine and fall back to the JavaScript reference engine when no native command is
available or when the native process cannot start during a turn:

```js
const backend = createLearningEngineBackend({
  command: process.env.XIANGQI_ENGINE_COMMAND,
  args: process.env.XIANGQI_ENGINE_ARGS?.split(" ") ?? [],
  profile: "native-uci",
  depth: 10,
  timeLimitMs: 5000,
  javascript: {
    profile: "balanced",
    timeLimitMs: 1500
  }
});

const result = await backend.chooseMove(position, { lines: 3 });
console.log(describeEngineBackend(backend).status);
console.log(result.explanation.alternatives);
console.log(result.backendFallback?.message);
await backend.close?.();
```

`engineOptions` are sent to the native process as `setoption` commands before
the first `isready` check after handshake. Use an object for ordinary options
such as `{ Threads: 4, Hash: 512 }`, or an array for button-style options such
as `[{ name: "Clear Hash" }]`. `describeEngineBackend(nativeBackend)` includes
the normalized `nativeOptions` list so the app can show exactly how a strong
engine was configured.

Probe a native engine before wiring it into sparring or the app:

```sh
XIANGQI_ENGINE_COMMAND=/path/to/pikafish \
npm run probe:native -- --protocol uci \
  --option Threads=4 \
  --option Hash=512 \
  --option EvalFile=/path/to/pikafish.nnue \
  --depth 6 \
  --time 1500 \
  --lines 3
```

The probe prints the native backend description, normalized options, selected
move, top alternatives, principal reasoning summary, best-vs-next MultiPV
comparison, and optional move review via `--review h7-e7`. Add `--json` when a
script or CI job should parse the result.

Set `native: false` or `preferNative: false` to force the JS learning engine, or
pass a nested `native: { command, args, protocol }` object when the app keeps
native-engine configuration separate from shared search options. Set
`fallbackOnNativeError: false` for strict native behavior that reports process
errors instead of recovering with the JS reference engine.

The JavaScript backend is the reference learning engine. The native backend is async because it talks to an external UCI/UCCI process; UCCI is the default, and `protocol: "uci"` supports UCI-style engines such as Pikafish. For UCI Xiangqi engines, the adapter translates the app's readable FEN and coordinates into the common native dialect: horses/elephants use `N/B`, Red-to-move becomes `w`, and UCI rank coordinates are mirrored at the process boundary. By default it checks the JS/imported opening book before starting native search, and `useBook: false` forces a pure native search. Native `reviewMove` and `reviewGame` compare played moves against the external engine's preferred moves, then use the JS explanation layer to turn score gaps into learning feedback. The built-in backends expose `chooseMove`, `analyzePosition`, `reviewMove`, `reviewGame`, `coachMove`, `lessonPlan`, `studyPosition`, `gameStudy`, `openingBook`, `play`, and `legalMoves`, so the app can use a strong native engine for play while keeping JS-powered opening, review, and explanation helpers around it.

Wrap a fast candidate backend with a stronger oracle reviewer when the app wants
interactive speed plus a top-engine verdict on the current pick:

```js
const candidate = createJavaScriptEngineBackend({
  profile: "balanced",
  timeLimitMs: 1500
});
const oracle = createUcciEngineBackend({
  command: "/path/to/pikafish",
  profile: "native-uci",
  depth: 10,
  timeLimitMs: 5000
});
const reviewed = createOracleReviewEngineBackend(candidate, oracle);
const decision = await reviewed.chooseMove(position, {
  oracleReviewOptions: { depth: 8, timeLimitMs: 3000 }
});

console.log(decision.explanation.summary);
console.log(decision.oracleReview.classification);
console.log(decision.oracleReview.centipawnLoss);
console.log(decision.oracleReview.verdict);
await reviewed.close();
```

`oracleReview` is also copied into game-history decision summaries, and
`reviewMove`/`reviewGame` use the oracle by default with candidate fallback. A
future UI can show both why the candidate engine picked the move and how the
stronger oracle graded it, while also using the oracle for player feedback.

Review a player's move:

```js
const review = engine.reviewMove(position, "e9-f9");

console.log(review.classification);
console.log(review.centipawnLoss);
console.log(review.mistakes.primary);
console.log(review.explanation.summary);
```

`reviewMove` compares the played move against the searched best line and returns a practical grade: `best`, `excellent`, `good`, `inaccuracy`, `mistake`, or `blunder`. It also returns `mistakes`, a structured pattern summary for learning flows, such as missed material, unsafe capture, missed check, missed threat, allowed threat, or positional drift.

Analyze several candidate lines:

```js
const analysis = engine.analyzePosition(position, { lines: 3, depth: 3 });

for (const line of analysis.lines) {
  console.log(line.rank, line.move.notation, line.explanation.summary);
}
```

`analyzePosition` returns ranked candidate lines with scores, centipawn loss against the best move, principal variations, and individual explanations.

Ask for progressive coach hints:

```js
const hint = engine.coachMove(position, { depth: 3, timeLimitMs: 1000 });

console.log(hint.levels[0].text); // idea
console.log(hint.levels[1].text); // tactical clue
console.log(hint.levels[2].text); // candidate focus
console.log(hint.levels[3].text); // full reveal
```

`coachMove` is designed for lesson and hint flows: it preserves the engine's best move, alternatives, principal variation, and explanation, but packages them as progressive reveal levels so the UI can teach before showing the answer. The native backend exposes the same method asynchronously, which lets a UCI/UCCI engine provide the move while the JavaScript layer provides the teaching text.

Run benchmark positions:

```js
import { formatBenchmarkReport, runBenchmarkSuite } from "./src/index.js";

const report = await runBenchmarkSuite();
console.log(formatBenchmarkReport(report));
```

The benchmark suite is intentionally small for now: it checks the opening layer,
a clean tactical capture, an immediate forcing win, and the Hu-bot central
cannon trap where opening heuristics must defer to search. It reports aggregate
nodes, nodes per second, average depth, timeout count, and summed search stats,
making it a regression guardrail for search changes and a foundation for
comparing the JS reference backend with stronger native engines later.

Save sparring or lesson positions as a custom JSON suite when you want repeatable
engine checks:

```json
{
  "defaults": {
    "tags": ["custom", "learning"],
    "options": { "depth": 2, "timeLimitMs": 1000, "useBook": false }
  },
  "benchmarks": [
    {
      "id": "custom-rook-win",
      "fen": "4k4/9/4r4/9/9/9/9/9/9/3KR4 r",
      "expectedMove": "e9-e2",
      "lesson": "Capture the loose rook instead of drifting."
    }
  ]
}
```

Then run it directly:

```sh
npm run bench -- --benchmarks ./benchmarks.json --json
```

Compare the JavaScript learning engine to a native oracle:

```sh
XIANGQI_ORACLE_ENGINE_COMMAND=/path/to/pikafish \
npm run bench:oracle -- --oracle-protocol uci \
  --oracle-option Threads=4 \
  --oracle-option Hash=512 \
  --oracle-option EvalFile=/path/to/pikafish.nnue \
  --oracle-depth 8 \
  --oracle-time 3000 \
  --acceptable-loss 60
```

The oracle benchmark lets the JavaScript candidate move first, asks the native
engine for its own best move, then uses the oracle review path to grade the
candidate move by centipawn loss and classification. Use `--benchmarks
./benchmarks.json` for custom positions; oracle-only suites can omit
`expectedMove` because the oracle supplies the reference. Use `--tag opening`,
`--tag tactic`, or `--json` for focused regression runs.

Compare backends on the same benchmark suite:

```js
import {
  compareEngineBackends,
  createJavaScriptEngineBackend,
  createUcciEngineBackend,
  formatEngineComparisonReport
} from "./src/index.js";

const jsBackend = createJavaScriptEngineBackend({ depth: 3, timeLimitMs: 1000 });
const nativeBackend = createUcciEngineBackend({
  command: "/path/to/pikafish-or-other-native-engine",
  profile: "native-uci",
  timeLimitMs: 3000
});

const comparison = await compareEngineBackends([jsBackend, nativeBackend]);
console.log(formatEngineComparisonReport(comparison));
await nativeBackend.close();
```

Run a repeatable sparring match:

```js
import {
  createJavaScriptEngineBackend,
  formatSparringReport,
  runSparringMatch
} from "./src/index.js";

const red = createJavaScriptEngineBackend({ name: "Book+JS", depth: 2 });
const black = createJavaScriptEngineBackend({ name: "Search-only JS", depth: 2 });

const sparring = await runSparringMatch({
  red,
  black: {
    engine: black,
    searchOptions: { useBook: false }
  }
}, {
  maxPlies: 20,
  referee: red,
  refereeOptions: {
    reviewOptions: { depth: 3, timeLimitMs: 1500 }
  },
  searchOptions: { timeLimitMs: 1000 }
});

console.log(formatSparringReport(sparring));
console.log(sparring.moves[0].summary);
console.log(sparring.moves[0].refereeReview?.classification);
console.log(sparring.aggregate.fallbackCount);
```

The sparring harness uses the same game-history layer as a play session, so every move keeps the chosen notation, position FENs, search source, score, depth, nodes, principal variation, explanation summary/reasons, backend status, and native-fallback provenance. When a `referee` backend is supplied, the match also gets reviewed for centipawn loss, classifications, best-move corrections, and learning moments. It is meant for repeatable engine-vs-engine smoke tests before trying brittle online boards. Run `npm run spar -- --plies 20 --depth 2 --time 1000`, add `--referee --referee-depth 4 --referee-time 2000` for a JS review pass, or set `XIANGQI_REFEREE_ENGINE_COMMAND`/`--referee-command` to grade the match with a native UCI/UCCI engine. Set `XIANGQI_ENGINE_COMMAND` to put a native UCI/UCCI engine on both playing sides through the learning backend.

To spar against a strong UCI engine such as Pikafish without checking binaries
into this repo, point one side and the referee at a local executable:

```sh
XIANGQI_ENGINE_COMMAND=/path/to/pikafish \
npm run probe:native -- --protocol uci \
  --option Threads=4 \
  --option Hash=512 \
  --option EvalFile=/path/to/pikafish.nnue

XIANGQI_BLACK_ENGINE_COMMAND=/path/to/pikafish \
XIANGQI_REFEREE_ENGINE_COMMAND=/path/to/pikafish \
npm run spar -- --protocol uci --referee-protocol uci --plies 20 --no-book \
  --native-option Threads=4 \
  --native-option Hash=512 \
  --native-option EvalFile=/path/to/pikafish.nnue \
  --referee-depth 8 \
  --referee-time 3000
```

Use `--red-option`, `--black-option`, or `--referee-option` to override an
option for a specific process after the shared `--native-option` values. The
same settings can be made repeatable with comma-separated environment values
such as `XIANGQI_ENGINE_OPTIONS="Threads=4,Hash=512"` or JSON values such as
`XIANGQI_REFEREE_ENGINE_OPTIONS='{"Threads":4,"Hash":1024}'`. The sparring
report prints the normalized native options so engine-vs-engine results carry
their configuration with them.

Inspect threats without running a full search:

```js
const pressure = engine.pressure(position);

console.log(pressure.threats[0]?.summary);
console.log(pressure.opponentThreats[0]?.summary);
```

Track a play session:

```js
import {
  chooseAndPlayGameMove,
  chooseAndPlayGameMoveAsync,
  createGame,
  gameStatus,
  playGameMove,
  playGameMoveAsync
} from "./src/index.js";

let game = createGame();
game = playGameMove(game, engine, "a9-a8");
game = chooseAndPlayGameMove(game, engine, {
  searchOptions: { depth: 2, timeLimitMs: 1000 }
});

console.log(game.moves.at(-1).review.explanation.summary);
console.log(game.moves.at(-1).decision.explanation.summary);
console.log(game.moves.at(-1).decision.backendStatus);
console.log(game.moves.at(-1).decision.backendFallback);
console.log(gameStatus(game));

game = await playGameMoveAsync(game, nativeBackend, "h9-g7");
game = await chooseAndPlayGameMoveAsync(game, nativeBackend, {
  searchOptions: { useBook: false, depth: 8, timeLimitMs: 3000 },
  reviewOptions: { depth: 8, timeLimitMs: 3000 }
});
```

`gameStatus` reports `state`, `legalMoves`, repetition count, check status, and terminal `winner`/`loser` metadata. Repeated positions include a conservative `repetition` diagnostic with the repeated cycle, checking sides, and `draw-assumed` adjudication metadata so a learning UI can explain cycles without overclaiming the full official chase/perpetual-check rule set. Xiangqi stalemate is treated as a loss for the side to move, so both checkmate and no-legal-move stalemate are scored as losing terminal positions.

Review a completed or partial game:

```js
const gameReview = engine.reviewGame(["h7-e7", "h0-g2"], {
  reviewOptions: { depth: 2, timeLimitMs: 1000 }
});

console.log(gameReview.summary);
console.log(gameReview.keyMoments[0]?.summary);
```

Turn a review into lesson cards:

```js
const lesson = engine.lessonPlan(["h7-e7", "h0-g2"], {
  reviewOptions: { depth: 2, timeLimitMs: 1000 },
  lessonOptions: { maxCards: 3 }
});

console.log(lesson.cards[0].prompt);
console.log(lesson.cards[0].hints.at(-1).text);
console.log(lesson.cards[0].answer.move);
```

Lesson cards include the position FEN, side to move, played move, engine-preferred move, classification, centipawn loss, mistake pattern, prompt text, progressive hints, answer explanation, and tags such as `opening`, `correction`, `book`, and `high-impact`.

## Protocol

The engine includes a small UCCI-style command adapter:

```sh
node bin/xiangqi-ucci.mjs
```

Example session:

```text
ucci
position fen 4k4/9/4r4/9/9/9/9/9/9/3KR4 r
go depth 2 movetime 1000
go depth 4 wtime 60000 btime 45000 winc 1000 binc 1000 movestogo 20
analyze depth 2 movetime 1000 lines 3
hint depth 2 movetime 1000 levels 2
book
review depth 1 movetime 500
lesson depth 1 movetime 500 cards 3
```

The adapter supports `ucci`, `isready`, `setoption`, `position`, `banmoves`, `book`, `go`, `go ... multipv N`, clock controls such as `wtime`, `btime`, `winc`, `binc`, and `movestogo`, `setoption name MultiPV value N`, `setoption name HashEntries value N`, `setoption name UseBook value false`, `analyze`, `hint`/`coach`, `probe`, `pressure`, `review`, `lesson`/`lessons`, `explain`, and `quit`. `hint ... levels N` emits the progressive coach ladder up to level `N`; level 4 includes the full reveal and `bestmove`. `lesson ... cards N` turns the loaded move history into prompt, hint, and answer card lines. `go` info lines include counters such as `qnodes`, `qchecks`, `tthits`, `ttstores`, `ttevict`, `asp`, `asphi`, `asplo`, `ext`, `recext`, `soft`, `see`, `mdp`, `razor`, `pcut`, `pcsearch`, `futil`, `delta`, `nmp`, `cm`, `hmalus`, `rootord`, `rootmoves`, and `pvs` for learning-app diagnostics.

When `movestogo` is omitted, the JS engine estimates remaining moves from the current phase: opening positions spend more conservatively, endgames can use a larger share, and low-clock positions cap the maximum spend. `moveOverheadMs` can reserve GUI/process overhead from every allocated move.

## Movegen Validation

`perft(position, depth)` counts legal move trees and `perftDivide(position, depth)` breaks the count down by root move. These are not gameplay features; they are guardrails for making the rules engine stronger without silently breaking Xiangqi movement, check, cannon screens, horse legs, elephant eyes, or flying-general legality.

## Engine References

This project is not trying to clone a top engine in JavaScript, but its architecture is deliberately pointed toward the same families of ideas:

- [Pikafish](https://github.com/official-pikafish/Pikafish), a strong UCI Xiangqi engine derived from Stockfish with NNUE evaluation.
- [Fairy-Stockfish](https://github.com/fairy-stockfish/Fairy-Stockfish), a variant engine with Xiangqi support and NNUE network support for regional variants.
- [ElephantEye](https://github.com/xqbase/eleeye), an older Xiangqi engine whose documentation describes UCCI support, transposition/history tables, move sorting, iterative deepening, opening books, and evaluation/search separation.

## Coordinates

Coordinates use file letters `a` through `i` and ranks `0` through `9`, with rank `0` on Black's home side and rank `9` on Red's home side. The initial Red general is on `e9`; the initial Black general is on `e0`.

## Roadmap

- Expand the opening book and repetition rule handling.
- Harden the native UCI/UCCI backend with engine option profiles and production process supervision.
- Add stronger time management and deeper late-game search extensions.
- Expand benchmark positions and add engine-vs-engine comparison reports.
- Connect the engine to a playable learning UI with move review, hints, and lesson generation.
