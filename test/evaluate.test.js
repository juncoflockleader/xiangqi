import test from "node:test";
import assert from "node:assert/strict";
import {
  SIDES,
  applyLegalMove,
  coordToIndex,
  describeEvaluationTerms,
  evaluateMoveDelta,
  evaluatePosition,
  parseFen
} from "../src/index.js";

test("evaluation penalizes blocked horse legs as piece coordination", () => {
  const blocked = parseFen("4k4/9/9/9/9/4P4/4H4/9/9/4K4 r");
  const free = parseFen("4k4/9/9/9/9/P8/4H4/9/9/4K4 r");
  const blockedEval = evaluatePosition(blocked, SIDES.RED, { detailed: true });
  const freeEval = evaluatePosition(free, SIDES.RED, { detailed: true });

  assert.ok(freeEval.terms.red.coordination > blockedEval.terms.red.coordination);
  assert.ok(freeEval.difference.coordination > blockedEval.difference.coordination);
});

test("evaluation descriptions surface horse unblocking as coordination", () => {
  const position = parseFen("4k4/9/9/9/9/4P4/4H4/9/9/4K4 r");
  const next = applyLegalMove(position, {
    from: coordToIndex("e5"),
    to: coordToIndex("e4")
  });
  const delta = evaluateMoveDelta(position, next, SIDES.RED);
  const notes = describeEvaluationTerms(delta.delta);

  assert.ok(delta.delta.coordination > 0);
  assert.ok(notes.some((note) => note.term === "coordination" && note.text.includes("piece coordination")));
});

test("evaluation rewards cannon screen pressure on the enemy general", () => {
  const openLine = parseFen("4k4/9/9/9/9/9/9/9/9/3KC4 r");
  const screenedLine = parseFen("4k4/9/9/9/9/4P4/9/9/9/3KC4 r");
  const openEval = evaluatePosition(openLine, SIDES.RED, { detailed: true });
  const screenedEval = evaluatePosition(screenedLine, SIDES.RED, { detailed: true });

  assert.ok(screenedEval.terms.red.linePressure > openEval.terms.red.linePressure);
  assert.ok(screenedEval.difference.linePressure > openEval.difference.linePressure);
});

test("evaluation descriptions surface cannon screen creation as line pressure", () => {
  const position = parseFen("4k4/9/9/9/3P5/9/9/9/9/3KC4 r");
  const next = applyLegalMove(position, {
    from: coordToIndex("d4"),
    to: coordToIndex("e4")
  });
  const delta = evaluateMoveDelta(position, next, SIDES.RED);
  const notes = describeEvaluationTerms(delta.delta);

  assert.ok(delta.delta.linePressure > 0);
  assert.ok(notes.some((note) => note.term === "linePressure" && note.text.includes("line pressure")));
});
