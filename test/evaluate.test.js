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

test("evaluation rewards linked horses that mutually protect each other", () => {
  const linked = parseFen("4k4/9/9/3H5/9/2H6/9/9/9/4K4 r");
  const scattered = parseFen("4k4/9/9/9/9/2H4H1/9/9/9/4K4 r");
  const linkedEval = evaluatePosition(linked, SIDES.RED, { detailed: true });
  const scatteredEval = evaluatePosition(scattered, SIDES.RED, { detailed: true });

  assert.ok(linkedEval.terms.red.linkedHorse - scatteredEval.terms.red.linkedHorse >= 35);
  assert.ok(linkedEval.difference.linkedHorse > scatteredEval.difference.linkedHorse);
});

test("evaluation descriptions surface linked horse coordination", () => {
  const position = parseFen("4k4/9/9/9/9/2H1H4/4P4/9/9/4K4 r");
  const next = applyLegalMove(position, {
    from: coordToIndex("e5"),
    to: coordToIndex("d3")
  });
  const delta = evaluateMoveDelta(position, next, SIDES.RED);
  const notes = describeEvaluationTerms(delta.delta);

  assert.ok(delta.delta.linkedHorse >= 35);
  assert.ok(notes.some((note) => note.term === "linkedHorse" && note.text.includes("linked horse coordination")));
});

test("evaluation penalizes blocked elephant eyes as piece coordination", () => {
  const blocked = parseFen("4k4/9/9/9/9/4P4/9/9/3P5/2E1K4 r");
  const open = parseFen("4k4/9/9/9/9/4P4/9/9/P8/2E1K4 r");
  const blockedEval = evaluatePosition(blocked, SIDES.RED, { detailed: true });
  const openEval = evaluatePosition(open, SIDES.RED, { detailed: true });

  assert.ok(openEval.terms.red.coordination > blockedEval.terms.red.coordination);
  assert.ok(openEval.difference.coordination > blockedEval.difference.coordination);
});

test("evaluation descriptions surface elephant-eye unblocking", () => {
  const position = parseFen("4k4/9/9/9/9/4P4/9/9/3P5/2E1K4 r");
  const next = applyLegalMove(position, {
    from: coordToIndex("d8"),
    to: coordToIndex("d7")
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

test("evaluation rewards useful cannon platforms against valuable targets", () => {
  const platform = parseFen("3k5/9/4r4/9/9/4P4/9/9/4C4/4K4 r");
  const noTarget = parseFen("3k5/9/r8/9/9/4P4/9/9/4C4/4K4 r");
  const platformEval = evaluatePosition(platform, SIDES.RED, { detailed: true });
  const noTargetEval = evaluatePosition(noTarget, SIDES.RED, { detailed: true });

  assert.ok(platformEval.terms.red.cannonPlatform - noTargetEval.terms.red.cannonPlatform >= 45);
  assert.ok(platformEval.difference.cannonPlatform > noTargetEval.difference.cannonPlatform);
});

test("evaluation descriptions surface cannon platform pressure", () => {
  const position = parseFen("3k5/9/4r4/9/3P5/9/9/9/4C4/4K4 r");
  const next = applyLegalMove(position, {
    from: coordToIndex("d4"),
    to: coordToIndex("e4")
  });
  const delta = evaluateMoveDelta(position, next, SIDES.RED);
  const notes = describeEvaluationTerms(delta.delta);

  assert.ok(delta.delta.cannonPlatform >= 45);
  assert.ok(notes.some((note) => note.term === "cannonPlatform" && note.text.includes("cannon platform pressure")));
});

test("evaluation rewards direct rook pins to the general", () => {
  const pinned = parseFen("4k4/9/9/4h4/9/4R4/9/9/9/4K4 r");
  const unpinned = parseFen("4k4/9/9/4h4/9/R8/9/9/9/4K4 r");
  const pinnedEval = evaluatePosition(pinned, SIDES.RED, { detailed: true });
  const unpinnedEval = evaluatePosition(unpinned, SIDES.RED, { detailed: true });

  assert.ok(pinnedEval.terms.red.pinPressure - unpinnedEval.terms.red.pinPressure >= 45);
  assert.ok(pinnedEval.difference.pinPressure > unpinnedEval.difference.pinPressure);
});

test("evaluation descriptions surface cannon-screen pins", () => {
  const position = parseFen("4k4/9/9/4r4/9/4P4/9/9/2C6/4K4 r");
  const next = applyLegalMove(position, {
    from: coordToIndex("c8"),
    to: coordToIndex("e8")
  });
  const delta = evaluateMoveDelta(position, next, SIDES.RED);
  const notes = describeEvaluationTerms(delta.delta);

  assert.ok(delta.delta.pinPressure >= 85);
  assert.ok(notes.some((note) => note.term === "pinPressure" && note.text.includes("palace pin pressure")));
});

test("evaluation rewards rook-cannon batteries on the general file", () => {
  const battery = parseFen("4k4/9/4a4/9/4R4/9/4C4/9/9/4K4 r");
  const singleFilePressure = parseFen("4k4/9/4a4/9/4R4/9/C8/9/9/4K4 r");
  const batteryEval = evaluatePosition(battery, SIDES.RED, { detailed: true });
  const singleEval = evaluatePosition(singleFilePressure, SIDES.RED, { detailed: true });

  assert.ok(batteryEval.terms.red.batteryPressure - singleEval.terms.red.batteryPressure >= 85);
  assert.ok(batteryEval.difference.batteryPressure > singleEval.difference.batteryPressure);
});

test("evaluation descriptions surface rook-cannon battery pressure", () => {
  const position = parseFen("4k4/9/4a4/9/4R4/9/2C6/9/9/4K4 r");
  const next = applyLegalMove(position, {
    from: coordToIndex("c6"),
    to: coordToIndex("e6")
  });
  const delta = evaluateMoveDelta(position, next, SIDES.RED);
  const notes = describeEvaluationTerms(delta.delta);

  assert.ok(delta.delta.batteryPressure >= 85);
  assert.ok(notes.some((note) => note.term === "batteryPressure" && note.text.includes("battery pressure")));
});

test("evaluation rewards rook control from the river rank", () => {
  const riverRook = parseFen("4k4/9/9/9/9/R3P4/9/9/9/4K4 r");
  const backRook = parseFen("4k4/9/9/9/9/4P4/9/9/9/R3K4 r");
  const riverEval = evaluatePosition(riverRook, SIDES.RED, { detailed: true });
  const backEval = evaluatePosition(backRook, SIDES.RED, { detailed: true });

  assert.ok(riverEval.terms.red.riverControl - backEval.terms.red.riverControl >= 25);
  assert.ok(riverEval.difference.riverControl > backEval.difference.riverControl);
});

test("evaluation descriptions surface river-rank control", () => {
  const position = parseFen("4k4/9/9/9/9/4P4/9/9/9/R3K4 r");
  const next = applyLegalMove(position, {
    from: coordToIndex("a9"),
    to: coordToIndex("a5")
  });
  const delta = evaluateMoveDelta(position, next, SIDES.RED);
  const notes = describeEvaluationTerms(delta.delta);

  assert.ok(delta.delta.riverControl >= 25);
  assert.ok(notes.some((note) => note.term === "riverControl" && note.text.includes("river-rank control")));
});

test("evaluation rewards rooks with open activity", () => {
  const trapped = parseFen("4k4/9/9/9/9/9/9/9/P8/RH2K4 r");
  const active = parseFen("4k4/9/9/9/9/R8/9/9/7P1/1H2K4 r");
  const trappedEval = evaluatePosition(trapped, SIDES.RED, { detailed: true });
  const activeEval = evaluatePosition(active, SIDES.RED, { detailed: true });

  assert.ok(activeEval.terms.red.rookActivity > trappedEval.terms.red.rookActivity);
  assert.ok(activeEval.difference.rookActivity > trappedEval.difference.rookActivity);
});

test("evaluation descriptions surface rook lifts as activity", () => {
  const position = parseFen("4k4/9/9/9/9/4P4/9/9/9/RH2K4 r");
  const next = applyLegalMove(position, {
    from: coordToIndex("a9"),
    to: coordToIndex("a4")
  });
  const delta = evaluateMoveDelta(position, next, SIDES.RED);
  const notes = describeEvaluationTerms(delta.delta);

  assert.ok(delta.delta.rookActivity > 0);
  assert.ok(notes.some((note) => note.term === "rookActivity" && note.text.includes("rook activity")));
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

test("evaluation rewards horses on enemy-palace outposts", () => {
  const outpost = parseFen("4k4/9/2H6/9/9/4P4/9/9/9/4K4 r");
  const passive = parseFen("4k4/9/9/9/9/H3P4/9/9/9/4K4 r");
  const outpostEval = evaluatePosition(outpost, SIDES.RED, { detailed: true });
  const passiveEval = evaluatePosition(passive, SIDES.RED, { detailed: true });

  assert.ok(outpostEval.terms.red.horsePressure - passiveEval.terms.red.horsePressure >= 45);
  assert.ok(outpostEval.difference.horsePressure > passiveEval.difference.horsePressure);
});

test("evaluation descriptions surface horse outpost pressure", () => {
  const position = parseFen("4k4/9/9/H8/9/4P4/9/9/9/4K4 r");
  const next = applyLegalMove(position, {
    from: coordToIndex("a3"),
    to: coordToIndex("c2")
  });
  const delta = evaluateMoveDelta(position, next, SIDES.RED);
  const notes = describeEvaluationTerms(delta.delta);

  assert.ok(delta.delta.horsePressure >= 40);
  assert.ok(notes.some((note) => note.term === "horsePressure" && note.text.includes("horse outpost pressure")));
});

test("evaluation penalizes enemy control of palace escape squares", () => {
  const exposed = parseFen("4k4/9/9/9/9/9/9/3r5/9/4K4 r");
  const safer = parseFen("4k4/9/9/9/r8/9/9/9/9/4K4 r");
  const exposedEval = evaluatePosition(exposed, SIDES.RED, { detailed: true });
  const saferEval = evaluatePosition(safer, SIDES.RED, { detailed: true });

  assert.ok(saferEval.terms.red.kingSafety > exposedEval.terms.red.kingSafety);
  assert.ok(saferEval.difference.kingSafety > exposedEval.difference.kingSafety);
});

test("evaluation descriptions surface clearing palace pressure as king safety", () => {
  const position = parseFen("4k4/9/9/9/9/4P4/9/3rR4/9/4K4 r");
  const next = applyLegalMove(position, {
    from: coordToIndex("e7"),
    to: coordToIndex("d7")
  });
  const delta = evaluateMoveDelta(position, next, SIDES.RED);
  const notes = describeEvaluationTerms(delta.delta);

  assert.ok(delta.delta.kingSafety > 0);
  assert.ok(notes.some((note) => note.term === "kingSafety" && note.text.includes("king safety")));
});

test("evaluation rewards intact advisor-elephant fortress shape", () => {
  const fortress = parseFen("4k4/9/9/9/9/4P4/9/9/9/2EAKAE2 r");
  const scattered = parseFen("4k4/9/9/9/9/4P4/9/E7E/4A4/3AK4 r");
  const fortressEval = evaluatePosition(fortress, SIDES.RED, { detailed: true });
  const scatteredEval = evaluatePosition(scattered, SIDES.RED, { detailed: true });

  assert.ok(fortressEval.terms.red.kingSafety - scatteredEval.terms.red.kingSafety >= 45);
  assert.ok(fortressEval.difference.kingSafety > scatteredEval.difference.kingSafety);
});

test("evaluation descriptions surface rebuilding the fortress", () => {
  const position = parseFen("4k4/9/9/9/9/4P4/9/E8/9/3AKAE2 r");
  const next = applyLegalMove(position, {
    from: coordToIndex("a7"),
    to: coordToIndex("c9")
  });
  const delta = evaluateMoveDelta(position, next, SIDES.RED);
  const notes = describeEvaluationTerms(delta.delta);

  assert.ok(delta.delta.kingSafety >= 30);
  assert.ok(notes.some((note) => note.term === "kingSafety" && note.text.includes("king safety")));
});

test("evaluation penalizes palace-center horse congestion", () => {
  const clogged = parseFen("4k4/9/9/9/9/4P4/9/9/4H4/4K4 r");
  const clear = parseFen("4k4/9/9/9/9/H3P4/9/9/9/4K4 r");
  const cloggedEval = evaluatePosition(clogged, SIDES.RED, { detailed: true });
  const clearEval = evaluatePosition(clear, SIDES.RED, { detailed: true });

  assert.ok(clearEval.terms.red.palaceShape - cloggedEval.terms.red.palaceShape >= 55);
  assert.ok(clearEval.difference.palaceShape > cloggedEval.difference.palaceShape);
});

test("evaluation descriptions surface unclogging the palace center", () => {
  const position = parseFen("4k4/9/9/9/9/4P4/9/9/4H4/4K4 r");
  const next = applyLegalMove(position, {
    from: coordToIndex("e8"),
    to: coordToIndex("g7")
  });
  const delta = evaluateMoveDelta(position, next, SIDES.RED);
  const notes = describeEvaluationTerms(delta.delta);

  assert.ok(delta.delta.palaceShape >= 55);
  assert.ok(notes.some((note) => note.term === "palaceShape" && note.text.includes("palace shape")));
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

test("evaluation rewards pressure against palace guards", () => {
  const attacking = parseFen("4k4/4a4/9/9/9/4R4/9/9/9/4K4 r");
  const passive = parseFen("4k4/4a4/9/9/9/R8/9/9/9/4K4 r");
  const attackingEval = evaluatePosition(attacking, SIDES.RED, { detailed: true });
  const passiveEval = evaluatePosition(passive, SIDES.RED, { detailed: true });

  assert.ok(attackingEval.terms.red.guardPressure - passiveEval.terms.red.guardPressure >= 90);
  assert.ok(attackingEval.difference.guardPressure > passiveEval.difference.guardPressure);
});

test("evaluation descriptions surface palace guard pressure", () => {
  const position = parseFen("4k4/4a4/9/9/9/R8/9/9/9/4K4 r");
  const next = applyLegalMove(position, {
    from: coordToIndex("a5"),
    to: coordToIndex("e5")
  });
  const delta = evaluateMoveDelta(position, next, SIDES.RED);
  const notes = describeEvaluationTerms(delta.delta);

  assert.ok(delta.delta.guardPressure >= 90);
  assert.ok(notes.some((note) => note.term === "guardPressure" && note.text.includes("palace guard pressure")));
});

test("evaluation rewards connected advanced pawns as pawn structure", () => {
  const connected = parseFen("4k4/9/9/9/2PP5/4P4/9/9/9/4K4 r");
  const separated = parseFen("4k4/9/9/9/2P1P4/4P4/9/9/9/4K4 r");
  const connectedEval = evaluatePosition(connected, SIDES.RED, { detailed: true });
  const separatedEval = evaluatePosition(separated, SIDES.RED, { detailed: true });

  assert.ok(connectedEval.terms.red.pawnStructure > separatedEval.terms.red.pawnStructure);
  assert.ok(connectedEval.difference.pawnStructure > separatedEval.difference.pawnStructure);
});

test("evaluation rewards soldiers that invade the enemy palace", () => {
  const invading = parseFen("4k4/9/4P4/9/9/9/9/9/9/4K4 r");
  const flank = parseFen("4k4/9/9/9/P8/9/9/9/9/4K4 r");
  const invadingEval = evaluatePosition(invading, SIDES.RED, { detailed: true });
  const flankEval = evaluatePosition(flank, SIDES.RED, { detailed: true });

  assert.ok(invadingEval.terms.red.pawnStructure - flankEval.terms.red.pawnStructure >= 70);
  assert.ok(invadingEval.difference.pawnStructure > flankEval.difference.pawnStructure);
});

test("evaluation rewards clear passed soldiers near the enemy palace", () => {
  const runner = parseFen("4k4/9/9/4P4/9/9/9/9/9/4K4 r");
  const flank = parseFen("4k4/9/9/P8/9/9/9/9/9/4K4 r");
  const blocked = parseFen("4k4/9/4h4/4P4/9/9/9/9/9/4K4 r");
  const runnerEval = evaluatePosition(runner, SIDES.RED, { detailed: true });
  const flankEval = evaluatePosition(flank, SIDES.RED, { detailed: true });
  const blockedEval = evaluatePosition(blocked, SIDES.RED, { detailed: true });

  assert.ok(runnerEval.terms.red.passedSoldier - flankEval.terms.red.passedSoldier >= 25);
  assert.ok(runnerEval.terms.red.passedSoldier > blockedEval.terms.red.passedSoldier);
  assert.ok(runnerEval.difference.passedSoldier > flankEval.difference.passedSoldier);
});

test("evaluation descriptions surface passed soldier pressure", () => {
  const position = parseFen("4k4/9/9/9/4P4/9/9/9/9/4K4 r");
  const next = applyLegalMove(position, {
    from: coordToIndex("e4"),
    to: coordToIndex("e3")
  });
  const delta = evaluateMoveDelta(position, next, SIDES.RED);
  const notes = describeEvaluationTerms(delta.delta);

  assert.ok(delta.delta.passedSoldier >= 10);
  assert.ok(notes.some((note) => note.term === "passedSoldier" && note.text.includes("passed soldier pressure")));
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
  assert.ok(notes.some((note) => note.term === "pawnStructure" && note.text.includes("pawn progress")));
});

test("evaluation descriptions surface soldier palace invasion", () => {
  const position = parseFen("4k4/9/9/4P4/9/9/9/9/9/4K4 r");
  const next = applyLegalMove(position, {
    from: coordToIndex("e3"),
    to: coordToIndex("e2")
  });
  const delta = evaluateMoveDelta(position, next, SIDES.RED);
  const notes = describeEvaluationTerms(delta.delta);

  assert.ok(delta.delta.pawnStructure >= 30);
  assert.ok(notes.some((note) => note.term === "pawnStructure" && note.text.includes("palace invasion")));
});
