import test from "node:test";
import assert from "node:assert/strict";
import {
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

test("move explanations mention recapture risk for unsafe captures", () => {
  const position = parseFen("4k4/9/4r4/9/9/4p4/4R4/9/9/3K5 r");
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const review = engine.reviewMove(position, "e6-e5", { depth: 1, timeLimitMs: 500 });

  assert.ok(review.explanation.move.reasons.some((reason) => reason.includes("can recapture")));
});
