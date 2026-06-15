import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeDiscoveredCheck,
  analyzeFork,
  analyzePins,
  analyzeSkewer,
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

test("skewer analysis detects direct line skewers", () => {
  const position = parseFen("4r4/9/4k4/9/3R5/9/4P4/9/9/4K4 r");
  const move = generateLegalMoves(position).find((candidate) => candidate.notation === "d4-e4");
  const skewer = analyzeSkewer(position, move);

  assert.equal(skewer.notation, "d4-e4");
  assert.equal(skewer.pieceName, "rook");
  assert.equal(skewer.skewers[0].frontCoord, "e2");
  assert.equal(skewer.skewers[0].frontName, "general");
  assert.equal(skewer.skewers[0].backCoord, "e0");
  assert.equal(skewer.skewers[0].backName, "rook");
  assert.equal(skewer.skewers[0].method, "line");
  assert.ok(skewer.summary.includes("skewers the general on e2 against the rook on e0"));
});

test("skewer analysis detects cannon-screen skewers", () => {
  const position = parseFen("4r4/9/4k4/4P4/2C6/9/9/9/9/4K4 r");
  const move = generateLegalMoves(position).find((candidate) => candidate.notation === "c4-e4");
  const skewer = analyzeSkewer(position, move);

  assert.equal(skewer.pieceName, "cannon");
  assert.equal(skewer.skewers[0].frontCoord, "e2");
  assert.equal(skewer.skewers[0].backCoord, "e0");
  assert.equal(skewer.skewers[0].screen.coord, "e3");
  assert.equal(skewer.skewers[0].method, "cannon-screen");
  assert.ok(skewer.summary.includes("using the pawn on e3 as a screen"));
});

test("move explanations name skewer tactics", () => {
  const position = parseFen("4r4/9/4k4/9/3R5/9/4P4/9/9/4K4 r");
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const review = engine.reviewMove(position, "d4-e4", { depth: 1, timeLimitMs: 500 });

  assert.ok(review.explanation.move.reasons.some((reason) => reason.includes("skewers the general on e2")));
  assert.ok(review.playedLinePlan.motifs.includes("skewer"));
});

test("discovered-check analysis detects opened rook lines", () => {
  const position = parseFen("4k4/9/9/9/4P4/9/4R4/9/9/4K4 r");
  const move = generateLegalMoves(position).find((candidate) => candidate.notation === "e4-d4");
  const discovered = analyzeDiscoveredCheck(position, move);

  assert.equal(discovered.notation, "e4-d4");
  assert.equal(discovered.pieceName, "pawn");
  assert.equal(discovered.discoveredChecks[0].attackerName, "rook");
  assert.equal(discovered.discoveredChecks[0].attackerCoord, "e6");
  assert.equal(discovered.discoveredChecks[0].method, "line");
  assert.ok(discovered.summary.includes("uncovers a rook check from e6"));
});

test("discovered-check analysis detects cannon screens", () => {
  const position = parseFen("4k4/9/9/9/4P4/9/4P4/9/4C4/4K4 r");
  const move = generateLegalMoves(position).find((candidate) => candidate.notation === "e4-d4");
  const discovered = analyzeDiscoveredCheck(position, move);

  assert.equal(discovered.discoveredChecks[0].attackerName, "cannon");
  assert.equal(discovered.discoveredChecks[0].screen.coord, "e6");
  assert.equal(discovered.discoveredChecks[0].method, "cannon-line");
  assert.ok(discovered.summary.includes("using the pawn on e6 as a screen"));
});

test("discovered-check analysis detects unblocked horse legs", () => {
  const position = parseFen("4k4/3P5/3H5/9/9/4P4/9/9/9/4K4 r");
  const move = generateLegalMoves(position).find((candidate) => candidate.notation === "d1-c1");
  const discovered = analyzeDiscoveredCheck(position, move);

  assert.equal(discovered.discoveredChecks[0].attackerName, "horse");
  assert.equal(discovered.discoveredChecks[0].attackerCoord, "d2");
  assert.equal(discovered.discoveredChecks[0].method, "horse-leg");
  assert.ok(discovered.summary.includes("uncovers a horse check from d2"));
});

test("move explanations name discovered-check tactics", () => {
  const position = parseFen("4k4/9/9/9/4P4/9/4R4/9/9/4K4 r");
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const review = engine.reviewMove(position, "e4-d4", { depth: 1, timeLimitMs: 500 });

  assert.ok(review.explanation.move.reasons.some((reason) => reason.includes("uncovers a rook check from e6")));
  assert.ok(review.playedLinePlan.motifs.includes("discovered check"));
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
