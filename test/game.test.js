import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseGameMove,
  createEngine,
  createGame,
  gameStatus,
  historyKeys,
  playGameMove
} from "../src/index.js";

test("game history records moves and position keys", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 100 });
  let game = createGame();
  game = playGameMove(game, engine, "a9-a8", { review: false });
  game = playGameMove(game, engine, "a0-a1", { review: false });

  assert.equal(game.moves.length, 2);
  assert.equal(historyKeys(game).length, 3);
  assert.equal(gameStatus(game).state, "playing");
});

test("game helper chooses an engine move with session history", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 100 });
  let game = createGame();
  game = playGameMove(game, engine, "a9-a8", { review: false });
  const result = chooseGameMove(game, engine, { depth: 1, timeLimitMs: 100 });

  assert.ok(result.bestMove);
  assert.ok(result.stats.nodes > 0);
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
