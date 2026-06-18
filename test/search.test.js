import test from "node:test";
import assert from "node:assert/strict";
import {
  MATE_SCORE,
  createEngine,
  createInitialPosition,
  generateCaptures,
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

test("search move ordering does not leak private score metadata", () => {
  const result = searchBestMove(createInitialPosition(), {
    depth: 2,
    timeLimitMs: 1000,
    candidateLimit: 4
  });
  const moves = [
    result.bestMove,
    ...result.candidates.map((candidate) => candidate.move)
  ].filter(Boolean);

  assert.ok(moves.length > 0);
  assert.ok(moves.every((move) => Object.getOwnPropertySymbols(move).length === 0));
});

test("search keeps opening development aligned without book help", () => {
  const result = searchBestMove(createInitialPosition(), {
    depth: 5,
    timeLimitMs: 10000,
    useBook: false,
    useSoftTimeManagement: false
  });

  assert.ok(["b7-e7", "h7-e7", "b9-c7", "h9-g7"].includes(result.bestMove.notation));
});

test("search does not overvalue deep central-cannon checks in the opening", () => {
  const position = parseFen("rheakaehr/7c1/9/p3p1p1p/2p6/9/P1P1P1P1P/1c7/4A1C1C/RHE1KAEHR b");
  const result = searchBestMove(position, {
    depth: 5,
    timeLimitMs: 3000,
    useBook: false
  });

  assert.equal(result.depth, 5);
  assert.equal(result.timedOut, false);
  assert.equal(result.bestMove.notation, "b7-b2");
  assert.notEqual(result.bestMove.notation, "b7-e7");
});

test("search mirrors rook development in the central-cannon red-rook branch", () => {
  const position = parseFen("rheakae1r/9/1c4hc1/p1p1p3p/6p2/9/P1P1P1P1P/1C2C1H2/9/RHEAKAER1 b");
  const result = searchBestMove(position, {
    depth: 5,
    timeLimitMs: 3000,
    useBook: false
  });

  assert.equal(result.depth, 5);
  assert.equal(result.timedOut, false);
  assert.equal(result.bestMove.notation, "i0-h0");
});

test("search follows the rim-horse response to early-pawn elephant development", () => {
  const position = parseFen("rheakaehr/9/1c4c2/p1p1p1p1p/9/6P2/P1P1P3P/1C2E2C1/9/RH1AKAEHR b");
  const result = searchBestMove(position, {
    depth: 5,
    timeLimitMs: 3000,
    useBook: false
  });

  assert.equal(result.depth, 5);
  assert.equal(result.timedOut, false);
  assert.equal(result.bestMove.notation, "h0-i2");
});

test("search connects the rook in shifted-cannon double-horse openings", () => {
  const position = parseFen("r1eakae1r/9/1ch3hc1/p1p1p1p1p/9/9/P1P1P1P1P/2HCC4/9/R1EAKAEHR b");
  const result = searchBestMove(position, {
    depth: 6,
    timeLimitMs: 8000,
    useBook: false
  });

  assert.equal(result.depth, 6);
  assert.equal(result.timedOut, false);
  assert.equal(result.bestMove.notation, "a0-b0");
});

test("search rejects premature central-pawn pushes under early-pawn cannon pressure", () => {
  const positions = [
    parseFen("rheakae1r/9/1c4hc1/p1p1p1p1p/9/6P2/P1P1P3P/1C2C4/9/RHEAKAEHR b"),
    parseFen("r1eakaehr/9/1ch4c1/p1p1p1p1p/9/6P2/P1P1P3P/1C2C4/9/RHEAKAEHR b")
  ];

  for (const position of positions) {
    const result = searchBestMove(position, {
      depth: 6,
      timeLimitMs: 8000,
      useBook: false,
      candidateLimit: 99
    });
    const centralPawn = result.candidates.find((candidate) => candidate.move.notation === "e3-e4");

    assert.equal(result.depth, 6);
    assert.equal(result.timedOut, false);
    assert.notEqual(result.bestMove.notation, "e3-e4");
    assert.ok(centralPawn);
    assert.ok(centralPawn.score < result.score);
  }
});

test("search develops before loose cannon and pawn shifts under shifted-cannon pressure", () => {
  const position = parseFen("rheakaehr/9/1c4c2/p1p1p1p1p/9/6P2/P1P1P3P/4C2C1/9/RHEAKAEHR b");
  const result = searchBestMove(position, {
    depth: 6,
    timeLimitMs: 8000,
    useBook: false,
    candidateLimit: 99
  });

  assert.equal(result.depth, 6);
  assert.equal(result.timedOut, false);
  assert.ok(["c0-e2", "g0-e2", "b0-c2", "b2-e2", "c3-c4"].includes(result.bestMove.notation));

  for (const notation of ["b2-c2", "b2-d2", "g3-g4"]) {
    const candidate = result.candidates.find((item) => item.move.notation === notation);
    assert.ok(candidate);
    assert.ok(candidate.score < result.score);
  }
});

test("search avoids central-pawn and half-cannon drifts against developed central cannon pressure", () => {
  const position = parseFen("rheakae1r/9/1c4hc1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1H2/9/RHEAKAE1R b");
  const result = searchBestMove(position, {
    depth: 6,
    timeLimitMs: 8000,
    useBook: false,
    candidateLimit: 99
  });

  assert.equal(result.depth, 6);
  assert.equal(result.timedOut, false);
  assert.notEqual(result.bestMove.notation, "e3-e4");

  for (const notation of ["e3-e4", "b2-c2", "b2-d2"]) {
    const candidate = result.candidates.find((item) => item.move.notation === notation);
    assert.ok(candidate);
    assert.ok(candidate.score < result.score);
  }
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
    depth: 3,
    timeLimitMs: 1000,
    useAspiration: false
  });
  const withoutPruning = searchBestMove(position, {
    depth: 3,
    timeLimitMs: 1000,
    useAspiration: false,
    useMateDistancePruning: false
  });

  assert.equal(withPruning.bestMove.notation, "e9-e8");
  assert.equal(withPruning.score, MATE_SCORE - 3);
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

test("search widens failed aspiration windows before full-width search", () => {
  const position = parseFen("4k4/9/4h4/4c4/4P4/9/4C4/9/9/4K4 r");
  const commonOptions = {
    depth: 4,
    timeLimitMs: 5000,
    aspirationWindow: 30,
    useSoftTimeManagement: false
  };
  const result = searchBestMove(position, commonOptions);
  const withoutAspiration = searchBestMove(position, {
    ...commonOptions,
    useAspiration: false
  });
  const disabled = searchBestMove(position, {
    ...commonOptions,
    useAspirationWidening: false
  });

  assert.equal(result.depth, 4);
  assert.equal(result.bestMove.notation, withoutAspiration.bestMove.notation);
  assert.equal(Math.round(result.score), Math.round(withoutAspiration.score));
  assert.ok(result.stats.aspirationWidenedSearches > 0);
  assert.ok(result.stats.aspirationFailHigh > 0);
  assert.equal(disabled.stats.aspirationWidenedSearches, 0);
  assert.ok(result.nodes < withoutAspiration.nodes);

  const engine = createEngine({ depth: 4, timeLimitMs: 5000 });
  const explained = engine.chooseMove(position, {
    ...commonOptions,
    useBook: false
  });
  assert.ok(explained.explanation.confidence.factors.some((factor) => factor.text.includes("widened aspiration-window searches")));
});

test("search reuses cached checking-move results", () => {
  const position = parseFen("2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r");
  const commonOptions = {
    depth: 4,
    timeLimitMs: 5000,
    useAspiration: false,
    useSoftTimeManagement: false
  };
  const result = searchBestMove(position, commonOptions);
  const disabled = searchBestMove(position, {
    ...commonOptions,
    useCheckCache: false
  });

  assert.equal(result.bestMove.notation, disabled.bestMove.notation);
  assert.equal(Math.round(result.score), Math.round(disabled.score));
  assert.ok(result.stats.checkCacheStores > 0);
  assert.ok(result.stats.checkCacheHits > 0);
  assert.equal(disabled.stats.checkCacheStores, 0);
  assert.equal(disabled.stats.checkCacheHits, 0);

  const engine = createEngine({ depth: 4, timeLimitMs: 5000 });
  const explained = engine.chooseMove(position, {
    ...commonOptions,
    useBook: false
  });
  assert.ok(explained.explanation.confidence.factors.some((factor) => factor.text.includes("check-cache reuse")));
});

test("search reuses root child positions across iterative root searches", () => {
  const position = parseFen("2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r");
  const commonOptions = {
    depth: 4,
    timeLimitMs: 5000,
    useAspiration: false,
    useSoftTimeManagement: false
  };
  const result = searchBestMove(position, commonOptions);
  const disabled = searchBestMove(position, {
    ...commonOptions,
    useRootChildStateCache: false
  });

  assert.equal(result.bestMove.notation, disabled.bestMove.notation);
  assert.equal(Math.round(result.score), Math.round(disabled.score));
  assert.ok(result.stats.rootChildStateReuses > 0);
  assert.equal(disabled.stats.rootChildStateReuses, 0);

  const engine = createEngine({ depth: 4, timeLimitMs: 5000 });
  const explained = engine.chooseMove(position, {
    ...commonOptions,
    useBook: false
  });
  assert.ok(explained.explanation.confidence.factors.some((factor) => factor.text.includes("root child-state reuse")));
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

test("search can stop before a likely over-budget root depth", () => {
  const position = parseFen("4k4/9/4r4/9/9/9/9/9/9/3KR4 r");
  const commonOptions = {
    depth: 5,
    timeLimitMs: 1000,
    useAspiration: false,
    useSoftTimeManagement: false,
    rootTimeGuardMinMs: 2000,
    rootTimeGuardMaxMs: 2000
  };
  const result = searchBestMove(position, commonOptions);
  const disabled = searchBestMove(position, {
    ...commonOptions,
    useRootTimeGuard: false
  });

  assert.equal(result.depth, 1);
  assert.equal(result.stopReason, "root-time-guard");
  assert.equal(result.timedOut, false);
  assert.equal(result.stats.rootTimeGuardStops, 1);
  assert.ok(result.bestMove);
  assert.equal(disabled.depth, 5);
  assert.equal(disabled.stopReason, null);
  assert.equal(disabled.stats.rootTimeGuardStops, 0);

  const engine = createEngine({ depth: 5, timeLimitMs: 1000 });
  const explained = engine.chooseMove(position, {
    ...commonOptions,
    useBook: false
  });

  assert.equal(explained.explanation.search.stopReason, "root-time-guard");
  assert.ok(explained.explanation.confidence.factors.some((factor) => factor.text.includes("Root time guard")));
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

test("search uses root principal variation scouts for ordered root moves", () => {
  const position = parseFen("2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r");
  const commonOptions = {
    depth: 4,
    timeLimitMs: 5000,
    useAspiration: false,
    useSoftTimeManagement: false
  };
  const result = searchBestMove(position, commonOptions);
  const disabled = searchBestMove(position, {
    ...commonOptions,
    useRootPvs: false
  });
  const exactRoot = searchBestMove(position, {
    ...commonOptions,
    exactRootScores: true
  });

  assert.equal(result.depth, 4);
  assert.equal(result.bestMove.notation, disabled.bestMove.notation);
  assert.equal(Math.round(result.score), Math.round(disabled.score));
  assert.ok(result.stats.rootPvsSearches > 0);
  assert.equal(disabled.stats.rootPvsSearches, 0);
  assert.equal(exactRoot.stats.rootPvsSearches, 0);
  assert.ok(result.nodes < disabled.nodes);

  const engine = createEngine({ depth: 4, timeLimitMs: 5000 });
  const explained = engine.chooseMove(position, {
    ...commonOptions,
    useBook: false
  });
  assert.ok(explained.explanation.confidence.factors.some((factor) => factor.text.includes("root PVS scout searches")));
});

test("search reduces late root moves with full-depth repair", () => {
  const position = parseFen("4k4/9/9/9/9/4P4/9/9/2C6/4K4 r");
  const commonOptions = {
    depth: 6,
    timeLimitMs: 10000,
    useAspiration: false,
    useSoftTimeManagement: false
  };
  const result = searchBestMove(position, commonOptions);
  const disabled = searchBestMove(position, {
    ...commonOptions,
    useRootReductions: false
  });
  const exactRoot = searchBestMove(position, {
    ...commonOptions,
    exactRootScores: true
  });

  assert.equal(result.depth, 6);
  assert.equal(result.bestMove.notation, disabled.bestMove.notation);
  assert.equal(Math.round(result.score), Math.round(disabled.score));
  assert.ok(result.stats.rootReductions > 0);
  assert.ok(result.stats.rootReductionPlies >= result.stats.rootReductions);
  assert.equal(disabled.stats.rootReductions, 0);
  assert.equal(disabled.stats.rootReductionPlies, 0);
  assert.equal(exactRoot.stats.rootReductions, 0);
  assert.equal(exactRoot.stats.rootReductionPlies, 0);
  assert.ok(result.nodes < disabled.nodes);

  const engine = createEngine({ depth: 6, timeLimitMs: 10000 });
  const explained = engine.chooseMove(position, {
    ...commonOptions,
    useBook: false
  });
  assert.ok(explained.explanation.confidence.factors.some((factor) => factor.text.includes("root late-move reductions")));
});

test("search uses internal iterative deepening when hash move ordering is unavailable", () => {
  const position = parseFen("2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r");
  const result = searchBestMove(position, {
    depth: 5,
    timeLimitMs: 5000,
    maxTranspositionEntries: 1,
    useSoftTimeManagement: false,
    useRootTacticalVerification: false
  });
  const disabled = searchBestMove(position, {
    depth: 5,
    timeLimitMs: 5000,
    maxTranspositionEntries: 1,
    useSoftTimeManagement: false,
    useRootTacticalVerification: false,
    useInternalIterativeDeepening: false
  });

  assert.equal(result.depth, 5);
  assert.ok(Math.abs(Math.round(result.score) - Math.round(disabled.score)) <= 2);
  assert.ok(result.stats.iidSearches > 0);
  assert.ok(result.stats.iidMoveHits > 0);
  assert.equal(disabled.stats.iidSearches, 0);
  assert.equal(disabled.stats.iidMoveHits, 0);
});

test("search verifies near-tied root tactics before missing a major capture", () => {
  const position = parseFen("rc1akaeh1/7r1/2h1e4/p1p1p1p1p/9/8P/P1P1P1PcR/E5CC1/4K4/RH1A1AEH1 r");
  const result = searchBestMove(position, {
    depth: 5,
    timeLimitMs: 5000,
    useBook: false
  });

  assert.equal(result.bestMove.notation, "h7-h1");
  assert.ok(result.stats.rootTacticalVerifications > 0);
  assert.ok(result.stats.rootTacticalVerificationMoves > 0);
  assert.equal(result.candidates[0].move.notation, "h7-h1");
});

test("search demotes losing root captures when scores are tied", () => {
  const position = parseFen("rheakaer1/9/1c4hc1/p1p1p3p/6p2/9/P1P1P1P1P/1C2C1H2/9/RHEAKAER1 r");
  const result = searchBestMove(position, {
    depth: 5,
    timeLimitMs: 3000,
    useBook: false
  });

  assert.notEqual(result.bestMove.notation, "h9-h2");
  assert.equal(result.candidates.some((candidate) => candidate.move.notation === "h9-h2"), false);
});

test("search orders transposition-table hash moves before generic replies", () => {
  const position = parseFen("2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r");
  const createSeededTable = () => {
    const table = new Map();
    for (const rootMove of generateLegalMoves(position)) {
      const child = makeMove(position, rootMove);
      const reply = generateLegalMoves(child)[0];
      if (reply) {
        table.set(hashPosition(child), {
          depth: 0,
          flag: "lower",
          score: 0,
          bestMove: reply
        });
      }
    }
    return table;
  };
  const commonOptions = {
    depth: 2,
    timeLimitMs: 1000,
    useAspiration: false,
    useSoftTimeManagement: false,
    candidateLimit: Number.POSITIVE_INFINITY
  };
  const result = searchBestMove(position, {
    ...commonOptions,
    transpositionTable: createSeededTable()
  });
  const disabled = searchBestMove(position, {
    ...commonOptions,
    transpositionTable: createSeededTable(),
    useTranspositionMoveOrdering: false
  });

  assert.equal(result.depth, 2);
  assert.equal(result.bestMove.notation, disabled.bestMove.notation);
  assert.ok(result.stats.ttMoveHits > 0);
  assert.equal(disabled.stats.ttMoveHits, 0);
});

test("search adapts late-move reductions by depth and move order", () => {
  const position = parseFen("3ak4/9/4r4/9/9/9/9/9/9/3KR4 r");
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
  assert.equal(adaptive.bestMove.notation, fixed.bestMove.notation);
  assert.ok(Math.abs(Math.round(adaptive.score) - Math.round(fixed.score)) <= 12);
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
    useAspiration: false,
    useRootPvs: false
  });
  const disabled = searchBestMove(position, {
    depth: 3,
    timeLimitMs: 1000,
    useAspiration: false,
    useRootPvs: false,
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
  assert.ok(Math.abs(Math.round(withPruning.score) - Math.round(withoutPruning.score)) <= 12);
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

test("quiescence orders stored tactical hash moves before generic leaf moves", () => {
  const position = parseFen("4k4/9/9/9/9/9/4r4/9/4R4/4K4 r");
  const rootMove = generateLegalMoves(position)
    .find((candidate) => candidate.notation === "e8-e7");
  const child = makeMove(position, rootMove);
  const hashMove = generateCaptures(child)[0];
  const seededTable = () => new Map([
    [`${hashPosition(child)}:q:1`, {
      flag: "lower",
      score: 0,
      depth: 1,
      bestMove: hashMove
    }]
  ]);

  const result = searchBestMove(position, {
    depth: 1,
    timeLimitMs: 1000,
    useAspiration: false,
    exactRootScores: true,
    quiescenceTable: seededTable()
  });
  const disabled = searchBestMove(position, {
    depth: 1,
    timeLimitMs: 1000,
    useAspiration: false,
    exactRootScores: true,
    quiescenceTable: seededTable(),
    useQuiescenceHashMoveOrdering: false
  });

  assert.equal(hashMove.notation, "e6-e7");
  assert.ok(result.stats.qttMoveHits > 0);
  assert.equal(disabled.stats.qttMoveHits, 0);
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
  const position = parseFen("4k4/9/4r4/9/4p4/9/4P4/9/9/3AKR3 r");
  const withPruning = searchBestMove(position, {
    depth: 5,
    timeLimitMs: 5000,
    useAspiration: false,
    useSoftTimeManagement: false,
    useImprovingHeuristics: false,
    useRootPvs: false
  });
  const withoutPruning = searchBestMove(position, {
    depth: 5,
    timeLimitMs: 5000,
    useAspiration: false,
    useSoftTimeManagement: false,
    useImprovingHeuristics: false,
    useRootPvs: false,
    useSeePruning: false
  });

  assert.equal(withPruning.depth, 5);
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
  const position = parseFen("4k4/9/4r4/9/4p4/9/4P4/9/9/3KR4 r");
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
  const position = parseFen("4k4/9/4r4/9/4p4/9/4P4/9/9/3KR4 r");
  const result = searchBestMove(position, {
    depth: 5,
    timeLimitMs: 5000,
    useAspiration: false,
    useSoftTimeManagement: false,
    exactRootScores: true
  });
  const disabled = searchBestMove(position, {
    depth: 5,
    timeLimitMs: 5000,
    useAspiration: false,
    useSoftTimeManagement: false,
    useContinuationHistory: false,
    exactRootScores: true
  });

  assert.equal(result.depth, 5);
  assert.equal(result.bestMove.notation, disabled.bestMove.notation);
  assert.ok(Math.abs(Math.round(result.score) - Math.round(disabled.score)) <= 1);
  assert.ok(result.stats.continuationReductionBoosts + result.stats.continuationReductionMaluses > 0);
  assert.equal(disabled.stats.continuationReductionBoosts, 0);
  assert.equal(disabled.stats.continuationReductionMaluses, 0);
});

test("search tunes pruning and reductions with improving static-eval trends", () => {
  const position = parseFen("4k4/9/4r4/9/4p4/9/4P4/9/9/3KR4 r");
  const result = searchBestMove(position, {
    depth: 4,
    timeLimitMs: 5000,
    useAspiration: false,
    useSoftTimeManagement: false
  });
  const disabled = searchBestMove(position, {
    depth: 4,
    timeLimitMs: 5000,
    useAspiration: false,
    useSoftTimeManagement: false,
    useImprovingHeuristics: false
  });
  const adjustments = result.stats.improvingReductionGuards +
    result.stats.nonImprovingReductionBoosts +
    result.stats.improvingLateMoveGuards +
    result.stats.nonImprovingLateMovePrunes;
  const disabledAdjustments = disabled.stats.improvingReductionGuards +
    disabled.stats.nonImprovingReductionBoosts +
    disabled.stats.improvingLateMoveGuards +
    disabled.stats.nonImprovingLateMovePrunes;

  assert.equal(result.depth, 4);
  assert.equal(result.bestMove.notation, disabled.bestMove.notation);
  assert.equal(Math.round(result.score), Math.round(disabled.score));
  assert.ok(result.stats.improvingNodes > 0);
  assert.ok(result.stats.nonImprovingNodes > 0);
  assert.ok(adjustments > 0);
  assert.equal(disabled.stats.improvingNodes, 0);
  assert.equal(disabled.stats.nonImprovingNodes, 0);
  assert.equal(disabledAdjustments, 0);
});

test("search guards PV-node late-move reductions by node type", () => {
  const position = parseFen("4k4/9/4r4/9/4p4/9/4P4/9/9/3KR4 r");
  const result = searchBestMove(position, {
    depth: 4,
    timeLimitMs: 5000,
    useAspiration: false,
    useSoftTimeManagement: false
  });
  const disabled = searchBestMove(position, {
    depth: 4,
    timeLimitMs: 5000,
    useAspiration: false,
    useSoftTimeManagement: false,
    useNodeTypeReductions: false
  });

  assert.equal(result.depth, 4);
  assert.equal(result.bestMove.notation, disabled.bestMove.notation);
  assert.equal(Math.round(result.score), Math.round(disabled.score));
  assert.ok(result.stats.pvReductionGuards > 0);
  assert.equal(disabled.stats.pvReductionGuards, 0);
  assert.equal(disabled.stats.cutNodeReductionBoosts, 0);
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

test("search prunes quiet moves with poor learned history", () => {
  const position = parseFen("2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r");
  const result = searchBestMove(position, {
    depth: 4,
    timeLimitMs: 5000,
    useAspiration: false,
    useSoftTimeManagement: false
  });
  const disabled = searchBestMove(position, {
    depth: 4,
    timeLimitMs: 5000,
    useAspiration: false,
    useSoftTimeManagement: false,
    useHistoryPruning: false
  });

  assert.equal(result.depth, 4);
  assert.equal(result.bestMove.notation, disabled.bestMove.notation);
  assert.equal(Math.round(result.score), Math.round(disabled.score));
  assert.ok(result.stats.historyMaluses > 0);
  assert.ok(result.stats.badHistoryPrunes > 0);
  assert.ok(result.stats.badHistoryPruneGuards > 0);
  assert.equal(disabled.stats.badHistoryPrunes, 0);
  assert.equal(disabled.stats.badHistoryPruneGuards, 0);
});
