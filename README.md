# Xiangqi

An early Chinese chess learning-app foundation focused on the engine layer.

The current engine is dependency-free JavaScript and includes:

- Full Xiangqi board representation and FEN parsing.
- Legal move generation for generals, advisors, elephants, horses, rooks, cannons, and pawns.
- Check detection, flying-general rules, and make/unmake-style immutable position updates.
- Iterative-deepening negamax search with alpha-beta pruning.
- Transposition table, quiescence search, capture/check/history-based move ordering, bounded check extensions, late-move reductions, repetition hooks, and root candidate analysis.
- Evaluation terms for material, piece-square placement, mobility, threats, pawn progress, and king safety.
- Explainable move output for learning-app use cases.
- Player-move review with centipawn loss, best-line comparison, and lesson-ready reasons.
- Game-history helpers for play sessions, reviewed move logs, position history, and repeated-position detection.
- A minimal UCCI-style protocol adapter for GUI/app integration and engine smoke testing.

## Quick Start

```sh
node examples/engine-demo.mjs
node bin/xiangqi-ucci.mjs
node --test
```

## API Sketch

```js
import { createEngine, createInitialPosition } from "./src/index.js";

const position = createInitialPosition();
const engine = createEngine({ depth: 4, timeLimitMs: 1500 });
const result = engine.chooseMove(position);

console.log(result.bestMove.notation);
console.log(result.explanation.summary);
```

`chooseMove` returns the selected legal move, search score, principal variation, root candidates, and a learning-friendly explanation. The explanation is based on engine-visible facts such as search score, tactical features, evaluation deltas, and comparison against alternatives.

Review a player's move:

```js
const review = engine.reviewMove(position, "e9-f9");

console.log(review.classification);
console.log(review.centipawnLoss);
console.log(review.explanation.summary);
```

`reviewMove` compares the played move against the searched best line and returns a practical grade: `best`, `excellent`, `good`, `inaccuracy`, `mistake`, or `blunder`.

Track a play session:

```js
import { chooseGameMove, createGame, playGameMove, gameStatus } from "./src/index.js";

let game = createGame();
game = playGameMove(game, engine, "a9-a8");
const reply = chooseGameMove(game, engine);

console.log(game.moves.at(-1).review.explanation.summary);
console.log(reply.explanation.summary);
console.log(gameStatus(game));
```

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
```

The adapter supports `ucci`, `isready`, `setoption`, `position`, `banmoves`, `go`, `probe`, `explain`, and `quit`.

## Engine References

This project is not trying to clone a top engine in JavaScript, but its architecture is deliberately pointed toward the same families of ideas:

- [Pikafish](https://github.com/official-pikafish/Pikafish), a strong UCI Xiangqi engine derived from Stockfish with NNUE evaluation.
- [Fairy-Stockfish](https://github.com/fairy-stockfish/Fairy-Stockfish), a variant engine with Xiangqi support and NNUE network support for regional variants.
- [ElephantEye](https://github.com/xqbase/eleeye), an older Xiangqi engine whose documentation describes UCCI support, transposition/history tables, move sorting, iterative deepening, opening books, and evaluation/search separation.

## Coordinates

Coordinates use file letters `a` through `i` and ranks `0` through `9`, with rank `0` on Black's home side and rank `9` on Red's home side. The initial Red general is on `e9`; the initial Black general is on `e0`.

## Roadmap

- Add opening-book support and repetition rule handling.
- Add stronger time management and deeper late-game search extensions.
- Add engine-vs-engine benchmark positions.
- Connect the engine to a playable learning UI with move review, hints, and lesson generation.
