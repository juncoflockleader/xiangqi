import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseAndPlayGameMove,
  chooseAndPlayGameMoveAsync,
  chooseGameMove,
  chooseGameMoveAsync,
  createEngine,
  createGame,
  createLearningEngineBackend,
  gameStatus,
  historyKeys,
  moveHistory,
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
  assert.deepEqual(moveHistory(game), ["a9-a8", "a0-a1"]);
  assert.equal(gameStatus(game).state, "playing");
  assert.equal(game.moves[0].ply, 1);
  assert.equal(game.moves[0].moveNumber, 1);
  assert.equal(game.moves[0].side, "red");
  assert.equal(game.moves[0].actor, "player");
  assert.ok(game.moves[0].positionBefore.includes(" r"));
  assert.ok(game.moves[0].positionAfter.includes(" b"));
});

test("game helper forwards replayable move history for native backends", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 100 });
  let game = createGame();
  game = playGameMove(game, engine, "a9-a8", { review: false });
  let capturedOptions = null;
  const backend = {
    chooseMove(position, options) {
      capturedOptions = options;
      return { bestMove: null, stats: { nodes: 0 }, position };
    }
  };

  chooseGameMove(game, backend, { depth: 1 });

  assert.equal(capturedOptions.initialPosition, game.initialPosition);
  assert.deepEqual(capturedOptions.moveHistory, ["a9-a8"]);
  assert.equal(capturedOptions.history.length, 2);
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
  assert.equal(game.moves[0].decision.backendStatus.state, "primary");
  assert.equal(game.moves[0].decision.backendStatus.native, false);
  assert.equal(game.moves[0].decision.backendFallback, null);
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

test("async game helper records backend fallback provenance", async () => {
  const backend = createLearningEngineBackend({
    command: "/path/that/should/not/start",
    profile: "native-ucci",
    depth: 1,
    timeLimitMs: 100,
    startupTimeoutMs: 50,
    commandTimeoutMs: 50,
    javascript: {
      profile: "fast",
      depth: 1,
      timeLimitMs: 100
    }
  });

  try {
    const game = await chooseAndPlayGameMoveAsync(createGame(), backend, {
      searchOptions: { useBook: false, depth: 1, timeLimitMs: 100 },
      review: false
    });
    const decision = game.moves[0].decision;

    assert.equal(game.moves.length, 1);
    assert.equal(decision.backendStatus.state, "fallback");
    assert.equal(decision.backendStatus.fallbackActive, true);
    assert.equal(decision.backendFallback.method, "chooseMove");
    assert.equal(decision.backendFallback.fallbackBackend, "javascript-reference");
    assert.ok(decision.explanation.reasons[0].includes("JavaScript Reference Engine supplied this result"));
  } finally {
    await backend.close();
  }
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
  assert.equal(status.repetition.kind, "cycle");
  assert.equal(status.repetition.cycleLength, 4);
  assert.equal(status.repetition.adjudication, "draw-assumed");
  assert.deepEqual(status.repetition.moves.map((move) => move.notation), cycle);
});

test("game status classifies repeated checking cycles conservatively", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 100 });
  let game = createGame(parseFen("3k5/R8/9/9/9/9/9/9/9/4K4 r"));
  const cycle = ["a1-a0", "d0-d1", "a0-a1", "d1-d0"];

  for (const move of [...cycle, ...cycle]) {
    game = playGameMove(game, engine, move, { review: false });
  }

  const status = gameStatus(game);
  assert.equal(status.state, "repetition");
  assert.equal(status.outcome, "draw");
  assert.equal(status.repetition.kind, "perpetual-check-candidate");
  assert.equal(status.repetition.possiblePerpetualCheckSide, SIDES.RED);
  assert.deepEqual(status.repetition.checkingSides, [SIDES.RED]);
  assert.deepEqual(status.repetition.continuousCheckingSides, [SIDES.RED]);
  assert.equal(status.repetition.checksBySide.red, 2);
  assert.equal(status.repetition.checksBySide.black, 0);
  assert.deepEqual(status.repetition.moves.map((move) => move.notation), cycle);
});
