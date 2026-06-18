import test from "node:test";
import assert from "node:assert/strict";
import {
  SIDES,
  applyLegalMove,
  coordToIndex,
  createInitialPosition,
  describeEvaluationTerms,
  evaluateMoveDelta,
  evaluatePosition,
  makeMove,
  parseMoveNotation,
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

test("evaluation discourages early cannon lifts before horse development", () => {
  const position = createInitialPosition();
  const central = makeMove(position, parseMoveNotation("b7-e7"));
  const lifted = makeMove(position, parseMoveNotation("b7-b5"));
  const deepCapture = makeMove(position, parseMoveNotation("b7-b0"));
  const centralEval = evaluatePosition(central, SIDES.RED, { detailed: true });
  const liftedEval = evaluatePosition(lifted, SIDES.RED, { detailed: true });
  const deepEval = evaluatePosition(deepCapture, SIDES.RED, { detailed: true });
  const liftedDelta = evaluateMoveDelta(position, lifted, SIDES.RED);
  const notes = describeEvaluationTerms(liftedDelta.delta);

  assert.equal(centralEval.terms.red.openingDiscipline, 0);
  assert.ok(liftedEval.terms.red.openingDiscipline <= -70);
  assert.ok(deepEval.terms.red.openingDiscipline <= -540);
  assert.ok(centralEval.score > liftedEval.score);
  assert.ok(centralEval.score > deepEval.score);
  assert.ok(notes.some((note) => note.term === "openingDiscipline" && note.text.includes("opening piece discipline")));
});

test("evaluation discourages shifted wing-cannon pawn grabs before horse development", () => {
  const position = parseFen("rheakaehr/9/1c4c2/p1p1p1p1p/9/6P2/P1P1P3P/4C2C1/9/RHEAKAEHR b");
  const centralize = makeMove(position, parseMoveNotation("b2-e2"));
  const pawnGrab = makeMove(position, parseMoveNotation("g2-g5"));
  const centralizeEval = evaluatePosition(centralize, SIDES.BLACK, { detailed: true });
  const pawnGrabEval = evaluatePosition(pawnGrab, SIDES.BLACK, { detailed: true });
  const delta = evaluateMoveDelta(position, pawnGrab, SIDES.BLACK);

  assert.equal(centralizeEval.terms.black.openingDiscipline, 0);
  assert.ok(pawnGrabEval.terms.black.openingDiscipline <= -100);
  assert.ok(centralizeEval.score > pawnGrabEval.score);
  assert.ok(delta.delta.openingDiscipline <= -100);
});

test("evaluation discourages early rook lifts before wing horse development", () => {
  const position = createInitialPosition();
  const rookLift = makeMove(position, parseMoveNotation("a9-a8"));
  const centralCannon = makeMove(position, parseMoveNotation("b7-e7"));
  const liftedEval = evaluatePosition(rookLift, SIDES.RED, { detailed: true });
  const centralEval = evaluatePosition(centralCannon, SIDES.RED, { detailed: true });

  assert.ok(liftedEval.terms.red.openingDiscipline <= -120);
  assert.equal(centralEval.terms.red.openingDiscipline, 0);
  assert.ok(centralEval.score > liftedEval.score);
});

test("evaluation discourages shallow edge-rook lifts after wing horse development", () => {
  const doubleHorsePosition = parseFen("rheakae1r/9/1c4hc1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1H2/9/RHEAKAE1R b");
  const blackPosition = parseFen("rheakae1r/9/1c4hc1/p1p1p3p/6p2/9/P1P1P1P1P/1C2C1H2/9/RHEAKAER1 b");
  const shiftedPosition = parseFen("r1eakae1r/9/1ch3hc1/p1p1p1p1p/9/9/P1P1P1P1P/2HCC4/9/R1EAKAEHR b");
  const redPosition = parseFen("rheakae1r/9/1c4hc1/p3p1p1p/2p6/9/P1P1P1P1P/1C2C1H2/9/RHEAKAE1R r");
  const doubleHorseLift = makeMove(doubleHorsePosition, parseMoveNotation("i0-i2"));
  const doubleHorseConnect = makeMove(doubleHorsePosition, parseMoveNotation("i0-h0"));
  const blackLift = makeMove(blackPosition, parseMoveNotation("i0-i1"));
  const blackConnect = makeMove(blackPosition, parseMoveNotation("i0-h0"));
  const shiftedLift = makeMove(shiftedPosition, parseMoveNotation("a0-a1"));
  const shiftedConnect = makeMove(shiftedPosition, parseMoveNotation("a0-b0"));
  const redLift = makeMove(redPosition, parseMoveNotation("i9-i8"));
  const redConnect = makeMove(redPosition, parseMoveNotation("i9-h9"));
  const doubleHorseLiftEval = evaluatePosition(doubleHorseLift, SIDES.BLACK, { detailed: true });
  const doubleHorseConnectEval = evaluatePosition(doubleHorseConnect, SIDES.BLACK, { detailed: true });
  const blackLiftEval = evaluatePosition(blackLift, SIDES.BLACK, { detailed: true });
  const blackConnectEval = evaluatePosition(blackConnect, SIDES.BLACK, { detailed: true });
  const shiftedLiftEval = evaluatePosition(shiftedLift, SIDES.BLACK, { detailed: true });
  const shiftedConnectEval = evaluatePosition(shiftedConnect, SIDES.BLACK, { detailed: true });
  const redLiftEval = evaluatePosition(redLift, SIDES.RED, { detailed: true });
  const redConnectEval = evaluatePosition(redConnect, SIDES.RED, { detailed: true });

  assert.ok(doubleHorseLiftEval.terms.black.openingDiscipline <= -90);
  assert.equal(doubleHorseConnectEval.terms.black.openingDiscipline, 0);
  assert.ok(blackLiftEval.terms.black.openingDiscipline <= -90);
  assert.equal(blackConnectEval.terms.black.openingDiscipline, 0);
  assert.ok(shiftedLiftEval.terms.black.openingDiscipline <= -90);
  assert.equal(shiftedConnectEval.terms.black.openingDiscipline, 0);
  assert.ok(redLiftEval.terms.red.openingDiscipline <= -90);
  assert.equal(redConnectEval.terms.red.openingDiscipline, 0);
  assert.ok(doubleHorseConnectEval.score > doubleHorseLiftEval.score);
  assert.ok(blackConnectEval.score > blackLiftEval.score);
  assert.ok(shiftedConnectEval.score > shiftedLiftEval.score);
  assert.ok(redConnectEval.score > redLiftEval.score);
});

test("evaluation discourages deep cannon raids even after horse development", () => {
  const position = parseFen("rheakae1r/9/1c4hc1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1H2/9/RHEAKAE1R b");
  const pawnBreak = makeMove(position, parseMoveNotation("c3-c4"));
  const nearBackRank = makeMove(position, parseMoveNotation("h2-h8"));
  const backRank = makeMove(position, parseMoveNotation("h2-h9"));
  const pawnBreakEval = evaluatePosition(pawnBreak, SIDES.BLACK, { detailed: true });
  const nearBackRankEval = evaluatePosition(nearBackRank, SIDES.BLACK, { detailed: true });
  const backRankEval = evaluatePosition(backRank, SIDES.BLACK, { detailed: true });

  assert.equal(pawnBreakEval.terms.black.openingDiscipline, 0);
  assert.ok(nearBackRankEval.terms.black.openingDiscipline <= -250);
  assert.ok(backRankEval.terms.black.openingDiscipline <= -650);
  assert.ok(pawnBreakEval.score > nearBackRankEval.score);
  assert.ok(pawnBreakEval.score > backRankEval.score);
});

test("evaluation discourages opening cannon raids into an enemy rook file", () => {
  const position = parseFen("rheakae1r/9/1c4hc1/p1p1p3p/6p2/9/P1P1P1P1P/1C2C1H2/9/RHEAKAER1 b");
  const exposedCannon = makeMove(position, parseMoveNotation("h2-h7"));
  const compactCannon = makeMove(position, parseMoveNotation("h2-h4"));
  const exposedEval = evaluatePosition(exposedCannon, SIDES.BLACK, { detailed: true });
  const compactEval = evaluatePosition(compactCannon, SIDES.BLACK, { detailed: true });
  const delta = evaluateMoveDelta(position, exposedCannon, SIDES.BLACK);

  assert.ok(exposedEval.terms.black.openingDiscipline <= -300);
  assert.ok(compactEval.terms.black.openingDiscipline <= -100);
  assert.ok(exposedEval.terms.black.openingDiscipline < compactEval.terms.black.openingDiscipline - 200);
  assert.ok(compactEval.score > exposedEval.score);
  assert.ok(delta.delta.openingDiscipline <= -300);
});

test("evaluation keeps deep central-cannon checks under opening discipline", () => {
  const position = parseFen("rheakaehr/7c1/9/p3p1p1p/2p6/9/P1P1P1P1P/1c7/4A1C1C/RHE1KAEHR b");
  const centralCheck = makeMove(position, parseMoveNotation("b7-e7"));
  const rookPatrol = makeMove(position, parseMoveNotation("a0-a2"));
  const centralEval = evaluatePosition(centralCheck, SIDES.BLACK, { detailed: true });
  const patrolEval = evaluatePosition(rookPatrol, SIDES.BLACK, { detailed: true });

  assert.ok(centralEval.terms.black.openingDiscipline <= -900);
  assert.ok(patrolEval.terms.black.openingDiscipline > -800);
  assert.ok(patrolEval.score > centralEval.score);
});

test("evaluation caps opening cannon discipline after a major material win", () => {
  const position = parseFen("rc1akaeh1/7r1/2h1e4/p1p1p1p1p/9/8P/P1P1P1PcR/E5CC1/4K4/RH1A1AEH1 r");
  const rookCapture = makeMove(position, parseMoveNotation("h7-h1"));
  const delta = evaluateMoveDelta(position, rookCapture, SIDES.RED);
  const afterEval = evaluatePosition(rookCapture, SIDES.RED, { detailed: true });

  assert.ok(delta.delta.material >= 900);
  assert.ok(delta.delta.openingDiscipline > -750);
  assert.ok(delta.deltaScore > 250);
  assert.ok(afterEval.score > 0);
});

test("evaluation keeps pseudo king-capture threats finite", () => {
  const position = parseFen("r2akaeh1/8r/4e1cC1/p1C1h1p2/4p3p/9/P1P1P1P1P/E4R3/9/1H1AKAER1 r");
  const greedyAttack = makeMove(position, parseMoveNotation("f7-f0"));
  const stableRook = makeMove(position, parseMoveNotation("f7-f3"));
  const greedyDelta = evaluateMoveDelta(position, greedyAttack, SIDES.RED);
  const stableDelta = evaluateMoveDelta(position, stableRook, SIDES.RED);

  assert.ok(greedyDelta.delta.threats < 150);
  assert.ok(stableDelta.deltaScore > greedyDelta.deltaScore);
});

test("evaluation fades opening discipline in developed full-piece middlegames", () => {
  const position = parseFen("rheakae2/8r/4c1hc1/2p1p1p1p/p8/3C2P2/P1P1P2CP/4E4/8R/RHEAKA1H1 r");
  const slowHorse = makeMove(position, parseMoveNotation("b9-c7"));
  const activeHorse = makeMove(position, parseMoveNotation("h9-g7"));
  const slowEval = evaluatePosition(slowHorse, SIDES.RED, { detailed: true });
  const activeEval = evaluatePosition(activeHorse, SIDES.RED, { detailed: true });

  assert.equal(slowEval.terms.red.openingDiscipline, 0);
  assert.equal(activeEval.terms.red.openingDiscipline, 0);
  assert.ok(activeEval.score > slowEval.score);
});

test("evaluation discourages repeated wing-cannon lifts after the wing horse develops", () => {
  const position = parseFen("r1eakae1r/9/1ch3hc1/p1p1p1p1p/9/9/P1P1P1P1P/2HCC4/9/R1EAKAEHR b");
  const shortLift = makeMove(position, parseMoveNotation("b2-b3"));
  const cannonLift = makeMove(position, parseMoveNotation("b2-b5"));
  const pawnBreak = makeMove(position, parseMoveNotation("c3-c4"));
  const rookConnect = makeMove(position, parseMoveNotation("a0-b0"));
  const shortLiftEval = evaluatePosition(shortLift, SIDES.BLACK, { detailed: true });
  const liftedEval = evaluatePosition(cannonLift, SIDES.BLACK, { detailed: true });
  const pawnEval = evaluatePosition(pawnBreak, SIDES.BLACK, { detailed: true });
  const rookEval = evaluatePosition(rookConnect, SIDES.BLACK, { detailed: true });

  assert.ok(shortLiftEval.terms.black.openingDiscipline <= -60);
  assert.ok(liftedEval.terms.black.openingDiscipline <= -120);
  assert.equal(pawnEval.terms.black.openingDiscipline, 0);
  assert.equal(rookEval.terms.black.openingDiscipline, 0);
  assert.ok(pawnEval.score > shortLiftEval.score);
  assert.ok(pawnEval.score > liftedEval.score);
  assert.ok(rookEval.score > liftedEval.score);
});

test("evaluation discourages crowding both cannons onto one wing", () => {
  const position = parseFen("rheakae1r/9/1c4hc1/p1p1p1p1p/9/6P2/P1P1P3P/1C2C4/9/RHEAKAEHR b");
  const crowded = makeMove(position, parseMoveNotation("b2-f2"));
  const central = makeMove(position, parseMoveNotation("b2-e2"));
  const sidestep = makeMove(position, parseMoveNotation("h2-i2"));
  const crowdedEval = evaluatePosition(crowded, SIDES.BLACK, { detailed: true });
  const centralEval = evaluatePosition(central, SIDES.BLACK, { detailed: true });
  const sidestepEval = evaluatePosition(sidestep, SIDES.BLACK, { detailed: true });

  assert.ok(crowdedEval.terms.black.openingDiscipline <= -45);
  assert.equal(centralEval.terms.black.openingDiscipline, 0);
  assert.equal(sidestepEval.terms.black.openingDiscipline, 0);
  assert.ok(centralEval.score > crowdedEval.score);
  assert.ok(sidestepEval.score > crowdedEval.score);
});

test("evaluation discourages horses from jumping into an enemy rook file", () => {
  const position = parseFen("rheakae1r/9/1c4hc1/p1p1p3p/6p2/9/P1P1P1P1P/1C2C1H2/9/RHEAKAER1 b");
  const exposedHorse = makeMove(position, parseMoveNotation("g2-h4"));
  const rookConnect = makeMove(position, parseMoveNotation("i0-h0"));
  const exposedEval = evaluatePosition(exposedHorse, SIDES.BLACK, { detailed: true });
  const rookEval = evaluatePosition(rookConnect, SIDES.BLACK, { detailed: true });

  assert.ok(exposedEval.terms.black.openingDiscipline <= -300);
  assert.equal(rookEval.terms.black.openingDiscipline, 0);
  assert.ok(rookEval.score > exposedEval.score);
});

test("evaluation discourages opening horses from retreating into the palace", () => {
  const position = parseFen("r1eakae1r/9/1ch3hc1/p1p1p1p1p/9/9/P1P1P1P1P/2HCC4/9/R1EAKAEHR b");
  const palaceRetreat = makeMove(position, parseMoveNotation("c2-e1"));
  const pawnBreak = makeMove(position, parseMoveNotation("c3-c4"));
  const retreatEval = evaluatePosition(palaceRetreat, SIDES.BLACK, { detailed: true });
  const pawnEval = evaluatePosition(pawnBreak, SIDES.BLACK, { detailed: true });

  assert.ok(retreatEval.terms.black.openingDiscipline <= -120);
  assert.equal(pawnEval.terms.black.openingDiscipline, 0);
  assert.ok(pawnEval.score > retreatEval.score);
});

test("evaluation delays central elephants after both wing horses develop", () => {
  const doubleHorsePosition = parseFen("r1eakae1r/9/1ch3hc1/p1p1p1p1p/9/9/P1P1P1P1P/2HCC4/9/R1EAKAEHR b");
  const singleHorsePosition = parseFen("r1eakaehr/9/1ch4c1/p1p1p1p1p/9/6P2/P1P1P3P/1C2C4/9/RHEAKAEHR b");
  const delayedElephant = makeMove(doubleHorsePosition, parseMoveNotation("c0-e2"));
  const pawnBreak = makeMove(doubleHorsePosition, parseMoveNotation("c3-c4"));
  const developingElephant = makeMove(singleHorsePosition, parseMoveNotation("g0-e2"));
  const delayedEval = evaluatePosition(delayedElephant, SIDES.BLACK, { detailed: true });
  const pawnEval = evaluatePosition(pawnBreak, SIDES.BLACK, { detailed: true });
  const developingEval = evaluatePosition(developingElephant, SIDES.BLACK, { detailed: true });

  assert.ok(delayedEval.terms.black.openingDiscipline <= -25);
  assert.equal(pawnEval.terms.black.openingDiscipline, 0);
  assert.equal(developingEval.terms.black.openingDiscipline, 0);
  assert.ok(pawnEval.score > delayedEval.score);
});

test("evaluation delays advisors and edge pawns before piece development", () => {
  const position = parseFen("r1eakaehr/9/1ch4c1/p1p1p1p1p/9/6P2/P1P1P3P/1C2C4/9/RHEAKAEHR b");
  const advisor = makeMove(position, parseMoveNotation("f0-e1"));
  const edgePawn = makeMove(position, parseMoveNotation("i3-i4"));
  const horse = makeMove(position, parseMoveNotation("h0-g2"));
  const centralPawn = makeMove(position, parseMoveNotation("c3-c4"));
  const advisorEval = evaluatePosition(advisor, SIDES.BLACK, { detailed: true });
  const edgePawnEval = evaluatePosition(edgePawn, SIDES.BLACK, { detailed: true });
  const horseEval = evaluatePosition(horse, SIDES.BLACK, { detailed: true });
  const centralPawnEval = evaluatePosition(centralPawn, SIDES.BLACK, { detailed: true });

  assert.ok(advisorEval.terms.black.openingDiscipline <= -60);
  assert.ok(edgePawnEval.terms.black.openingDiscipline <= -60);
  assert.equal(horseEval.terms.black.openingDiscipline, 0);
  assert.equal(centralPawnEval.terms.black.openingDiscipline, 0);
  assert.ok(horseEval.score > advisorEval.score);
  assert.ok(centralPawnEval.score > edgePawnEval.score);
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

test("evaluation preserves representative control-map scores", () => {
  const cases = [{
    fen: "rheakaehr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RHEAKAEHR r",
    score: 0,
    sideScores: { red: 25377, black: 25377 },
    terms: { pieceSafety: 0, guardPressure: 0, kingSafety: 0, pawnStructure: 0 }
  }, {
    fen: "4k4/9/9/4r4/9/4R4/P8/9/9/4K4 r",
    score: 201,
    sideScores: { red: 21264, black: 21063 },
    terms: { pieceSafety: 0, guardPressure: 0, kingSafety: 0, pawnStructure: 0 }
  }, {
    fen: "4k4/4a4/9/9/9/4R4/9/9/9/4K4 r",
    score: 1233,
    sideScores: { red: 21350, black: 20117 },
    terms: { pieceSafety: 7, guardPressure: 96, kingSafety: -19, pawnStructure: 0 }
  }, {
    fen: "4k4/9/9/9/2PP5/4P4/9/9/9/4K4 r",
    score: 906,
    sideScores: { red: 20876, black: 19970 },
    terms: { pieceSafety: 0, guardPressure: 0, kingSafety: 0, pawnStructure: 154 }
  }];

  for (const expected of cases) {
    const evaluation = evaluatePosition(parseFen(expected.fen), SIDES.RED, { detailed: true });
    assert.equal(Math.round(evaluation.score), expected.score);
    assert.deepEqual({
      red: Math.round(evaluation.sideScores.red),
      black: Math.round(evaluation.sideScores.black)
    }, expected.sideScores);
    assert.deepEqual({
      pieceSafety: Math.round(evaluation.difference.pieceSafety),
      guardPressure: Math.round(evaluation.difference.guardPressure),
      kingSafety: Math.round(evaluation.difference.kingSafety),
      pawnStructure: Math.round(evaluation.difference.pawnStructure)
    }, expected.terms);
  }
});
