import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzePosition,
  createEngine,
  createInitialPosition,
  parseFen
} from "../src/index.js";

test("engine analyzes multiple candidate lines with explanations", () => {
  const position = parseFen("4k4/9/4r4/9/9/9/9/9/9/3KR4 r");
  const engine = createEngine({ depth: 2, timeLimitMs: 1000 });
  const analysis = engine.analyzePosition(position, { lines: 3, depth: 2, timeLimitMs: 1000 });

  assert.equal(analysis.lines.length, 3);
  assert.equal(analysis.lines[0].rank, 1);
  assert.equal(analysis.lines[0].move.notation, analysis.bestMove.notation);
  assert.equal(analysis.lines[0].centipawnLoss, 0);
  assert.ok(analysis.lines[0].explanation.summary.includes("Candidate 1"));
  assert.ok(analysis.lines.every((line) => line.principalVariation.length > 0));
});

test("standalone analyzePosition helper mirrors engine analysis", () => {
  const position = createInitialPosition();
  const analysis = analyzePosition(position, { lines: 2, depth: 1, timeLimitMs: 500 });

  assert.equal(analysis.lines.length, 2);
  assert.ok(analysis.explanation.summary.includes(analysis.bestMove.notation));
});

test("analysis line count is clamped to a useful range", () => {
  const position = createInitialPosition();
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });

  assert.equal(engine.analyzePosition(position, { lines: 0 }).lines.length, 1);
  assert.equal(engine.analyzePosition(position, { lines: 99 }).lines.length, 12);
});
