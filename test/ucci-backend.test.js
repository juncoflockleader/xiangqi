import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialPosition,
  createUcciEngineBackend,
  describeEngineBackend,
  ENGINE_BACKEND_FEATURES,
  generateLegalMoves,
  makeMove
} from "../src/index.js";

const MOCK_UCCI_PATH = new URL("../fixtures/mock-ucci.mjs", import.meta.url);

test("UCCI backend uses the explainable opening book before native search", async () => {
  const backend = createUcciEngineBackend({
    command: "/path/that/should/not/start",
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 100,
    commandTimeoutMs: 100
  });

  const result = await backend.chooseMove(createInitialPosition());

  assert.equal(result.source, "opening-book");
  assert.equal(result.bestMove.notation, "h7-e7");
  assert.equal(result.depth, 0);
  assert.equal(result.native.skipped, true);
  assert.ok(result.explanation.reasons.some((reason) => reason.includes("Opening book")));
  await backend.close();
});

test("UCCI backend validates and rejects unsafe opening heuristics with native search", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    engineOptions: {
      MockRejectHeuristic: true
    }
  });
  let position = createInitialPosition();
  for (const move of ["h7-e7", "h0-g2", "h9-g7", "g3-g4", "b9-c7", "i0-h0"]) {
    position = backend.play(position, move);
  }

  try {
    const raw = await backend.chooseMove(position, { book: {}, validateOpeningHeuristics: false });
    const result = await backend.chooseMove(position, { book: {}, lines: 2 });

    assert.equal(raw.source, "opening-heuristic");
    assert.equal(raw.bestMove.notation, "e7-e3");
    assert.equal(result.source, "native-ucci");
    assert.equal(result.bestMove.notation, "b7-b3");
    assert.equal(result.openingHeuristicValidation.status, "rejected");
    assert.equal(result.openingHeuristicValidation.source, "native-ucci");
    assert.equal(result.openingHeuristicValidation.heuristicMove, "e7-e3");
    assert.equal(result.openingHeuristicValidation.searchBestMove, "b7-b3");
    assert.ok(result.openingHeuristicValidation.centipawnLoss > result.openingHeuristicValidation.maxCentipawnLoss);
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("Rejected opening heuristic e7-e3")));
    assert.equal(result.explanation.search.openingHeuristicValidation.status, "rejected");
  } finally {
    await backend.close();
  }
});

test("UCCI backend searches through an external process", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000
  });

  try {
    const result = await backend.chooseMove(createInitialPosition(), { useBook: false });
    const description = describeEngineBackend(backend);

    assert.equal(backend.supports(ENGINE_BACKEND_FEATURES.NATIVE_READY), true);
    assert.equal(backend.supports(ENGINE_BACKEND_FEATURES.ASYNC_SEARCH), true);
    assert.equal(backend.supports(ENGINE_BACKEND_FEATURES.REVIEW), true);
    assert.equal(backend.supports(ENGINE_BACKEND_FEATURES.EXPLANATION), true);
    assert.equal(description.kind, "native-ucci");
    assert.equal(description.settings.profile, null);
    assert.equal(description.settings.protocol, "ucci");
    assert.equal(description.settings.depth, 2);
    assert.equal(description.settings.timeLimitMs, 500);
    assert.equal(result.source, "native-ucci");
    assert.equal(result.bestMove.notation, "h9-g7");
    assert.equal(result.depth, 2);
    assert.equal(result.nodes, 123);
    assert.equal(result.principalVariation.map((move) => move.notation).join(" "), "h9-g7 h0-g2");
    assert.ok(result.explanation.summary.includes("Native UCCI Engine"));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("UCCI search")));
    assert.ok(result.explanation.confidence.score >= 0);
    assert.ok(result.explanation.confidence.factors.some((factor) => factor.kind === "depth"));
    assert.equal(result.explanation.linePlan.firstMove, "h9-g7");
    assert.equal(result.explanation.linePlan.expectedReply, "h0-g2");
  } finally {
    await backend.close();
  }
});

test("native backend preserves search telemetry from info lines", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    profile: "native-uci",
    depth: 3,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    engineOptions: {
      MockDepthFromGo: true,
      MockTelemetry: true
    }
  });

  try {
    const result = await backend.chooseMove(createInitialPosition(), { useBook: false });

    assert.equal(result.depth, 3);
    assert.equal(result.seldepth, 7);
    assert.equal(result.nodes, 123);
    assert.equal(result.timeMs, 15);
    assert.equal(result.nps, 8200);
    assert.equal(result.hashfull, 321);
    assert.equal(result.memoryAge, 3);
    assert.deepEqual(result.telemetry, {
      seldepth: 7,
      timeMs: 15,
      nps: 8200,
      hashfull: 321,
      hashfullText: "32.1%"
    });
    assert.equal(result.stats.seldepth, 7);
    assert.equal(result.stats.timeMs, 15);
    assert.equal(result.stats.nps, 8200);
    assert.equal(result.stats.hashfull, 321);
    assert.equal(result.stats.memoryAge, 3);
    assert.equal(result.stats.repetitions, 2);
    assert.equal(result.stats.qnodes, 44);
    assert.equal(result.stats.qchecks, 5);
    assert.equal(result.stats.qCheckHistoryHits, 6);
    assert.equal(result.stats.qCheckHistoryStores, 9);
    assert.equal(result.stats.qCheckHistoryMaluses, 4);
    assert.equal(result.stats.qCaptureHistoryPruneGuards, 3);
    assert.equal(result.stats.qCaptureHistoryHits, 10);
    assert.equal(result.stats.qCaptureHistoryStores, 11);
    assert.equal(result.stats.qCaptureHistoryMaluses, 12);
    assert.equal(result.stats.qttHits, 11);
    assert.equal(result.stats.qttStores, 17);
    assert.equal(result.stats.qttMoveHits, 2);
    assert.equal(result.stats.evalCacheHits, 19);
    assert.equal(result.stats.evalCacheStores, 29);
    assert.equal(result.stats.checkedEvalSkips, 31);
    assert.equal(result.stats.ttHits, 5);
    assert.equal(result.stats.ttMoveHits, 6);
    assert.equal(result.stats.cutoffs, 2);
    assert.equal(result.stats.captureHistoryHits, 12);
    assert.equal(result.stats.captureHistoryStores, 5);
    assert.equal(result.stats.captureHistoryMaluses, 7);
    assert.equal(result.stats.captureHistoryPruneGuards, 2);
    assert.equal(result.stats.killerHits, 3);
    assert.equal(result.stats.nullMovePrunes, 1);
    assert.equal(result.stats.nullMoveVerifications, 2);
    assert.equal(result.stats.nullMoveVerificationFailures, 1);
    assert.equal(result.stats.nullMoveMaterialGuards, 6);
    assert.equal(result.stats.reverseFutilityPrunes, 9);
    assert.equal(result.stats.mateDistancePrunes, 2);
    assert.equal(result.stats.razorPrunes, 4);
    assert.equal(result.stats.razorResearches, 1);
    assert.equal(result.stats.seePrunes, 3);
    assert.equal(result.stats.probCutPrunes, 2);
    assert.equal(result.stats.probCutSearches, 7);
    assert.equal(result.stats.probCutCaptureSkips, 8);
    assert.equal(result.stats.futilityPrunes, 6);
    assert.equal(result.stats.badHistoryPrunes, 5);
    assert.equal(result.stats.badHistoryPruneGuards, 2);
    assert.equal(result.stats.deltaPrunes, 12);
    assert.equal(result.stats.qDeltaPrefilterSkips, 15);
    assert.equal(result.stats.qSeePrunes, 13);
    assert.equal(result.stats.lateMovePrunes, 4);
    assert.equal(result.stats.depthThreeLateMovePrunes, 2);
    assert.equal(result.stats.reductions, 7);
    assert.equal(result.stats.reductionPlies, 11);
    assert.equal(result.stats.deepReductions, 3);
    assert.equal(result.stats.lmrResearches, 2);
    assert.equal(result.stats.pvReductionGuards, 5);
    assert.equal(result.stats.cutNodeReductionBoosts, 6);
    assert.equal(result.stats.improvingNodes, 10);
    assert.equal(result.stats.nonImprovingNodes, 4);
    assert.equal(result.stats.improvingReductionGuards, 2);
    assert.equal(result.stats.nonImprovingReductionBoosts, 3);
    assert.equal(result.stats.improvingLateMoveGuards, 1);
    assert.equal(result.stats.nonImprovingLateMovePrunes, 2);
    assert.equal(result.stats.countermoveHits, 6);
    assert.equal(result.stats.continuationHistoryHits, 8);
    assert.equal(result.stats.continuationReductionBoosts, 3);
    assert.equal(result.stats.continuationReductionMaluses, 1);
    assert.equal(result.stats.checkEvasionOrderHits, 18);
    assert.equal(result.stats.checkEvasionCaptures, 4);
    assert.equal(result.stats.checkEvasionBlocks, 9);
    assert.equal(result.stats.checkEvasionKingMoves, 5);
    assert.equal(result.stats.checkHistoryHits, 14);
    assert.equal(result.stats.checkHistoryStores, 9);
    assert.equal(result.stats.checkHistoryMaluses, 2);
    assert.equal(result.stats.checkCacheHits, 21);
    assert.equal(result.stats.checkCacheStores, 34);
    assert.equal(result.stats.iidSearches, 4);
    assert.equal(result.stats.iidMoveHits, 3);
    assert.equal(result.stats.rootMovesSearched, 12);
    assert.equal(result.stats.rootChildStateReuses, 24);
    assert.equal(result.stats.rootReductions, 5);
    assert.equal(result.stats.rootReductionResearches, 2);
    assert.equal(result.stats.rootReductionPlies, 7);
    assert.equal(result.stats.rootTtHits, 1);
    assert.equal(result.stats.rootTtStores, 3);
    assert.equal(result.stats.rootOrderHits, 7);
    assert.equal(result.stats.rootOrderStores, 8);
    assert.equal(result.stats.rootTimeGuardStops, 4);
    assert.equal(result.stats.openingPreferencePromotions, 6);
    assert.equal(result.stats.pvsResearches, 3);
    assert.equal(result.stats.aspirationSearches, 5);
    assert.equal(result.stats.aspirationWidenedSearches, 2);
    assert.equal(result.stats.aspirationFailHigh, 1);
    assert.equal(result.stats.aspirationFailLow, 2);
    assert.equal(result.stats.extensions, 8);
    assert.equal(result.stats.recaptureExtensions, 1);
    assert.equal(result.stats.singularExtensionSearches, 4);
    assert.equal(result.stats.singularExtensions, 2);
    assert.equal(result.stats.singularExtensionRejects, 1);
    assert.equal(result.candidates[0].native.memoryAge, 3);
    assert.equal(result.candidates[0].native.telemetry.hashfullText, "32.1%");
    assert.equal(result.iterations[0].telemetry.seldepth, 7);
    assert.equal(result.iterations[0].memoryAge, 3);
    assert.equal(result.iterations[0].stats.memoryAge, 3);
    assert.equal(result.iterations[0].stats.repetitions, 2);
    assert.equal(result.iterations[0].stats.qnodes, 44);
    assert.equal(result.iterations[0].stats.qchecks, 5);
    assert.equal(result.iterations[0].stats.qCheckHistoryHits, 6);
    assert.equal(result.iterations[0].stats.qCheckHistoryStores, 9);
    assert.equal(result.iterations[0].stats.qCheckHistoryMaluses, 4);
    assert.equal(result.iterations[0].stats.qCaptureHistoryPruneGuards, 3);
    assert.equal(result.iterations[0].stats.qCaptureHistoryHits, 10);
    assert.equal(result.iterations[0].stats.qCaptureHistoryStores, 11);
    assert.equal(result.iterations[0].stats.qCaptureHistoryMaluses, 12);
    assert.equal(result.iterations[0].stats.qttHits, 11);
    assert.equal(result.iterations[0].stats.evalCacheHits, 19);
    assert.equal(result.iterations[0].stats.checkedEvalSkips, 31);
    assert.equal(result.iterations[0].stats.ttMoveHits, 6);
    assert.equal(result.iterations[0].stats.captureHistoryHits, 12);
    assert.equal(result.iterations[0].stats.captureHistoryStores, 5);
    assert.equal(result.iterations[0].stats.captureHistoryMaluses, 7);
    assert.equal(result.iterations[0].stats.captureHistoryPruneGuards, 2);
    assert.equal(result.iterations[0].stats.extensions, 8);
    assert.equal(result.iterations[0].stats.nullMoveVerifications, 2);
    assert.equal(result.iterations[0].stats.nullMoveVerificationFailures, 1);
    assert.equal(result.iterations[0].stats.nullMoveMaterialGuards, 6);
    assert.equal(result.iterations[0].stats.reverseFutilityPrunes, 9);
    assert.equal(result.iterations[0].stats.mateDistancePrunes, 2);
    assert.equal(result.iterations[0].stats.razorPrunes, 4);
    assert.equal(result.iterations[0].stats.seePrunes, 3);
    assert.equal(result.iterations[0].stats.probCutPrunes, 2);
    assert.equal(result.iterations[0].stats.probCutCaptureSkips, 8);
    assert.equal(result.iterations[0].stats.badHistoryPrunes, 5);
    assert.equal(result.iterations[0].stats.badHistoryPruneGuards, 2);
    assert.equal(result.iterations[0].stats.deltaPrunes, 12);
    assert.equal(result.iterations[0].stats.qDeltaPrefilterSkips, 15);
    assert.equal(result.iterations[0].stats.qSeePrunes, 13);
    assert.equal(result.iterations[0].stats.lateMovePrunes, 4);
    assert.equal(result.iterations[0].stats.depthThreeLateMovePrunes, 2);
    assert.equal(result.iterations[0].stats.pvReductionGuards, 5);
    assert.equal(result.iterations[0].stats.cutNodeReductionBoosts, 6);
    assert.equal(result.iterations[0].stats.improvingNodes, 10);
    assert.equal(result.iterations[0].stats.nonImprovingNodes, 4);
    assert.equal(result.iterations[0].stats.checkCacheHits, 21);
    assert.equal(result.iterations[0].stats.checkCacheStores, 34);
    assert.equal(result.iterations[0].stats.improvingReductionGuards, 2);
    assert.equal(result.iterations[0].stats.nonImprovingReductionBoosts, 3);
    assert.equal(result.iterations[0].stats.improvingLateMoveGuards, 1);
    assert.equal(result.iterations[0].stats.nonImprovingLateMovePrunes, 2);
    assert.equal(result.iterations[0].stats.countermoveHits, 6);
    assert.equal(result.iterations[0].stats.continuationHistoryHits, 8);
    assert.equal(result.iterations[0].stats.continuationReductionBoosts, 3);
    assert.equal(result.iterations[0].stats.continuationReductionMaluses, 1);
    assert.equal(result.iterations[0].stats.checkEvasionOrderHits, 18);
    assert.equal(result.iterations[0].stats.checkEvasionCaptures, 4);
    assert.equal(result.iterations[0].stats.checkEvasionBlocks, 9);
    assert.equal(result.iterations[0].stats.checkEvasionKingMoves, 5);
    assert.equal(result.iterations[0].stats.checkHistoryHits, 14);
    assert.equal(result.iterations[0].stats.checkHistoryStores, 9);
    assert.equal(result.iterations[0].stats.checkHistoryMaluses, 2);
    assert.equal(result.iterations[0].stats.iidMoveHits, 3);
    assert.equal(result.iterations[0].stats.rootMovesSearched, 12);
    assert.equal(result.iterations[0].stats.rootChildStateReuses, 24);
    assert.equal(result.iterations[0].stats.rootReductions, 5);
    assert.equal(result.iterations[0].stats.rootReductionResearches, 2);
    assert.equal(result.iterations[0].stats.rootReductionPlies, 7);
    assert.equal(result.iterations[0].stats.rootTtHits, 1);
    assert.equal(result.iterations[0].stats.rootTtStores, 3);
    assert.equal(result.iterations[0].stats.rootOrderHits, 7);
    assert.equal(result.iterations[0].stats.rootOrderStores, 8);
    assert.equal(result.iterations[0].stats.rootTimeGuardStops, 4);
    assert.equal(result.iterations[0].stats.openingPreferencePromotions, 6);
    assert.equal(result.iterations[0].stats.pvsResearches, 3);
    assert.equal(result.iterations[0].stats.aspirationSearches, 5);
    assert.equal(result.iterations[0].stats.aspirationWidenedSearches, 2);
    assert.equal(result.iterations[0].stats.singularExtensions, 2);
    assert.equal(result.explanation.search.telemetry.hashfullText, "32.1%");
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("Native search telemetry")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("8.2k nodes/s")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("ordering memory")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("quiescence nodes")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("forcing quiet checks")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("quiet-check history hit")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("quiet-check history update")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("quiet-check history malus")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("qsearch capture-history prune guard")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("qsearch capture-history hit")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("qsearch capture-history update")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("qsearch capture-history malus")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("quiescence-table hits")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("evaluation-cache hits")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("root child-state reuse")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("root transposition-table ordering hint")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("persisted root-order hint")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("root time-guard stop")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("opening/root preference promotion")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("checked-node eval skip")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("tactical extension")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("singular extension")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("draw-assumed repetition guard")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("verified null-move recheck")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("rejected null-move shortcut")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("low-material null-move guard")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("reverse-futility prune")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("razoring cutoff")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("static-exchange prune")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("ProbCut capture prune")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("ProbCut capture prefilter")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("bad-history prune")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("late-move prune")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("PV-node reduction guard")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("cut-node reduction boost")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("PVS re-search")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("aspiration-window search")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("widened aspiration-window re-search")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("mate-distance prune")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("delta prune")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("qsearch delta prefilter")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("quiescence SEE prune")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("improving-position reduction guard")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("worsening-position reduction boost")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("transposition hash-move ordering hint")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("capture-history hit")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("capture-history update")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("capture-history malus")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("capture-history prune guard")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("check-cache hit")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("countermove-order hit")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("continuation-history hit")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("check-evasion ordering hint")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("check-history hit")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("internal-iterative-deepening move hint")));
  } finally {
    await backend.close();
  }
});

test("native UCI backend replays move history when initial position is provided", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    profile: "native-uci",
    protocol: "uci",
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    engineOptions: {
      MockDepthFromGo: true
    }
  });

  try {
    const initialPosition = createInitialPosition();
    const firstMove = generateLegalMoves(initialPosition)
      .find((move) => move.notation === "b9-c7");
    assert.ok(firstMove);
    const afterFirst = makeMove(initialPosition, firstMove);
    const secondMove = generateLegalMoves(afterFirst)
      .find((move) => move.notation === "b0-c2");
    assert.ok(secondMove);
    const position = makeMove(afterFirst, secondMove);
    const result = await backend.chooseMove(position, {
      useBook: false,
      initialPosition,
      moveHistory: ["b9-c7", "b0-c2"]
    });
    const positionLine = result.raw.find((line) => line.startsWith("info string position "));

    assert.ok(positionLine, result.raw.join("\n"));
    assert.match(positionLine, /\bmoves b0c2 b9c7\b/);
  } finally {
    await backend.close();
  }
});

test("UCCI backend can reset native search memory for a new game", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    profile: "native-uci",
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    engineOptions: {
      MockMemoryAge: true
    }
  });

  try {
    const first = await backend.chooseMove(createInitialPosition(), { useBook: false });
    const second = await backend.chooseMove(createInitialPosition(), { useBook: false });
    await backend.newGame();
    const afterReset = await backend.chooseMove(createInitialPosition(), { useBook: false });

    assert.equal(first.stats.memoryAge, 1);
    assert.equal(second.stats.memoryAge, 2);
    assert.equal(afterReset.stats.memoryAge, 1);
    assert.ok(second.explanation.reasons.some((reason) => reason.includes("ordering memory")));
  } finally {
    await backend.close();
  }
});

test("UCCI backend close resolves when native process already exited", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    closeTimeoutMs: 25,
    engineOptions: {
      MockExitAfterBestmove: true
    }
  });

  const result = await backend.chooseMove(createInitialPosition(), { useBook: false });
  await new Promise((resolve) => setTimeout(resolve, 25));

  assert.equal(result.bestMove.notation, "h9-g7");
  await backend.close();
});

test("UCCI backend restarts native process after it exits between searches", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    closeTimeoutMs: 25,
    engineOptions: {
      MockExitAfterBestmove: true
    }
  });

  try {
    const first = await backend.chooseMove(createInitialPosition(), { useBook: false });
    await new Promise((resolve) => setTimeout(resolve, 25));
    const second = await backend.chooseMove(createInitialPosition(), { useBook: false });

    assert.equal(first.bestMove.notation, "h9-g7");
    assert.equal(second.bestMove.notation, "h9-g7");
    assert.ok(second.raw.some((line) => line.includes("MockExitAfterBestmove")));
  } finally {
    await backend.close();
  }
});

test("UCCI backend serializes concurrent searches on one native process", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000
  });
  const redPosition = createInitialPosition();
  const blackPosition = backend.play(redPosition, "h7-e7");

  try {
    const [redResult, blackResult] = await Promise.all([
      backend.chooseMove(redPosition, { useBook: false }),
      backend.chooseMove(blackPosition, { useBook: false })
    ]);

    assert.equal(redResult.bestMove.notation, "h9-g7");
    assert.equal(blackResult.bestMove.notation, "h0-g2");
    assert.equal(redResult.source, "native-ucci");
    assert.equal(blackResult.source, "native-ucci");
  } finally {
    await backend.close();
  }
});

test("UCCI backend aborts an active native search and drains bestmove", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 3000,
    engineOptions: {
      MockWaitForStopOnce: true
    }
  });
  const controller = new AbortController();

  try {
    const pending = backend.chooseMove(createInitialPosition(), {
      useBook: false,
      signal: controller.signal
    });
    await new Promise((resolve) => setTimeout(resolve, 250));
    controller.abort("stale-position");

    await assert.rejects(
      pending,
      (error) => error.name === "AbortError" && error.message.includes("stale-position")
    );

    const next = await backend.chooseMove(createInitialPosition(), { useBook: false });
    assert.equal(next.bestMove.notation, "h9-g7");
    assert.equal(next.source, "native-ucci");
  } finally {
    await backend.close();
  }
});

test("UCCI backend close terminates native process that ignores quit", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    closeTimeoutMs: 25,
    engineOptions: {
      MockIgnoreQuit: true
    }
  });

  const result = await backend.chooseMove(createInitialPosition(), { useBook: false });

  assert.equal(result.bestMove.notation, "h9-g7");
  await backend.close();
});

test("UCCI backend applies native engine options before search", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    engineOptions: {
      Threads: 2,
      Hash: 64,
      UCI_ShowWDL: true
    }
  });

  try {
    const result = await backend.chooseMove(createInitialPosition(), { useBook: false });
    const description = describeEngineBackend(backend);

    assert.deepEqual(description.nativeOptions, [
      { name: "Threads", value: 2 },
      { name: "Hash", value: 64 },
      { name: "UCI_ShowWDL", value: true }
    ]);
    assert.ok(result.raw.some((line) => line.includes("setoption name Threads value 2")));
    assert.ok(result.raw.some((line) => line.includes("setoption name Hash value 64")));
    assert.ok(result.raw.some((line) => line.includes("setoption name UCI_ShowWDL value true")));
  } finally {
    await backend.close();
  }
});

test("UCCI backend maps a direct eval file to the native EvalFile option", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    evalFile: "pikafish.nnue",
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    engineOptions: {
      Hash: 64
    }
  });

  try {
    const result = await backend.chooseMove(createInitialPosition(), { useBook: false });
    const description = describeEngineBackend(backend);

    assert.deepEqual(description.nativeOptions, [
      { name: "EvalFile", value: "pikafish.nnue" },
      { name: "Hash", value: 64 }
    ]);
    assert.ok(result.raw.some((line) => line.includes("setoption name EvalFile value pikafish.nnue")));
    assert.ok(result.raw.some((line) => line.includes("setoption name Hash value 64")));
  } finally {
    await backend.close();
  }
});

test("UCCI backend accepts array and button-style native options", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    engineOptions: [
      ["Hash", 128],
      { name: "EvalFile", value: "pikafish.nnue" },
      { name: "Clear Hash" }
    ]
  });

  try {
    const result = await backend.chooseMove(createInitialPosition(), { useBook: false });
    const description = describeEngineBackend(backend);

    assert.deepEqual(description.nativeOptions, [
      { name: "Hash", value: 128 },
      { name: "EvalFile", value: "pikafish.nnue" },
      { name: "Clear Hash", value: null }
    ]);
    assert.ok(result.raw.some((line) => line.includes("setoption name Hash value 128")));
    assert.ok(result.raw.some((line) => line.includes("setoption name EvalFile value pikafish.nnue")));
    assert.ok(result.raw.some((line) => line.includes("setoption name Clear Hash")));
  } finally {
    await backend.close();
  }
});

test("UCCI backend parses MultiPV analysis lines", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000
  });

  try {
    const result = await backend.analyzePosition(createInitialPosition(), { lines: 2 });

    assert.equal(result.lines.length, 2);
    assert.equal(result.lines[0].move.notation, "h9-g7");
    assert.equal(result.lines[0].score, 42);
    assert.equal(result.lines[1].move.notation, "h7-e7");
    assert.equal(result.lines[1].centipawnLoss, 30);
    assert.equal(result.candidates[1].native.multipv, 2);
  } finally {
    await backend.close();
  }
});

test("UCCI backend chooseMove can include native MultiPV alternatives", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000
  });

  try {
    const result = await backend.chooseMove(createInitialPosition(), {
      useBook: false,
      lines: 2
    });

    assert.equal(result.bestMove.notation, "h9-g7");
    assert.equal(result.candidates.length, 2);
    assert.equal(result.candidates[0].move.notation, "h9-g7");
    assert.equal(result.candidates[1].move.notation, "h7-e7");
    assert.equal(result.explanation.alternatives.length, 2);
    assert.equal(result.explanation.comparison.bestMove, "h9-g7");
    assert.equal(result.explanation.comparison.nextMove, "h7-e7");
    assert.equal(result.explanation.comparison.scoreGap, 30);
    assert.equal(result.explanation.comparison.verdict, "playable");
    assert.ok(result.explanation.comparison.reason.includes("30 centipawns"));
    assert.equal(result.explanation.comparison.planComparison.kind, "different-first-move");
    assert.equal(result.explanation.comparison.planComparison.playedMove, "h7-e7");
    assert.equal(result.explanation.comparison.planComparison.bestMove, "h9-g7");
    assert.equal(result.explanation.comparison.planComparison.centipawnLoss, 30);
    assert.equal(result.explanation.comparison.planComparison.classification, "playable");
    assert.equal(result.explanation.comparison.planComparison.summary, "The runner-up line starts with h7-e7; the preferred line starts with h9-g7, a playable gap of 30 centipawns. Both lines expect h0-g2.");
    assert.ok(result.explanation.comparison.planComparison.reasons.some((reason) => reason.includes("preferred line starts with h9-g7")));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("Native MultiPV rates h9-g7 30 centipawns above")));
    assert.equal(result.explanation.alternatives[0].verdict, "best");
    assert.equal(result.explanation.alternatives[0].centipawnLoss, 0);
    assert.equal(result.explanation.alternatives[0].expectedReply, "h0-g2");
    assert.equal(result.explanation.alternatives[0].linePlanSummary, result.explanation.linePlan.summary);
    assert.ok(Array.isArray(result.explanation.alternatives[0].motifs));
    assert.equal(result.explanation.alternatives[1].move, "h7-e7");
    assert.equal(result.explanation.alternatives[1].centipawnLoss, 30);
    assert.equal(result.explanation.alternatives[1].verdict, "playable");
    assert.equal(result.explanation.alternatives[1].planComparison.playedMove, "h7-e7");
    assert.equal(result.explanation.alternatives[1].planComparison.bestMove, "h9-g7");
    assert.equal(result.explanation.alternatives[1].planComparison.classification, "playable");
    assert.equal(result.explanation.alternatives[1].planComparison.summary, "This native line starts with h7-e7; the top native line starts with h9-g7, a playable gap of 30 centipawns. Both lines expect h0-g2.");
    assert.ok(result.explanation.alternatives[1].reasons[0].includes("top native line"));
    assert.ok(result.explanation.alternatives[1].principalVariationText.includes("h7-e7"));
    assert.ok(result.explanation.alternatives[1].note.includes("native UCCI line 2"));
    assert.ok(result.raw.some((line) => line.includes("multipv 2")));
  } finally {
    await backend.close();
  }
});

test("UCCI backend explains near-tied native alternatives", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    engineOptions: {
      MockTie: true
    }
  });

  try {
    const result = await backend.chooseMove(createInitialPosition(), {
      useBook: false,
      lines: 2
    });

    assert.equal(result.bestMove.notation, "h9-g7");
    assert.equal(result.explanation.comparison.bestMove, "h9-g7");
    assert.equal(result.explanation.comparison.nextMove, "h7-e7");
    assert.equal(result.explanation.comparison.scoreGap, 4);
    assert.equal(result.explanation.comparison.verdict, "near-tie");
    assert.ok(result.explanation.comparison.reason.includes("nearly tied"));
    assert.equal(result.explanation.comparison.planComparison.classification, "near-tie");
    assert.equal(result.explanation.comparison.planComparison.centipawnLoss, 4);
    assert.match(result.explanation.comparison.planComparison.summary, /near-tie gap of 4 centipawns/);
  } finally {
    await backend.close();
  }
});

test("UCCI backend explains opening preference promotions over raw MultiPV score", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    engineOptions: {
      MockOpeningPreference: true
    }
  });

  try {
    const result = await backend.chooseMove(createInitialPosition(), {
      useBook: false,
      lines: 2
    });

    assert.equal(result.bestMove.notation, "h7-e7");
    assert.equal(result.stats.openingPreferencePromotions, 1);
    assert.equal(result.explanation.comparison.bestMove, "h7-e7");
    assert.equal(result.explanation.comparison.nextMove, "h9-g7");
    assert.equal(result.explanation.comparison.scoreGap, 40);
    assert.equal(result.explanation.comparison.selectedScoreTrails, true);
    assert.equal(result.explanation.comparison.openingPreferencePromotions, 1);
    assert.match(result.explanation.comparison.reason, /preference promoted h7-e7/i);
    assert.match(result.explanation.comparison.reason, /h9-g7.*40 centipawns higher/);
    assert.equal(result.explanation.alternatives[1].move, "h9-g7");
    assert.equal(result.explanation.alternatives[1].scoresAboveSelected, true);
    assert.equal(result.explanation.alternatives[1].scoreGapFromSelected, 40);
    assert.equal(result.explanation.alternatives[1].centipawnLoss, 0);
    assert.ok(result.explanation.alternatives[1].reasons[0].includes("scores 40 centipawns above"));
  } finally {
    await backend.close();
  }
});

test("native backend can use a UCI handshake for top-engine compatibility", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    profile: "native-uci",
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000
  });

  try {
    const result = await backend.chooseMove(createInitialPosition(), { useBook: false });
    const description = describeEngineBackend(backend);

    assert.equal(backend.supports(ENGINE_BACKEND_FEATURES.UCI_COMPATIBLE), true);
    assert.equal(description.kind, "native-uci");
    assert.equal(result.source, "native-uci");
    assert.equal(result.bestMove.notation, "h9-g7");
    assert.ok(result.raw.some((line) => line.includes("position fen rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1")));
    assert.ok(result.raw.some((line) => line === "bestmove h0g2"));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("UCI search")));

    const analysis = await backend.analyzePosition(createInitialPosition(), {
      useBook: false,
      lines: 2
    });

    assert.equal(analysis.lines.length, 2);
    assert.equal(analysis.lines[0].move.notation, "h9-g7");
    assert.equal(analysis.lines[1].move.notation, "h7-e7");
  } finally {
    await backend.close();
  }
});

test("native backend uses bestmove ponder as an expected reply when PV is short", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    profile: "native-uci",
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    engineOptions: {
      MockShortPvPonder: true
    }
  });

  try {
    const result = await backend.chooseMove(createInitialPosition(), { useBook: false });

    assert.equal(result.bestMove.notation, "h9-g7");
    assert.equal(result.ponderMove.notation, "h0-g2");
    assert.deepEqual(result.principalVariation.map((move) => move.notation), ["h9-g7", "h0-g2"]);
    assert.deepEqual(result.candidates[0].principalVariation.map((move) => move.notation), ["h9-g7", "h0-g2"]);
    assert.equal(result.explanation.linePlan.expectedReply, "h0-g2");
    assert.equal(result.explanation.search.ponderMove, "h0-g2");
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("expects h0-g2 as the ponder reply")));
  } finally {
    await backend.close();
  }
});

test("native backend preserves mate and WDL score details", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    profile: "native-uci",
    depth: 3,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    engineOptions: {
      MockMateWdl: true
    }
  });

  try {
    const result = await backend.chooseMove(createInitialPosition(), {
      useBook: false,
      lines: 2
    });

    assert.equal(result.bestMove.notation, "h9-g7");
    assert.equal(result.scoreDetail.kind, "mate");
    assert.equal(result.scoreDetail.value, 2);
    assert.equal(result.scoreDetail.text, "mate in 2");
    assert.equal(result.wdl.win, 980);
    assert.equal(result.wdl.draw, 20);
    assert.equal(result.wdl.loss, 0);
    assert.equal(result.wdl.text, "98% win, 2% draw, 0% loss");
    assert.equal(result.candidates[0].scoreDetail.text, "mate in 2");
    assert.equal(result.candidates[0].wdl.text, "98% win, 2% draw, 0% loss");
    assert.ok(result.explanation.summary.includes("mate in 2"));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("Native WDL expectation: 98% win")));
    assert.equal(result.explanation.search.scoreDetail.text, "mate in 2");
    assert.equal(result.explanation.search.wdl.text, "98% win, 2% draw, 0% loss");
    assert.equal(result.explanation.alternatives[0].scoreDetail.text, "mate in 2");
    assert.equal(result.explanation.alternatives[0].wdl.text, "98% win, 2% draw, 0% loss");
  } finally {
    await backend.close();
  }
});

test("native backend preserves lower and upper bound score details", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    profile: "native-uci",
    depth: 3,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    engineOptions: {
      MockScoreBounds: true
    }
  });

  try {
    const result = await backend.chooseMove(createInitialPosition(), {
      useBook: false,
      lines: 2
    });

    assert.equal(result.bestMove.notation, "h9-g7");
    assert.equal(result.score, 80);
    assert.equal(result.scoreDetail.kind, "cp");
    assert.equal(result.scoreDetail.value, 80);
    assert.equal(result.scoreDetail.bound, "lower");
    assert.equal(result.scoreDetail.text, "at least +0.80");
    assert.equal(result.candidates[0].scoreDetail.bound, "lower");
    assert.equal(result.candidates[1].scoreDetail.bound, "upper");
    assert.equal(result.candidates[1].scoreDetail.text, "at most +0.20");
    assert.equal(result.explanation.search.scoreDetail.bound, "lower");
    assert.ok(result.explanation.summary.includes("at least +0.80"));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("native lower bound")));
    assert.equal(result.explanation.comparison.boundLimited, true);
    assert.deepEqual(result.explanation.comparison.scoreBounds, {
      best: "lower",
      next: "upper"
    });
    assert.ok(result.explanation.comparison.reason.includes("bound-limited scores"));
    assert.equal(result.explanation.alternatives[0].scoreDetail.text, "at least +0.80");
    assert.ok(result.explanation.alternatives[0].note.includes("score at least +0.80"));
    assert.equal(result.explanation.alternatives[1].scoreDetail.text, "at most +0.20");
    assert.ok(result.explanation.alternatives[1].reasons.some((reason) => reason.includes("native upper bound")));

    const analysis = await backend.analyzePosition(createInitialPosition(), {
      useBook: false,
      lines: 2
    });

    assert.equal(analysis.lines[0].scoreDetail.bound, "lower");
    assert.equal(analysis.lines[1].scoreDetail.bound, "upper");
    assert.equal(analysis.lines[1].scoreDetail.text, "at most +0.20");
  } finally {
    await backend.close();
  }
});

test("UCCI backend provides async native coach hints", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000
  });

  try {
    const hint = await backend.coachMove(createInitialPosition(), {
      useBook: false,
      lines: 2
    });

    assert.equal(hint.source, "native-ucci");
    assert.equal(hint.bestMove.notation, "h9-g7");
    assert.equal(hint.levels.length, 4);
    assert.equal(hint.levels.at(-1).kind, "reveal");
    assert.ok(hint.levels.at(-1).text.includes("h9-g7"));
    assert.equal(hint.alternatives.length, 2);
    assert.equal(hint.alternatives[1].notation, "h7-e7");
  } finally {
    await backend.close();
  }
});

test("UCCI backend forwards clock controls to native engines", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000
  });

  try {
    const result = await backend.chooseMove(createInitialPosition(), {
      useBook: false,
      wtime: 60000,
      btime: 20000,
      winc: 1000,
      binc: 500,
      movestogo: 20
    });

    assert.equal(result.source, "native-ucci");
    assert.equal(result.score, 55);
    assert.equal(result.nodes, 321);
    assert.ok(result.raw.some((line) => line.includes("command go depth 2 wtime 60000 btime 20000 winc 1000 binc 500 movestogo 20")));
  } finally {
    await backend.close();
  }
});

test("UCCI backend omits synthetic depth for timed-only native searches", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000
  });

  try {
    const result = await backend.chooseMove(createInitialPosition(), {
      useBook: false,
      wtime: 60000,
      btime: 20000
    });

    assert.equal(result.source, "native-ucci");
    const commandLine = result.raw.find((line) => line.includes("command go "));
    assert.ok(commandLine, result.raw.join("\n"));
    assert.ok(commandLine.includes("command go wtime 60000 btime 20000"), commandLine);
    assert.ok(!/\bdepth\b/.test(commandLine), commandLine);
  } finally {
    await backend.close();
  }
});

test("UCI native analysis profile uses timed search without a profile depth cap", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    profile: "native-uci",
    protocol: "uci",
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    engineOptions: {
      MockDepthFromGo: true
    }
  });

  try {
    const result = await backend.chooseMove(createInitialPosition(), {
      useBook: false
    });

    assert.equal(result.source, "native-uci");
    assert.equal(result.depth, 2);
  } finally {
    await backend.close();
  }
});

test("UCCI backend reviews moves with native search scores", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000
  });

  try {
    const review = await backend.reviewMove(createInitialPosition(), "h7-e7", {
      depth: 2,
      timeLimitMs: 500,
      lines: 2
    });

    assert.equal(review.source, "native-ucci");
    assert.equal(review.bestMove.notation, "h9-g7");
    assert.equal(review.bestScore, 42);
    assert.equal(review.playedScore, -17);
    assert.equal(review.playedScoreDetail.kind, "cp");
    assert.equal(review.playedScoreDetail.text, "-0.17");
    assert.equal(review.playedWdl, null);
    assert.equal(review.centipawnLoss, 59);
    assert.equal(review.classification, "good");
    assert.equal(review.mistakes.primary, "none");
    assert.deepEqual(review.principalVariation, ["h7-e7", "h0-g2"]);
    assert.equal(review.bestComparison.bestMove, "h9-g7");
    assert.equal(review.bestComparison.nextMove, "h7-e7");
    assert.equal(review.bestAlternatives.length, 2);
    assert.equal(review.bestAlternatives[1].verdict, "playable");
    assert.equal(review.playedLinePlan.firstMove, "h7-e7");
    assert.equal(review.playedLinePlan.expectedReply, "h0-g2");
    assert.equal(review.bestLinePlan.firstMove, "h9-g7");
    assert.equal(review.bestLinePlan.expectedReply, "h0-g2");
    assert.equal(review.planComparison.kind, "different-first-move");
    assert.equal(review.planComparison.centipawnLoss, 59);
    assert.equal(review.planComparison.summary, "Your plan starts with h7-e7; the engine prefers h9-g7, a good gap of 59 centipawns. Both lines expect h0-g2.");
    assert.ok(review.bestExplanation.summary.includes("Native UCCI Engine"));
    assert.ok(review.explanation.reasons.some((reason) => reason.includes("h9-g7")));
  } finally {
    await backend.close();
  }
});

test("UCCI backend reviews games with native move reviews", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000
  });

  try {
    const review = await backend.reviewGame(["h7-e7"], {
      reviewOptions: { depth: 2, timeLimitMs: 500, lines: 2 }
    });

    assert.equal(review.moves.length, 1);
    assert.equal(review.summary.totalMoves, 1);
    assert.equal(review.summary.bookMoves, 1);
    assert.equal(review.moves[0].review.source, "native-ucci");
    assert.equal(review.moves[0].review.bestMove.notation, "h9-g7");
    assert.equal(review.keyMoments[0].notation, "h7-e7");
    assert.equal(review.keyMoments[0].bestComparison.bestMove, "h9-g7");
    assert.equal(review.keyMoments[0].bestAlternatives.length, 2);
    assert.equal(review.keyMoments[0].playedLinePlan.firstMove, "h7-e7");
    assert.equal(review.keyMoments[0].planComparison.bestMove, "h9-g7");
    assert.equal(review.status.state, "playing");
  } finally {
    await backend.close();
  }
});

test("UCCI backend creates lesson plans from native reviews", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000
  });

  try {
    const plan = await backend.lessonPlan(["h7-e7"], {
      reviewOptions: { depth: 2, timeLimitMs: 500, lines: 2 },
      lessonOptions: { maxCards: 1 }
    });

    assert.equal(plan.cards.length, 1);
    assert.equal(plan.cards[0].type, "opening");
    assert.equal(plan.cards[0].bestMove, "h9-g7");
    assert.equal(plan.cards[0].bestComparison.nextMove, "h7-e7");
    assert.equal(plan.cards[0].bestAlternatives.length, 2);
    assert.equal(plan.cards[0].answer.move, "h7-e7");
    assert.equal(plan.cards[0].answer.bestComparison.bestMove, "h9-g7");
    assert.equal(plan.cards[0].answer.principalVariation[0], "h7-e7");
  } finally {
    await backend.close();
  }
});

test("UCCI backend creates full game studies from native reviews", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000
  });

  try {
    const study = await backend.gameStudy(["h7-e7"], {
      maxPositionStudies: 0,
      reviewOptions: { depth: 2, timeLimitMs: 500, lines: 2 },
      lessonOptions: { maxCards: 1 }
    });

    assert.equal(study.type, "game-study");
    assert.equal(study.summary.totalMoves, 1);
    assert.equal(study.review.moves[0].review.source, "native-ucci");
    assert.equal(study.lessonPlan.cards[0].bestMove, "h9-g7");
    assert.equal(study.keyMoments[0].bestComparison.bestMove, "h9-g7");
    assert.equal(study.lessonPlan.cards[0].bestAlternatives.length, 2);
    assert.equal(study.positionStudies.length, 0);
  } finally {
    await backend.close();
  }
});
