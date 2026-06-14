import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseAndPlayGameMove,
  chooseAndPlayGameMoveAsync,
  chooseGameMove,
  chooseGameMoveAsync,
  createEngine,
  createGame,
  gameStatus,
  historyKeys,
  parseFen,
  playGameMove,
  playGameMoveAsync,
  SIDES
} from "../src/index.js";

test("game history records moves and position keys", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 100 });
  let game = createGame();
  game = playGameMove(game, engine, "a9-a8", { review: false });
  game = playGameMove(game, engine, "a0-a1", { review: false });

  assert.equal(game.moves.length, 2);
  assert.equal(historyKeys(game).length, 3);
  assert.equal(gameStatus(game).state, "playing");
  assert.equal(game.moves[0].ply, 1);
  assert.equal(game.moves[0].moveNumber, 1);
  assert.equal(game.moves[0].side, "red");
  assert.equal(game.moves[0].actor, "player");
  assert.ok(game.moves[0].positionBefore.includes(" r"));
  assert.ok(game.moves[0].positionAfter.includes(" b"));
});

test("game helper chooses an engine move with session history", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 100 });
  let game = createGame();
  game = playGameMove(game, engine, "a9-a8", { review: false });
  const result = chooseGameMove(game, engine, { depth: 1, timeLimitMs: 100, useBook: false });

  assert.ok(result.bestMove);
  assert.ok(result.stats.nodes > 0);
});

test("game helper chooses and applies an engine move with explanation metadata", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 100 });
  let game = createGame();
  game = chooseAndPlayGameMove(game, engine, {
    searchOptions: { depth: 1, timeLimitMs: 100 },
    reviewOptions: { depth: 1, timeLimitMs: 100 }
  });

  assert.equal(game.moves.length, 1);
  assert.equal(game.moves[0].actor, "engine");
  assert.equal(game.moves[0].notation, game.moves[0].decision.bestMove.notation);
  assert.ok(game.moves[0].decision.explanation.summary.includes(game.moves[0].notation));
  assert.ok(game.moves[0].review.explanation.summary.includes(game.moves[0].notation));
});

test("async game helpers support native-style backends", async () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 100 });
  const asyncBackend = {
    chooseMove: async (position, options) => engine.chooseMove(position, options),
    reviewMove: async (position, move, options) => engine.reviewMove(position, move, options),
    play: (position, notation) => engine.play(position, notation)
  };
  let game = createGame();
  const decision = await chooseGameMoveAsync(game, asyncBackend, {
    depth: 1,
    timeLimitMs: 100
  });

  assert.ok(decision.bestMove);

  game = await playGameMoveAsync(game, asyncBackend, decision.bestMove, {
    actor: "engine",
    decision,
    reviewOptions: { depth: 1, timeLimitMs: 100 }
  });

  assert.equal(game.moves.length, 1);
  assert.equal(game.moves[0].actor, "engine");
  assert.equal(game.moves[0].decision.bestMove.notation, game.moves[0].notation);
  assert.ok(game.moves[0].review.bestMove);

  game = await chooseAndPlayGameMoveAsync(game, asyncBackend, {
    searchOptions: { depth: 1, timeLimitMs: 100 },
    review: false
  });

  assert.equal(game.moves.length, 2);
  assert.equal(game.moves[1].actor, "engine");
  assert.equal(game.moves[1].review, null);
});

test("choose-and-play preserves terminal no-move decisions", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 100 });
  const game = createGame(parseFen("3rkr3/9/9/9/9/9/9/9/9/4K4 r"));
  const next = chooseAndPlayGameMove(game, engine, {
    searchOptions: { useBook: false, depth: 1, timeLimitMs: 100 }
  });

  assert.equal(next.moves.length, 0);
  assert.equal(next.lastDecision.bestMove, null);
  assert.equal(gameStatus(next).state, "checkmate");
});

test("game status treats Xiangqi stalemate as a loss for the side to move", () => {
  const game = createGame(parseFen("3rkr3/9/9/9/9/9/9/4p4/9/4K4 r"));
  const status = gameStatus(game);

  assert.equal(status.state, "stalemate");
  assert.equal(status.outcome, "loss");
  assert.equal(status.loser, SIDES.RED);
  assert.equal(status.winner, SIDES.BLACK);
  assert.equal(status.inCheck, false);
});

test("game status detects a repeated position", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 100 });
  let game = createGame();
  const cycle = ["a9-a8", "a0-a1", "a8-a9", "a1-a0"];

  for (const move of [...cycle, ...cycle]) {
    game = playGameMove(game, engine, move, { review: false });
  }

  const status = gameStatus(game);
  assert.equal(status.state, "repetition");
  assert.equal(status.repetitionCount, 3);
});
