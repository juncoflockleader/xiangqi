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

test("evaluation rewards attacks into the enemy palace", () => {
  const attacking = parseFen("4k4/9/4H4/9/9/4P4/9/9/9/4K4 r");
  const passive = parseFen("4k4/9/9/9/9/H3P4/9/9/9/4K4 r");
  const attackingEval = evaluatePosition(attacking, SIDES.RED, { detailed: true });
  const passiveEval = evaluatePosition(passive, SIDES.RED, { detailed: true });

  assert.ok(attackingEval.terms.red.kingAttack > passiveEval.terms.red.kingAttack);
  assert.ok(attackingEval.difference.kingAttack > passiveEval.difference.kingAttack);
});

test("evaluation descriptions surface pressure on the general", () => {
  const position = parseFen("4k4/9/9/H8/9/4P4/9/9/9/4K4 r");
  const next = applyLegalMove(position, {
    from: coordToIndex("a3"),
    to: coordToIndex("c2")
  });
  const delta = evaluateMoveDelta(position, next, SIDES.RED);
  const notes = describeEvaluationTerms(delta.delta);

  assert.ok(delta.delta.kingAttack > 0);
  assert.ok(notes.some((note) => note.term === "kingAttack" && note.text.includes("pressure on the general")));
});

test("evaluation penalizes loose attacked pieces", () => {
  const loose = parseFen("4k4/9/9/4r4/9/4R4/P8/9/9/4K4 r");
  const defended = parseFen("4k4/9/9/4r4/9/4R4/4P4/9/9/4K4 r");
  const looseEval = evaluatePosition(loose, SIDES.RED, { detailed: true });
  const defendedEval = evaluatePosition(defended, SIDES.RED, { detailed: true });

  assert.ok(defendedEval.terms.red.pieceSafety > looseEval.terms.red.pieceSafety);
  assert.ok(defendedEval.difference.pieceSafety > looseEval.difference.pieceSafety);
});

test("evaluation descriptions surface improved piece safety", () => {
  const position = parseFen("4k4/9/9/4r4/9/4R4/9/4P4/9/4K4 r");
  const next = applyLegalMove(position, {
    from: coordToIndex("e7"),
    to: coordToIndex("e6")
  });
  const delta = evaluateMoveDelta(position, next, SIDES.RED);
  const notes = describeEvaluationTerms(delta.delta);

  assert.ok(delta.delta.pieceSafety > 0);
  assert.ok(notes.some((note) => note.term === "pieceSafety" && note.text.includes("piece safety")));
});

test("evaluation rewards connected advanced pawns as pawn structure", () => {
  const connected = parseFen("4k4/9/9/9/2PP5/4P4/9/9/9/4K4 r");
  const separated = parseFen("4k4/9/9/9/2P1P4/4P4/9/9/9/4K4 r");
  const connectedEval = evaluatePosition(connected, SIDES.RED, { detailed: true });
  const separatedEval = evaluatePosition(separated, SIDES.RED, { detailed: true });

  assert.ok(connectedEval.terms.red.pawnStructure > separatedEval.terms.red.pawnStructure);
  assert.ok(connectedEval.difference.pawnStructure > separatedEval.difference.pawnStructure);
});

test("evaluation descriptions surface connected pawn support", () => {
  const position = parseFen("4k4/9/9/9/2P6/3PP4/9/9/9/4K4 r");
  const next = applyLegalMove(position, {
    from: coordToIndex("d5"),
    to: coordToIndex("d4")
  });
  const delta = evaluateMoveDelta(position, next, SIDES.RED);
  const notes = describeEvaluationTerms(delta.delta);

  assert.ok(delta.delta.pawnStructure > 0);
  assert.ok(notes.some((note) => note.term === "pawnStructure" && note.text.includes("pawn progress and support")));
});
