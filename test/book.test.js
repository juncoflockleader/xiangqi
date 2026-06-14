import test from "node:test";
import assert from "node:assert/strict";
import {
  createEngine,
  createInitialPosition,
  lookupOpeningBook
} from "../src/index.js";

test("opening book returns legal annotated entries from the initial position", () => {
  const position = createInitialPosition();
  const book = lookupOpeningBook(position);

  assert.ok(book);
  assert.equal(book.entry.name, "Central Cannon");
  assert.equal(book.move.notation, "h7-e7");
  assert.ok(book.entries.length >= 3);
});

test("engine chooses and explains opening book moves by default", () => {
  const position = createInitialPosition();
  const engine = createEngine({ depth: 2, timeLimitMs: 1000 });
  const result = engine.chooseMove(position);

  assert.equal(result.source, "opening-book");
  assert.equal(result.bestMove.notation, "h7-e7");
  assert.equal(result.depth, 0);
  assert.ok(result.explanation.summary.includes("book move"));
  assert.ok(result.explanation.reasons.some((reason) => reason.includes("Opening book")));
});

test("opening book can be disabled for pure search", () => {
  const position = createInitialPosition();
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const result = engine.chooseMove(position, { useBook: false, depth: 1, timeLimitMs: 500 });

  assert.notEqual(result.source, "opening-book");
  assert.ok(result.depth >= 1);
});

test("opening book respects banned moves", () => {
  const position = createInitialPosition();
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const result = engine.chooseMove(position, {
    bannedMoves: ["h7-e7"]
  });

  assert.equal(result.source, "opening-book");
  assert.notEqual(result.bestMove.notation, "h7-e7");
});

test("opening book handles the next move in a known line", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const position = engine.play(createInitialPosition(), "h7-e7");
  const result = engine.chooseMove(position);

  assert.equal(result.source, "opening-book");
  assert.equal(result.bestMove.notation, "h0-g2");
});
