import test from "node:test";
import assert from "node:assert/strict";
import {
  MATE_SCORE,
  createEngine,
  createInitialPosition,
  generateLegalMoves,
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
  assert.equal(result.explanation.alternatives[0].note, "repeats a known position for a draw-assumed score");
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
