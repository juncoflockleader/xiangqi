import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeFork,
  analyzePins,
  analyzeCapture,
  createEngine,
  generateLegalMoves,
  parseFen
} from "../src/index.js";

test("capture analysis marks an undefended capture as safe", () => {
  const position = parseFen("4k4/9/4r4/9/9/9/9/9/9/3KR4 r");
  const move = generateLegalMoves(position).find((candidate) => candidate.notation === "e9-e2");
  const analysis = analyzeCapture(position, move);

  assert.equal(analysis.isSafe, true);
  assert.equal(analysis.exchangeScore, 900);
  assert.equal(analysis.recaptures.length, 0);
});

test("capture analysis detects immediate recapture risk", () => {
  const position = parseFen("4k4/9/4r4/9/9/4p4/4R4/9/9/3K5 r");
  const move = generateLegalMoves(position).find((candidate) => candidate.notation === "e6-e5");
  const analysis = analyzeCapture(position, move);

  assert.equal(analysis.isSafe, false);
  assert.equal(analysis.exchangeScore, -810);
  assert.equal(analysis.cheapestRecapture.notation, "e2-e5");
});

test("capture analysis follows multi-ply static exchange sequences", () => {
  const position = parseFen("4k4/9/4r4/9/9/4p4/4R4/9/9/3KR4 r");
  const move = generateLegalMoves(position).find((candidate) => candidate.notation === "e6-e5");
  const analysis = analyzeCapture(position, move);

  assert.equal(analysis.isSafe, true);
  assert.equal(analysis.exchangeScore, 90);
  assert.deepEqual(analysis.exchangeLine.map((entry) => entry.notation), [
    "e6-e5",
    "e2-e5",
    "e9-e5"
  ]);
  assert.equal(analysis.summary.includes("full exchange remains acceptable"), true);
});

test("fork analysis detects double attacks by the moved piece", () => {
  const position = parseFen("4k4/9/9/9/9/r8/4R4/4P4/9/4K4 r");
  const move = generateLegalMoves(position).find((candidate) => candidate.notation === "e6-e5");
  const fork = analyzeFork(position, move);

  assert.equal(fork.notation, "e6-e5");
  assert.equal(fork.pieceName, "rook");
  assert.deepEqual(fork.targets.map((target) => target.coord), ["e0", "a5"]);
  assert.deepEqual(fork.targets.map((target) => target.pieceName), ["general", "rook"]);
  assert.ok(fork.summary.includes("creates a fork"));
});

test("move explanations name fork tactics", () => {
  const position = parseFen("4k4/9/9/9/9/r8/4R4/4P4/9/4K4 r");
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const review = engine.reviewMove(position, "e6-e5", { depth: 1, timeLimitMs: 500 });

  assert.ok(review.explanation.move.reasons.some((reason) => reason.includes("creates a fork")));
  assert.ok(review.playedLinePlan.motifs.includes("fork"));
});

test("pin analysis detects line pins to the general", () => {
  const position = parseFen("4k4/9/9/4r4/9/9/4R4/9/9/4K4 r");
  const move = generateLegalMoves(position).find((candidate) => candidate.notation === "e6-e5");
  const pins = analyzePins(position, move);

  assert.equal(pins.notation, "e6-e5");
  assert.equal(pins.pieceName, "rook");
  assert.equal(pins.pins[0].targetCoord, "e3");
  assert.equal(pins.pins[0].targetName, "rook");
  assert.equal(pins.pins[0].method, "line");
  assert.ok(pins.summary.includes("pins the rook on e3 to the general"));
});

test("pin analysis detects cannon-screen pins", () => {
  const position = parseFen("4k4/9/9/4r4/9/4P4/9/9/2C6/4K4 r");
  const move = generateLegalMoves(position).find((candidate) => candidate.notation === "c8-e8");
  const pins = analyzePins(position, move);

  assert.equal(pins.pieceName, "cannon");
  assert.equal(pins.pins[0].targetCoord, "e3");
  assert.equal(pins.pins[0].screen.coord, "e5");
  assert.equal(pins.pins[0].method, "cannon-screen");
  assert.ok(pins.summary.includes("using the pawn on e5 as a screen"));
});

test("move explanations name pin tactics", () => {
  const position = parseFen("4k4/9/9/4r4/9/9/4R4/9/9/4K4 r");
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const review = engine.reviewMove(position, "e6-e5", { depth: 1, timeLimitMs: 500 });

  assert.ok(review.explanation.move.reasons.some((reason) => reason.includes("pins the rook on e3")));
  assert.ok(review.playedLinePlan.motifs.includes("pin"));
});

test("move explanations mention recapture risk for unsafe captures", () => {
  const position = parseFen("4k4/9/4r4/9/9/4p4/4R4/9/9/3K5 r");
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const review = engine.reviewMove(position, "e6-e5", { depth: 1, timeLimitMs: 500 });

  assert.ok(review.explanation.move.reasons.some((reason) => reason.includes("can recapture")));
});

test("move explanations surface favorable defended captures", () => {
  const position = parseFen("4k4/9/4r4/9/9/4p4/4R4/9/9/3KR4 r");
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const review = engine.reviewMove(position, "e6-e5", { depth: 1, timeLimitMs: 500 });

  assert.ok(review.explanation.move.reasons.some((reason) => reason.includes("full exchange remains acceptable")));
  assert.ok(review.explanation.move.reasons.some((reason) => reason.includes("+90 centipawns")));
});
