import test from "node:test";
import assert from "node:assert/strict";
import {
  SIDES,
  createEngine,
  createInitialPosition,
  parseFen,
  reviewGameWithEngine
} from "../src/index.js";

test("engine reviews a short opening line with book matches", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const review = engine.reviewGame(["h7-e7", "h0-g2"], {
    reviewOptions: { depth: 1, timeLimitMs: 500 }
  });

  assert.equal(review.moves.length, 2);
  assert.equal(review.summary.totalMoves, 2);
  assert.equal(review.summary.bookMoves, 2);
  assert.equal(review.summary.bySide.red.moves, 1);
  assert.equal(review.summary.bySide.black.moves, 1);
  assert.equal(review.moves[0].book.isBookMove, true);
  assert.equal(review.moves[0].book.played.name, "Central Cannon");
  assert.equal(review.status.state, "playing");
});

test("game review highlights large mistakes as key moments", () => {
  const engine = createEngine({ depth: 2, timeLimitMs: 1000 });
  const initialPosition = parseFen("4k4/9/4r4/9/9/9/9/9/9/3KR4 r");
  const review = engine.reviewGame(["e9-f9"], {
    initialPosition,
    reviewOptions: { depth: 2, timeLimitMs: 1000 }
  });

  assert.equal(review.summary.classifications.blunder, 1);
  assert.equal(review.keyMoments[0].notation, "e9-f9");
  assert.equal(review.keyMoments[0].bestMove, "e9-e2");
  assert.equal(review.keyMoments[0].mistakes.primary, "missed-material");
  assert.ok(review.keyMoments[0].centipawnLoss > 1000);
});

test("move review classifies tactical mistake patterns", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const position = parseFen("4k4/9/4r4/9/9/4p4/4R4/9/9/3K5 r");
  const review = engine.reviewMove(position, "e6-e5", {
    depth: 1,
    timeLimitMs: 500
  });

  assert.equal(review.mistakes.primary, "unsafe-capture");
  assert.ok(review.mistakes.tags.includes("tactics"));
  assert.ok(review.explanation.reasons.some((reason) => reason.includes("Mistake pattern")));
  assert.equal(review.explanation.mistakes.primary, "unsafe-capture");
});

test("standalone game review helper accepts an engine", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const review = reviewGameWithEngine(engine, ["h7-e7"], {
    initialPosition: createInitialPosition(),
    reviewOptions: { depth: 1, timeLimitMs: 500 }
  });

  assert.equal(review.moves.length, 1);
  assert.equal(review.moves[0].notation, "h7-e7");
});

test("game review carries repetition cycle diagnostics", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 100 });
  const initialPosition = parseFen("3k5/R8/9/9/9/9/9/9/9/4K4 r");
  const cycle = ["a1-a0", "d0-d1", "a0-a1", "d1-d0"];
  const review = engine.reviewGame([...cycle, ...cycle], {
    initialPosition,
    reviewOptions: { depth: 1, timeLimitMs: 100 }
  });

  assert.equal(review.status.state, "repetition");
  assert.equal(review.status.repetition.kind, "perpetual-check-candidate");
  assert.equal(review.status.repetition.possiblePerpetualCheckSide, SIDES.RED);
  assert.deepEqual(review.status.repetition.moves.map((move) => move.notation), cycle);
});

test("move review falls back when timeout prevents root candidate scoring", () => {
  const engine = createEngine({ depth: 3, timeLimitMs: 1 });
  const review = engine.reviewMove(createInitialPosition(), "h7-e7", {
    depth: 3,
    timeLimitMs: 1
  });

  assert.equal(review.move.notation, "h7-e7");
  assert.ok(Number.isFinite(review.playedScore));
  assert.ok(review.principalVariation.includes("h7-e7"));
});
