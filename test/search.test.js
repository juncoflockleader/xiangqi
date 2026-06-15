import test from "node:test";
import assert from "node:assert/strict";
import {
  MATE_SCORE,
  createEngine,
  createInitialPosition,
  generateLegalMoves,
  hashPosition,
  makeMove,
  parseFen,
  searchBestMove
} from "../src/index.js";

test("search reports tactical extensions in checking lines", () => {
  const position = parseFen("4k4/9/4r4/9/9/9/9/9/9/3KR4 r");
  const engine = createEngine({ depth: 2, timeLimitMs: 1000 });
  const result = engine.chooseMove(position);

  assert.equal(result.bestMove.notation, "e9-e2");
  assert.ok(result.stats.extensions > 0);
  assert.ok(result.stats.nodes >= result.nodes);
});

test("search orders quiet tactical motifs before generic quiet moves", () => {
  const position = parseFen("4r4/9/4k4/9/3R5/9/4P4/9/9/4K4 r");
  const result = searchBestMove(position, {
    depth: 1,
    timeLimitMs: 1000,
    useBook: false,
    candidateLimit: Number.POSITIVE_INFINITY
  });
  const disabled = searchBestMove(position, {
    depth: 1,
    timeLimitMs: 1000,
    useBook: false,
    useTacticalMoveOrdering: false,
    candidateLimit: Number.POSITIVE_INFINITY
  });

  assert.ok(result.stats.tacticalMoveOrderHits > 0);
  assert.ok(result.stats.tacticalMoveOrderCacheStores > 0);
  assert.equal(disabled.stats.tacticalMoveOrderHits, 0);
  assert.equal(disabled.stats.tacticalMoveOrderCacheStores, 0);
});

test("engine explanations surface tactical-motif ordering diagnostics", () => {
  const position = parseFen("4r4/9/4k4/9/3R5/9/4P4/9/9/4K4 r");
  const engine = createEngine({ depth: 1, timeLimitMs: 1000 });
  const result = engine.chooseMove(position, {
    useBook: false,
    depth: 1,
    timeLimitMs: 1000,
    candidateLimit: Number.POSITIVE_INFINITY
  });
  const selectivityFactor = result.explanation.confidence.factors
    .find((factor) => factor.kind === "selectivity");

  assert.ok(result.stats.tacticalMoveOrderHits > 0);
  assert.ok(selectivityFactor);
  assert.match(selectivityFactor.text, /tactical-motif ordering/);
});

test("search treats repeated child positions as draw candidates", () => {
  const position = parseFen("4k4/9/9/9/9/9/9/9/9/3KR4 r");
  const move = generateLegalMoves(position).find((candidate) => candidate.notation === "e9-e8");
  const repeatedChild = makeMove(position, move);
  const result = searchBestMove(position, {
    depth: 1,
    timeLimitMs: 1000,
    history: [repeatedChild, repeatedChild],
    candidateLimit: Number.POSITIVE_INFINITY
  });
  const repeatedCandidate = result.candidates.find((candidate) => candidate.move.notation === "e9-e8");

  assert.ok(result.stats.repetitions >= 1);
  assert.equal(repeatedCandidate.score, 0);
  assert.deepEqual(repeatedCandidate.repetition, {
    kind: "repeated-position",
    adjudication: "draw-assumed",
    historyCount: 2,
    pathCount: 0,
    projectedCount: 3
  });
});

test("engine explains draw-assumed repetition candidates", () => {
  const position = parseFen("4k4/9/9/9/9/9/9/9/9/3K5 r");
  const move = generateLegalMoves(position)[0];
  const repeatedChild = makeMove(position, move);
  const engine = createEngine({ depth: 1, timeLimitMs: 1000 });
  const result = engine.chooseMove(position, {
    useBook: false,
    depth: 1,
    timeLimitMs: 1000,
    history: [repeatedChild, repeatedChild]
  });
  const analysis = engine.analyzePosition(position, {
    lines: 2,
    depth: 1,
    timeLimitMs: 1000,
    history: [repeatedChild, repeatedChild]
  });

  assert.equal(result.bestMove.notation, move.notation);
  assert.ok(result.explanation.reasons.some((reason) => reason.includes("draw-assumed repetition")));
  assert.equal(result.explanation.alternatives[0].verdict, "best");
  assert.equal(result.explanation.alternatives[0].centipawnLoss, 0);
  assert.ok(result.explanation.alternatives[0].note.includes("repeats a known position for a draw-assumed score"));
  assert.ok(result.explanation.alternatives[0].reasons.some((reason) => reason.includes("draw-assumed repetition")));
  assert.equal(analysis.lines[0].repetition.kind, "repeated-position");
  assert.ok(analysis.lines[0].explanation.reasons.some((reason) => reason.includes("draw-assumed repetition")));
});

test("search keeps static root candidates when the deadline expires before depth one", () => {
  const result = searchBestMove(createInitialPosition(), {
    depth: 8,
    timeLimitMs: 1,
    minTimeMs: 1,
    candidateLimit: 4
  });

  assert.equal(result.depth, 0);
  assert.equal(result.timedOut, true);
  assert.equal(result.fallback, "static-root");
  assert.ok(result.bestMove);
  assert.ok(result.nodes > 0);
  assert.ok(result.stats.nodes > 0);
  assert.equal(result.candidates.length, 4);
  assert.ok(result.candidates.every((candidate) => candidate.fallback === "static-root"));
  assert.deepEqual(
    result.principalVariation.map((move) => move.notation),
    [result.bestMove.notation]
  );
});

test("engine explains static root fallback choices", () => {
  const engine = createEngine({ depth: 8, timeLimitMs: 1, minTimeMs: 1 });
  const result = engine.chooseMove(createInitialPosition(), {
    useBook: false,
    depth: 8,
    timeLimitMs: 1,
    minTimeMs: 1
  });

  assert.equal(result.fallback, "static-root");
  assert.ok(result.explanation.reasons.some((reason) => reason.includes("static one-ply fallback")));
});

test("search scores no-legal-move stalemate as a Xiangqi loss", () => {
  const position = parseFen("3rkr3/9/9/9/9/9/9/4p4/9/4K4 r");
  const result = searchBestMove(position, {
    depth: 1,
    timeLimitMs: 1000
  });

  assert.equal(generateLegalMoves(position).length, 0);
  assert.equal(result.bestMove, null);
  assert.equal(result.score, -MATE_SCORE);
});

test("search restores mate distance when probing the transposition table", () => {
  const position = parseFen("4k4/9/9/9/9/9/9/9/9/3K5 r");
  const move = generateLegalMoves(position)[0];
  const child = makeMove(position, move);
  const table = new Map([
    [hashPosition(child), { depth: 0, flag: "exact", score: MATE_SCORE }]
  ]);

  const result = searchBestMove(position, {
    depth: 1,
    timeLimitMs: 1000,
    candidateLimit: Number.POSITIVE_INFINITY,
    transpositionTable: table
  });
  const candidate = result.candidates.find((entry) => entry.move.notation === move.notation);

  assert.ok(candidate);
  assert.equal(candidate.score, -MATE_SCORE + 1);
  assert.ok(result.stats.ttHits >= 1);
});

test("search prunes mate-distance windows after finding a forced mate", () => {
  const position = parseFen("4k4/9/9/9/9/9/9/9/9/3KR4 r");
  const withPruning = searchBestMove(position, {
    depth: 2,
    timeLimitMs: 1000,
    useAspiration: false
  });
  const withoutPruning = searchBestMove(position, {
    depth: 2,
    timeLimitMs: 1000,
    useAspiration: false,
    useMateDistancePruning: false
  });

  assert.equal(withPruning.bestMove.notation, "e9-e0");
  assert.equal(withPruning.score, MATE_SCORE - 1);
  assert.equal(withPruning.score, withoutPruning.score);
  assert.ok(withPruning.stats.mateDistancePrunes > 0);
  assert.equal(withoutPruning.stats.mateDistancePrunes, 0);
  assert.ok(withPruning.nodes < withoutPruning.nodes);
});

test("search uses selective pruning and PVS in quiet tactical trees", () => {
  const position = parseFen("4k4/9/4r4/9/4p4/9/4P4/9/9/3KR4 r");
  const result = searchBestMove(position, {
    depth: 4,
    timeLimitMs: 1000,
    useAspiration: false
  });

  assert.equal(result.depth, 4);
  assert.ok(result.stats.pvsResearches > 0);
  assert.ok(result.stats.nullMovePrunes > 0);
});

test("search verifies deep null-move cutoffs when requested", () => {
  const position = parseFen("4k4/9/4h4/4c4/4P4/9/4C4/9/9/4K4 r");
  const result = searchBestMove(position, {
    depth: 4,
    timeLimitMs: 1000,
    useAspiration: false,
    useSoftTimeManagement: false,
    nullMoveVerificationMinDepth: 3
  });
  const disabled = searchBestMove(position, {
    depth: 4,
    timeLimitMs: 1000,
    useAspiration: false,
    useSoftTimeManagement: false,
    nullMoveVerificationMinDepth: 3,
    useNullMoveVerification: false
  });

  assert.equal(result.depth, 4);
  assert.equal(result.bestMove.notation, disabled.bestMove.notation);
  assert.ok(result.stats.nullMoveVerifications > 0);
  assert.ok(result.stats.nullMovePrunes > 0);
  assert.equal(disabled.stats.nullMoveVerifications, 0);
  assert.equal(disabled.stats.nullMoveVerificationFailures, 0);
});

test("search uses aspiration windows after the first completed depth", () => {
  const position = parseFen("2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r");
  const result = searchBestMove(position, {
    depth: 4,
    timeLimitMs: 1000
  });
  const withoutAspiration = searchBestMove(position, {
    depth: 4,
    timeLimitMs: 1000,
    useAspiration: false
  });

  assert.equal(result.depth, 4);
  assert.ok(result.stats.aspirationSearches > 0);
  assert.equal(withoutAspiration.stats.aspirationSearches, 0);
});

test("search records a per-depth iterative deepening trace", () => {
  const position = parseFen("4k4/9/4r4/9/9/9/9/9/9/3KR4 r");
  const result = searchBestMove(position, {
    depth: 2,
    timeLimitMs: 1000
  });

  assert.equal(result.iterations.length, 2);
  assert.deepEqual(result.iterations.map((iteration) => iteration.depth), [1, 2]);
  assert.equal(result.iterations[0].stableBestMove, null);
  assert.equal(result.iterations[1].bestMove.notation, result.bestMove.notation);
  assert.equal(result.iterations[1].stableBestMove, true);
  assert.ok(result.iterations.every((iteration) => iteration.principalVariation.length > 0));
});

test("search can soft-stop after a stable completed depth", () => {
  const position = parseFen("4k4/9/4r4/9/9/9/9/9/9/3KR4 r");
  const result = searchBestMove(position, {
    depth: 4,
    timeLimitMs: 1000,
    softTimeMs: 0,
    softMinDepth: 2,
    softScoreGap: 0,
    useAspiration: false
  });
  const disabled = searchBestMove(position, {
    depth: 4,
    timeLimitMs: 1000,
    softTimeMs: 0,
    softMinDepth: 2,
    softScoreGap: 0,
    useSoftTimeManagement: false,
    useAspiration: false
  });
  const exactRoot = searchBestMove(position, {
    depth: 4,
    timeLimitMs: 1000,
    softTimeMs: 0,
    softMinDepth: 2,
    softScoreGap: 0,
    candidateLimit: Number.POSITIVE_INFINITY,
    useAspiration: false
  });

  assert.equal(result.depth, 2);
  assert.equal(result.stopReason, "soft-time-candidate-gap");
  assert.equal(result.stats.softStops, 1);
  assert.equal(result.softTimeLimitMs, 0);
  assert.equal(disabled.depth, 4);
  assert.equal(disabled.stopReason, null);
  assert.equal(disabled.stats.softStops, 0);
  assert.equal(disabled.softTimeLimitMs, null);
  assert.equal(exactRoot.depth, 4);
  assert.equal(exactRoot.stats.softStops, 0);

  const engine = createEngine({ depth: 4, timeLimitMs: 1000 });
  const explained = engine.chooseMove(position, {
    useBook: false,
    softTimeMs: 0,
    softMinDepth: 2,
    softScoreGap: 0,
    useAspiration: false
  });

  assert.equal(explained.explanation.search.stopReason, "soft-time-candidate-gap");
  assert.ok(explained.explanation.confidence.factors.some((factor) => factor.text.includes("Soft time management")));
});

test("search reuses previous root scores for iterative move ordering", () => {
  const position = parseFen("2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r");
  const result = searchBestMove(position, {
    depth: 2,
    timeLimitMs: 1000,
    useAspiration: false
  });
  const disabled = searchBestMove(position, {
    depth: 2,
    timeLimitMs: 1000,
    useAspiration: false,
    useRootScoreOrdering: false
  });

  assert.equal(result.depth, 2);
  assert.equal(result.bestMove.notation, disabled.bestMove.notation);
  assert.ok(result.stats.rootScoreOrderHits > 0);
  assert.ok(result.stats.rootRankOrderHits > 0);
  assert.equal(disabled.stats.rootScoreOrderHits, 0);
  assert.equal(disabled.stats.rootRankOrderHits, 0);

  const engine = createEngine({ depth: 2, timeLimitMs: 1000 });
  const explained = engine.chooseMove(position, {
    useBook: false,
    depth: 2,
    timeLimitMs: 1000,
    useAspiration: false
  });
  assert.ok(explained.explanation.confidence.factors.some((factor) => factor.text.includes("previous-root-rank ordering")));
});

test("search uses internal iterative deepening when hash move ordering is unavailable", () => {
  const position = parseFen("2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r");
  const result = searchBestMove(position, {
    depth: 5,
    timeLimitMs: 5000,
    maxTranspositionEntries: 1,
    useSoftTimeManagement: false
  });
  const disabled = searchBestMove(position, {
    depth: 5,
    timeLimitMs: 5000,
    maxTranspositionEntries: 1,
    useSoftTimeManagement: false,
    useInternalIterativeDeepening: false
  });

  assert.equal(result.depth, 5);
  assert.ok(Math.abs(Math.round(result.score) - Math.round(disabled.score)) <= 2);
  assert.ok(result.stats.iidSearches > 0);
  assert.ok(result.stats.iidMoveHits > 0);
  assert.equal(disabled.stats.iidSearches, 0);
  assert.equal(disabled.stats.iidMoveHits, 0);
});

test("search adapts late-move reductions by depth and move order", () => {
  const position = parseFen("2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r");
  const adaptive = searchBestMove(position, {
    depth: 6,
    timeLimitMs: 5000,
    useAspiration: false,
    useSoftTimeManagement: false
  });
  const fixed = searchBestMove(position, {
    depth: 6,
    timeLimitMs: 5000,
    useAspiration: false,
    useSoftTimeManagement: false,
    useAdaptiveLmr: false
  });

  assert.equal(adaptive.depth, 6);
  assert.ok(fixed.candidates.some((candidate) => candidate.move.notation === adaptive.bestMove.notation));
  assert.ok(adaptive.stats.deepReductions > 0);
  assert.ok(adaptive.stats.reductionPlies > adaptive.stats.reductions);
  assert.equal(fixed.stats.deepReductions, 0);
  assert.equal(fixed.stats.reductionPlies, fixed.stats.reductions);
});

test("search prunes late quiet moves after ordered candidates", () => {
  const position = parseFen("3ak4/9/4r4/9/9/9/9/9/9/3KR4 r");
  const withPruning = searchBestMove(position, {
    depth: 4,
    timeLimitMs: 3000,
    useAspiration: false,
    useSoftTimeManagement: false
  });
  const withoutPruning = searchBestMove(position, {
    depth: 4,
    timeLimitMs: 3000,
    useAspiration: false,
    useSoftTimeManagement: false,
    useLateMovePruning: false
  });

  assert.equal(withPruning.depth, 4);
  assert.equal(withPruning.bestMove.notation, withoutPruning.bestMove.notation);
  assert.equal(Math.round(withPruning.score), Math.round(withoutPruning.score));
  assert.ok(withPruning.stats.lateMovePrunes > 0);
  assert.equal(withoutPruning.stats.lateMovePrunes, 0);
  assert.ok(withPruning.nodes < withoutPruning.nodes);
});

test("search extends hash moves when alternatives fail singular verification", () => {
  const position = parseFen("2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r");
  const rootMove = generateLegalMoves(position)[0];
  const child = makeMove(position, rootMove);
  const singularMove = generateLegalMoves(child)[0];
  const createSeededTable = () => new Map([
    [hashPosition(child), {
      depth: 3,
      flag: "lower",
      score: 5000,
      bestMove: singularMove
    }]
  ]);
  const result = searchBestMove(position, {
    depth: 5,
    timeLimitMs: 3000,
    transpositionTable: createSeededTable(),
    useAspiration: false,
    useSoftTimeManagement: false,
    singularExtensionMinDepth: 3,
    singularExtensionMargin: 1
  });
  const disabled = searchBestMove(position, {
    depth: 5,
    timeLimitMs: 3000,
    transpositionTable: createSeededTable(),
    useAspiration: false,
    useSoftTimeManagement: false,
    useSingularExtensions: false,
    singularExtensionMinDepth: 3,
    singularExtensionMargin: 1
  });

  assert.equal(result.depth, 5);
  assert.ok(result.stats.singularExtensionSearches > 0);
  assert.ok(result.stats.singularExtensions > 0);
  assert.ok(result.stats.extensions >= result.stats.singularExtensions);
  assert.equal(disabled.stats.singularExtensionSearches, 0);
  assert.equal(disabled.stats.singularExtensions, 0);
});

test("quiescence can include bounded quiet checking moves", () => {
  const position = parseFen("4k4/9/4r4/9/4p4/9/4P4/9/9/3KR4 r");
  const withChecks = searchBestMove(position, {
    depth: 2,
    timeLimitMs: 1000
  });
  const withoutChecks = searchBestMove(position, {
    depth: 2,
    timeLimitMs: 1000,
    useQuiescenceChecks: false
  });

  assert.ok(withChecks.stats.qchecks > 0);
  assert.equal(withoutChecks.stats.qchecks, 0);
  assert.ok(withChecks.stats.qnodes > withoutChecks.stats.qnodes);
});

test("search extends immediate recaptures", () => {
  const position = parseFen("4k4/9/4h4/4c4/4P4/9/4C4/9/9/4K4 r");
  const result = searchBestMove(position, {
    depth: 3,
    timeLimitMs: 1000,
    useAspiration: false
  });
  const disabled = searchBestMove(position, {
    depth: 3,
    timeLimitMs: 1000,
    useAspiration: false,
    useRecaptureExtensions: false
  });

  assert.equal(result.depth, 3);
  assert.equal(result.bestMove.notation, disabled.bestMove.notation);
  assert.ok(result.stats.recaptureExtensions > 0);
  assert.equal(disabled.stats.recaptureExtensions, 0);
  assert.ok(result.nodes > disabled.nodes);
});

test("quiescence can delta-prune hopeless captures", () => {
  const position = parseFen("2bakab2/9/4c4/4p4/9/4P4/9/9/9/2BAKAB2 r");
  const withPruning = searchBestMove(position, {
    depth: 3,
    timeLimitMs: 1000,
    useAspiration: false,
    useReverseFutilityPruning: false
  });
  const withoutPruning = searchBestMove(position, {
    depth: 3,
    timeLimitMs: 1000,
    useAspiration: false,
    useReverseFutilityPruning: false,
    useDeltaPruning: false
  });

  assert.equal(withPruning.depth, 3);
  assert.ok(Math.abs(Math.round(withPruning.score) - Math.round(withoutPruning.score)) <= 1);
  assert.ok(withPruning.stats.deltaPrunes > 0);
  assert.equal(withoutPruning.stats.deltaPrunes, 0);
  assert.ok(withPruning.stats.qnodes < withoutPruning.stats.qnodes);
});

test("quiescence reuses tactical leaf bounds from its transposition table", () => {
  const position = parseFen("2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r");
  const result = searchBestMove(position, {
    depth: 3,
    timeLimitMs: 1000,
    useAspiration: false,
    useSoftTimeManagement: false,
    exactRootScores: true
  });
  const disabled = searchBestMove(position, {
    depth: 3,
    timeLimitMs: 1000,
    useAspiration: false,
    useSoftTimeManagement: false,
    useQuiescenceTable: false,
    exactRootScores: true
  });

  assert.equal(result.depth, 3);
  assert.equal(result.bestMove.notation, disabled.bestMove.notation);
  assert.ok(Math.abs(Math.round(result.score) - Math.round(disabled.score)) <= 1);
  assert.ok(result.stats.qttStores > 0);
  assert.ok(result.stats.qttHits > 0);
  assert.equal(disabled.stats.qttStores, 0);
  assert.equal(disabled.stats.qttHits, 0);
  assert.ok(result.stats.qnodes < disabled.stats.qnodes);
});

test("search reuses cached static evaluations", () => {
  const position = parseFen("2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r");
  const result = searchBestMove(position, {
    depth: 3,
    timeLimitMs: 1000,
    useAspiration: false,
    useSoftTimeManagement: false,
    exactRootScores: true
  });
  const disabled = searchBestMove(position, {
    depth: 3,
    timeLimitMs: 1000,
    useAspiration: false,
    useSoftTimeManagement: false,
    useEvaluationCache: false,
    exactRootScores: true
  });

  assert.equal(result.depth, 3);
  assert.equal(result.bestMove.notation, disabled.bestMove.notation);
  assert.equal(Math.round(result.score), Math.round(disabled.score));
  assert.ok(result.stats.evalCacheStores > 0);
  assert.ok(result.stats.evalCacheHits > 0);
  assert.equal(disabled.stats.evalCacheStores, 0);
  assert.equal(disabled.stats.evalCacheHits, 0);
});

test("search orders legal check evasions before generic quiet moves", () => {
  const position = parseFen("4k4/9/9/9/9/9/9/4r4/9/3AK4 r");
  const result = searchBestMove(position, {
    depth: 2,
    timeLimitMs: 1000,
    useAspiration: false,
    useSoftTimeManagement: false,
    exactRootScores: true
  });
  const disabled = searchBestMove(position, {
    depth: 2,
    timeLimitMs: 1000,
    useAspiration: false,
    useSoftTimeManagement: false,
    useCheckEvasionOrdering: false,
    exactRootScores: true
  });

  assert.equal(result.depth, 2);
  assert.equal(result.bestMove.notation, disabled.bestMove.notation);
  assert.equal(Math.round(result.score), Math.round(disabled.score));
  assert.ok(result.stats.checkEvasionOrderHits > 0);
  assert.ok(result.stats.checkEvasionCaptures > 0);
  assert.ok(result.stats.checkEvasionBlocks > 0);
  assert.ok(result.stats.checkEvasionKingMoves > 0);
  assert.equal(disabled.stats.checkEvasionOrderHits, 0);
  assert.equal(disabled.stats.checkEvasionCaptures, 0);
  assert.equal(disabled.stats.checkEvasionBlocks, 0);
  assert.equal(disabled.stats.checkEvasionKingMoves, 0);
});

test("search prunes shallow quiet moves with futility margins", () => {
  const position = parseFen("2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r");
  const withPruning = searchBestMove(position, {
    depth: 3,
    timeLimitMs: 1000
  });
  const withoutPruning = searchBestMove(position, {
    depth: 3,
    timeLimitMs: 1000,
    useFutilityPruning: false
  });

  assert.equal(withPruning.depth, 3);
  assert.equal(withPruning.bestMove.notation, withoutPruning.bestMove.notation);
  assert.ok(withPruning.stats.futilityPrunes > 0);
  assert.equal(withoutPruning.stats.futilityPrunes, 0);
  assert.ok(withPruning.nodes < withoutPruning.nodes);
});

test("search prunes shallow fail-high nodes with reverse futility margins", () => {
  const position = parseFen("2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r");
  const withPruning = searchBestMove(position, {
    depth: 3,
    timeLimitMs: 1000,
    useAspiration: false
  });
  const withoutPruning = searchBestMove(position, {
    depth: 3,
    timeLimitMs: 1000,
    useAspiration: false,
    useReverseFutilityPruning: false
  });

  assert.equal(withPruning.depth, 3);
  assert.equal(withPruning.bestMove.notation, withoutPruning.bestMove.notation);
  assert.equal(Math.round(withPruning.score), Math.round(withoutPruning.score));
  assert.ok(withPruning.stats.reverseFutilityPrunes > 0);
  assert.equal(withoutPruning.stats.reverseFutilityPrunes, 0);
  assert.ok(withPruning.nodes < withoutPruning.nodes);
});

test("search prunes clearly losing shallow captures with static exchange", () => {
  const position = parseFen("4k4/9/4r4/9/4p4/9/4P4/9/9/3KR4 r");
  const withPruning = searchBestMove(position, {
    depth: 4,
    timeLimitMs: 3000,
    useAspiration: false,
    useSoftTimeManagement: false
  });
  const withoutPruning = searchBestMove(position, {
    depth: 4,
    timeLimitMs: 3000,
    useAspiration: false,
    useSoftTimeManagement: false,
    useSeePruning: false
  });

  assert.equal(withPruning.depth, 4);
  assert.equal(withPruning.bestMove.notation, withoutPruning.bestMove.notation);
  assert.equal(Math.round(withPruning.score), Math.round(withoutPruning.score));
  assert.ok(withPruning.stats.seePrunes > 0);
  assert.equal(withoutPruning.stats.seePrunes, 0);
  assert.ok(withPruning.nodes < withoutPruning.nodes);
});

test("search razors shallow quiet branches after quiescence verification", () => {
  const position = parseFen("2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r");
  const withRazoring = searchBestMove(position, {
    depth: 3,
    timeLimitMs: 1000,
    useAspiration: false
  });
  const withoutRazoring = searchBestMove(position, {
    depth: 3,
    timeLimitMs: 1000,
    useAspiration: false,
    useRazoring: false
  });

  assert.equal(withRazoring.depth, 3);
  assert.equal(withRazoring.bestMove.notation, withoutRazoring.bestMove.notation);
  assert.equal(withRazoring.score, withoutRazoring.score);
  assert.ok(withRazoring.stats.razorPrunes > 0);
  assert.equal(withoutRazoring.stats.razorPrunes, 0);
  assert.ok(withRazoring.nodes < withoutRazoring.nodes);
});

test("search can probcut promising captures at deeper non-PV nodes", () => {
  const position = parseFen("2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r");
  const withProbCut = searchBestMove(position, {
    depth: 6,
    timeLimitMs: 5000,
    useAspiration: false,
    useSoftTimeManagement: false,
    useLateMovePruning: false,
    probCutMargin: 0
  });
  const withoutProbCut = searchBestMove(position, {
    depth: 6,
    timeLimitMs: 5000,
    useAspiration: false,
    useSoftTimeManagement: false,
    useLateMovePruning: false,
    useProbCut: false
  });

  assert.equal(withProbCut.depth, 6);
  assert.ok(withoutProbCut.candidates.some((candidate) => candidate.move.notation === withProbCut.bestMove.notation));
  assert.ok(Math.abs(Math.round(withProbCut.score) - Math.round(withoutProbCut.score)) <= 8);
  assert.ok(withProbCut.stats.probCutSearches > 0);
  assert.ok(withProbCut.stats.probCutPrunes > 0);
  assert.equal(withoutProbCut.stats.probCutPrunes, 0);
  assert.ok(withProbCut.nodes < withoutProbCut.nodes);
});

test("search can order replies with the countermove heuristic", () => {
  const position = parseFen("4k4/9/4r4/9/4p4/9/4P4/9/9/3KR4 r");
  const result = searchBestMove(position, {
    depth: 3,
    timeLimitMs: 1000,
    useAspiration: false
  });
  const disabled = searchBestMove(position, {
    depth: 3,
    timeLimitMs: 1000,
    useAspiration: false,
    useCountermoves: false
  });

  assert.equal(result.depth, 3);
  assert.equal(result.bestMove.notation, disabled.bestMove.notation);
  assert.ok(result.stats.countermoveStores > 0);
  assert.ok(result.stats.countermoveHits > 0);
  assert.equal(disabled.stats.countermoveStores, 0);
  assert.equal(disabled.stats.countermoveHits, 0);
});

test("search orders quiet beta cutoffs with killer moves", () => {
  const position = parseFen("2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r");
  const result = searchBestMove(position, {
    depth: 3,
    timeLimitMs: 1000,
    useAspiration: false,
    useSoftTimeManagement: false,
    exactRootScores: true
  });
  const disabled = searchBestMove(position, {
    depth: 3,
    timeLimitMs: 1000,
    useAspiration: false,
    useSoftTimeManagement: false,
    useKillerMoves: false,
    exactRootScores: true
  });

  assert.equal(result.depth, 3);
  assert.equal(result.bestMove.notation, disabled.bestMove.notation);
  assert.equal(Math.round(result.score), Math.round(disabled.score));
  assert.ok(result.stats.killerStores > 0);
  assert.ok(result.stats.killerHits > 0);
  assert.equal(disabled.stats.killerStores, 0);
  assert.equal(disabled.stats.killerHits, 0);
});

test("search learns quiet checking moves with check history", () => {
  const position = parseFen("4k4/9/4r4/9/4p4/9/4P4/9/9/3KR4 r");
  const result = searchBestMove(position, {
    depth: 3,
    timeLimitMs: 1000,
    useAspiration: false,
    useSoftTimeManagement: false,
    exactRootScores: true
  });
  const disabled = searchBestMove(position, {
    depth: 3,
    timeLimitMs: 1000,
    useAspiration: false,
    useSoftTimeManagement: false,
    useCheckHistory: false,
    exactRootScores: true
  });

  assert.equal(result.depth, 3);
  assert.equal(result.bestMove.notation, disabled.bestMove.notation);
  assert.equal(Math.round(result.score), Math.round(disabled.score));
  assert.ok(result.stats.checkHistoryStores > 0);
  assert.ok(result.stats.checkHistoryHits > 0);
  assert.ok(result.stats.checkHistoryMaluses > 0);
  assert.equal(disabled.stats.checkHistoryStores, 0);
  assert.equal(disabled.stats.checkHistoryHits, 0);
  assert.equal(disabled.stats.checkHistoryMaluses, 0);
});

test("search learns capture history for capture ordering", () => {
  const position = parseFen("2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r");
  const result = searchBestMove(position, {
    depth: 3,
    timeLimitMs: 1000,
    useAspiration: false
  });
  const disabled = searchBestMove(position, {
    depth: 3,
    timeLimitMs: 1000,
    useAspiration: false,
    useCaptureHistory: false
  });

  assert.equal(result.depth, 3);
  assert.equal(result.bestMove.notation, disabled.bestMove.notation);
  assert.ok(result.stats.captureHistoryStores > 0);
  assert.ok(result.stats.captureHistoryHits > 0);
  assert.equal(disabled.stats.captureHistoryStores, 0);
  assert.equal(disabled.stats.captureHistoryHits, 0);
});

test("search reuses static exchange analysis through the tactical cache", () => {
  const position = parseFen("2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r");
  const result = searchBestMove(position, {
    depth: 3,
    timeLimitMs: 1000,
    useAspiration: false,
    useSoftTimeManagement: false,
    exactRootScores: true
  });
  const disabled = searchBestMove(position, {
    depth: 3,
    timeLimitMs: 1000,
    useAspiration: false,
    useSoftTimeManagement: false,
    useTacticalCache: false,
    exactRootScores: true
  });

  assert.equal(result.depth, 3);
  assert.equal(result.bestMove.notation, disabled.bestMove.notation);
  assert.equal(Math.round(result.score), Math.round(disabled.score));
  assert.ok(result.stats.tacticalCacheStores > 0);
  assert.ok(result.stats.tacticalCacheHits > 0);
  assert.equal(disabled.stats.tacticalCacheStores, 0);
  assert.equal(disabled.stats.tacticalCacheHits, 0);
});

test("search orders quiet replies with continuation history", () => {
  const position = parseFen("2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r");
  const result = searchBestMove(position, {
    depth: 3,
    timeLimitMs: 1000,
    useAspiration: false
  });
  const disabled = searchBestMove(position, {
    depth: 3,
    timeLimitMs: 1000,
    useAspiration: false,
    useContinuationHistory: false
  });

  assert.equal(result.depth, 3);
  assert.equal(result.bestMove.notation, disabled.bestMove.notation);
  assert.ok(result.stats.continuationHistoryStores > 0);
  assert.ok(result.stats.continuationHistoryHits > 0);
  assert.equal(disabled.stats.continuationHistoryStores, 0);
  assert.equal(disabled.stats.continuationHistoryHits, 0);
});

test("search tunes late-move reductions with continuation history", () => {
  const position = parseFen("4k4/9/9/9/9/9/4P4/9/9/3KR4 r");
  const result = searchBestMove(position, {
    depth: 7,
    timeLimitMs: 5000,
    useAspiration: false,
    useSoftTimeManagement: false,
    useRootScoreOrdering: false,
    exactRootScores: true
  });
  const disabled = searchBestMove(position, {
    depth: 7,
    timeLimitMs: 5000,
    useAspiration: false,
    useSoftTimeManagement: false,
    useContinuationHistory: false,
    exactRootScores: true
  });

  assert.equal(result.depth, 7);
  assert.equal(result.bestMove.notation, disabled.bestMove.notation);
  assert.equal(Math.round(result.score), Math.round(disabled.score));
  assert.ok(result.stats.continuationReductionBoosts + result.stats.continuationReductionMaluses > 0);
  assert.equal(disabled.stats.continuationReductionBoosts, 0);
  assert.equal(disabled.stats.continuationReductionMaluses, 0);
});

test("search penalizes failed quiet moves in history ordering", () => {
  const position = parseFen("4k4/9/4h4/4c4/4P4/9/4C4/9/9/4K4 r");
  const result = searchBestMove(position, {
    depth: 3,
    timeLimitMs: 1000,
    useAspiration: false
  });
  const disabled = searchBestMove(position, {
    depth: 3,
    timeLimitMs: 1000,
    useAspiration: false,
    useHistoryMalus: false
  });

  assert.equal(result.depth, 3);
  assert.equal(result.bestMove.notation, disabled.bestMove.notation);
  assert.ok(result.stats.historyMaluses > 0);
  assert.ok(result.stats.historyGravityUpdates > 0);
  assert.equal(disabled.stats.historyMaluses, 0);
});
