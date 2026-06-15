import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzePosition,
  buildLinePlan,
  createEngine,
  createInitialPosition,
  generateCaptures,
  generateLegalMoves,
  hashPosition,
  makeMove,
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
  assert.equal(analysis.lines[0].explanation.linePlan.firstMove, analysis.lines[0].move.notation);
  assert.ok(analysis.lines[0].explanation.linePlan.moves.length > 0);
  assert.equal(typeof analysis.lines[0].explanation.linePlan.moves[0].scoreAfter, "number");
  assert.match(analysis.lines[0].explanation.linePlan.moves[0].scoreAfterText, /^([+-]\d+\.\d\d|winning by force|losing by force)$/);
  assert.ok(analysis.lines.every((line) => line.principalVariation.length > 0));
});

test("standalone analyzePosition helper mirrors engine analysis", () => {
  const position = createInitialPosition();
  const analysis = analyzePosition(position, { lines: 2, depth: 1, timeLimitMs: 500 });

  assert.equal(analysis.lines.length, 2);
  assert.ok(analysis.explanation.summary.includes(analysis.bestMove.notation));
  assert.equal(analysis.explanation.linePlan.firstMove, analysis.bestMove.notation);
});

test("multi-line analysis searches exact root candidates by default", () => {
  const position = parseFen("4k4/9/9/9/9/9/9/9/9/3KR4 r");
  const engine = createEngine({ depth: 2, timeLimitMs: 1000 });
  const analysis = engine.analyzePosition(position, {
    useBook: false,
    lines: 3,
    depth: 2,
    timeLimitMs: 1000
  });
  const legalMoveCount = generateLegalMoves(position).length;

  assert.equal(analysis.depth, 2);
  assert.equal(analysis.lines.length, 3);
  assert.equal(analysis.stats.rootMovesSearched, legalMoveCount * analysis.depth);
  assert.equal(analysis.stats.aspirationSearches, 0);
});

test("move explanations contrast root alternatives", () => {
  const position = createInitialPosition();
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const result = engine.chooseMove(position, {
    useBook: false,
    depth: 1,
    timeLimitMs: 500
  });
  const alternatives = result.explanation.alternatives;

  assert.ok(alternatives.length > 1);
  assert.equal(alternatives[0].verdict, "best");
  assert.equal(alternatives[0].centipawnLoss, 0);
  assert.ok(alternatives[0].note.startsWith("top line"));
  assert.ok(alternatives[0].summary.includes(alternatives[0].move));
  assert.ok(alternatives[0].reasons.some((reason) => reason.includes("top line")));
  assert.equal(alternatives[0].linePlanSummary, result.explanation.linePlan.summary);
  assert.equal(alternatives[0].planComparison, null);
  assert.ok(Array.isArray(alternatives[0].motifs));
  assert.ok(alternatives[0].principalVariationText.includes(alternatives[0].move));

  for (const alternative of alternatives.slice(1)) {
    assert.ok(alternative.centipawnLoss >= 0);
    assert.ok(["tied", "playable", "inferior", "poor"].includes(alternative.verdict));
    assert.match(alternative.note, /roughly tied|trails the top line/);
    assert.ok(alternative.reasons.length > 0);
    assert.match(alternative.reasons[0], /roughly tied|trails the top line/);
    assert.equal(typeof alternative.linePlanSummary, "string");
    assert.equal(alternative.planComparison.playedMove, alternative.move);
    assert.equal(alternative.planComparison.bestMove, alternatives[0].move);
    assert.equal(alternative.planComparison.centipawnLoss, alternative.centipawnLoss);
    assert.ok(alternative.planComparison.summary.includes("top line"));
    assert.equal(
      alternative.expectedReply,
      alternative.principalVariation.length > 1 ? alternative.principalVariation[1] : null
    );
    assert.ok(alternative.principalVariationText.includes(alternative.move));
  }
});

test("move explanations surface selective-search diagnostics", () => {
  const position = parseFen("2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r");
  const engine = createEngine({ depth: 5, timeLimitMs: 3000 });
  const result = engine.chooseMove(position, {
    useBook: false,
    depth: 5,
    timeLimitMs: 3000,
    useAspiration: false,
    useSoftTimeManagement: false
  });
  const selectiveWork = (
    result.stats.ttHits +
    result.stats.qttHits +
    result.stats.evalCacheHits +
    result.stats.tacticalCacheHits +
    result.stats.killerHits +
    result.stats.nullMovePrunes +
    result.stats.probCutPrunes +
    result.stats.seePrunes +
    result.stats.futilityPrunes +
    result.stats.razorPrunes +
    result.stats.deltaPrunes +
    result.stats.deepReductions +
    result.stats.iidMoveHits
  );
  const selectivityFactor = result.explanation.confidence.factors
    .find((factor) => factor.kind === "selectivity");

  assert.ok(selectiveWork > 0);
  assert.ok(result.explanation.reasons.some((reason) => (
    reason.includes("Selective search") || reason.includes("Search reuse and ordering evidence")
  )));
  assert.ok(selectivityFactor);
  assert.match(selectivityFactor.text, /Selective search/);
  assert.match(selectivityFactor.text, /quiescence-table reuse/);
  assert.match(selectivityFactor.text, /evaluation-cache reuse/);
  assert.match(selectivityFactor.text, /static-exchange cache reuse/);
  assert.match(selectivityFactor.text, /killer-move ordering/);
});

test("move explanations surface check-evasion ordering diagnostics", () => {
  const position = parseFen("3ak4/9/4r4/9/9/9/9/9/9/3K5 r");
  const engine = createEngine({ depth: 3, timeLimitMs: 2000 });
  const result = engine.chooseMove(position, {
    useBook: false,
    depth: 3,
    timeLimitMs: 2000,
    useAspiration: false,
    useSoftTimeManagement: false
  });
  const selectivityFactor = result.explanation.confidence.factors
    .find((factor) => factor.kind === "selectivity");

  assert.ok(result.stats.checkEvasionOrderHits > 0);
  assert.ok(result.explanation.reasons.some((reason) => reason.includes("check-evasion ordering")));
  assert.ok(selectivityFactor);
  assert.match(selectivityFactor.text, /check-evasion ordering/);
});

test("move explanations surface check-history ordering diagnostics", () => {
  const position = parseFen("4k4/9/4r4/9/4p4/9/4P4/9/9/3KR4 r");
  const engine = createEngine({ depth: 3, timeLimitMs: 2000 });
  const result = engine.chooseMove(position, {
    useBook: false,
    depth: 3,
    timeLimitMs: 2000,
    useAspiration: false,
    useSoftTimeManagement: false
  });
  const selectivityFactor = result.explanation.confidence.factors
    .find((factor) => factor.kind === "selectivity");

  assert.ok(result.stats.checkHistoryHits > 0);
  assert.ok(result.explanation.reasons.some((reason) => reason.includes("check-history")));
  assert.ok(selectivityFactor);
  assert.match(selectivityFactor.text, /check-history ordering/);
});

test("move explanations surface history-gravity learning diagnostics", () => {
  const position = parseFen("4k4/9/4h4/4c4/4P4/9/4C4/9/9/4K4 r");
  const engine = createEngine({ depth: 3, timeLimitMs: 1000 });
  const result = engine.chooseMove(position, {
    useBook: false,
    depth: 3,
    timeLimitMs: 1000,
    useAspiration: false
  });
  const selectivityFactor = result.explanation.confidence.factors
    .find((factor) => factor.kind === "selectivity");

  assert.ok(result.stats.historyGravityUpdates > 0);
  assert.ok(selectivityFactor);
  assert.match(selectivityFactor.text, /history-gravity learning/);
});

test("move explanations surface quiescence hash-move ordering diagnostics", () => {
  const position = parseFen("4k4/9/9/9/9/9/4r4/9/4R4/4K4 r");
  const rootMove = generateLegalMoves(position)
    .find((candidate) => candidate.notation === "e8-e7");
  const child = makeMove(position, rootMove);
  const hashMove = generateCaptures(child)[0];
  const quiescenceTable = new Map([
    [`${hashPosition(child)}:q:1`, {
      flag: "lower",
      score: 0,
      depth: 1,
      bestMove: hashMove
    }]
  ]);
  const engine = createEngine({ depth: 1, timeLimitMs: 1000 });
  const result = engine.chooseMove(position, {
    useBook: false,
    depth: 1,
    timeLimitMs: 1000,
    useAspiration: false,
    exactRootScores: true,
    quiescenceTable
  });
  const selectivityFactor = result.explanation.confidence.factors
    .find((factor) => factor.kind === "selectivity");

  assert.ok(result.stats.qttMoveHits > 0);
  assert.ok(result.explanation.reasons.some((reason) => reason.includes("quiescence hash-move")));
  assert.ok(selectivityFactor);
  assert.match(selectivityFactor.text, /quiescence hash-move ordering/);
});

test("move explanations surface transposition hash-move ordering diagnostics", () => {
  const position = parseFen("3ak4/9/4c4/4p4/9/4P4/4C4/9/9/3AKA3 r");
  const engine = createEngine({ depth: 2, timeLimitMs: 1000 });
  engine.chooseMove(position, {
    useBook: false,
    depth: 2,
    timeLimitMs: 1000,
    useAspiration: false,
    useSoftTimeManagement: false
  });
  const result = engine.chooseMove(position, {
    useBook: false,
    depth: 3,
    timeLimitMs: 1000,
    useAspiration: false,
    useSoftTimeManagement: false
  });
  const selectivityFactor = result.explanation.confidence.factors
    .find((factor) => factor.kind === "selectivity");

  assert.ok(result.stats.ttMoveHits > 0);
  assert.ok(result.explanation.reasons.some((reason) => reason.includes("transposition hash-move")));
  assert.ok(selectivityFactor);
  assert.match(selectivityFactor.text, /transposition hash-move ordering/);
});

test("move explanations surface continuation-history reduction tuning", () => {
  const position = parseFen("2bakab2/9/4c4/9/4p4/4P4/9/4C4/9/2BAKAB2 r");
  const engine = createEngine({ depth: 4, timeLimitMs: 5000 });
  const result = engine.chooseMove(position, {
    useBook: false,
    depth: 4,
    timeLimitMs: 5000,
    useAspiration: false,
    useSoftTimeManagement: false,
    useRootScoreOrdering: false,
    useNodeTypeReductions: false,
    exactRootScores: true
  });
  const selectivityFactor = result.explanation.confidence.factors
    .find((factor) => factor.kind === "selectivity");

  assert.ok(result.stats.continuationReductionBoosts + result.stats.continuationReductionMaluses > 0);
  assert.ok(selectivityFactor);
  assert.match(selectivityFactor.text, /continuation-history reduction tuning/);
});

test("move explanations surface improving-position search tuning", () => {
  const position = parseFen("4k4/9/4r4/9/4p4/9/4P4/9/9/3KR4 r");
  const engine = createEngine({ depth: 4, timeLimitMs: 5000 });
  const result = engine.chooseMove(position, {
    useBook: false,
    depth: 4,
    timeLimitMs: 5000,
    useAspiration: false,
    useSoftTimeManagement: false
  });
  const adjustments = result.stats.improvingReductionGuards +
    result.stats.nonImprovingReductionBoosts +
    result.stats.improvingLateMoveGuards +
    result.stats.nonImprovingLateMovePrunes;
  const selectivityFactor = result.explanation.confidence.factors
    .find((factor) => factor.kind === "selectivity");

  assert.ok(result.stats.improvingNodes > 0);
  assert.ok(result.stats.nonImprovingNodes > 0);
  assert.ok(adjustments > 0);
  assert.ok(result.explanation.reasons.some((reason) => reason.includes("improving-position")));
  assert.ok(selectivityFactor);
  assert.match(selectivityFactor.text, /improving-position search tuning/);
});

test("move explanations surface node-type LMR tuning", () => {
  const position = parseFen("4k4/9/4r4/9/4p4/9/4P4/9/9/3KR4 r");
  const engine = createEngine({ depth: 4, timeLimitMs: 5000 });
  const result = engine.chooseMove(position, {
    useBook: false,
    depth: 4,
    timeLimitMs: 5000,
    useAspiration: false,
    useSoftTimeManagement: false
  });
  const selectivityFactor = result.explanation.confidence.factors
    .find((factor) => factor.kind === "selectivity");

  assert.ok(result.stats.pvReductionGuards > 0);
  assert.ok(result.explanation.reasons.some((reason) => reason.includes("node-type LMR")));
  assert.ok(selectivityFactor);
  assert.match(selectivityFactor.text, /node-type LMR tuning/);
});

test("move explanations surface bad-history pruning diagnostics", () => {
  const position = parseFen("2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r");
  const engine = createEngine({ depth: 4, timeLimitMs: 5000 });
  const result = engine.chooseMove(position, {
    useBook: false,
    depth: 4,
    timeLimitMs: 5000,
    useAspiration: false,
    useSoftTimeManagement: false
  });
  const selectivityFactor = result.explanation.confidence.factors
    .find((factor) => factor.kind === "selectivity");

  assert.ok(result.stats.badHistoryPrunes > 0);
  assert.ok(result.explanation.reasons.some((reason) => reason.includes("bad-history quiet prune")));
  assert.ok(selectivityFactor);
  assert.match(selectivityFactor.text, /bad-history pruning/);
});

test("analysis line count is clamped to a useful range", () => {
  const position = createInitialPosition();
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });

  assert.equal(engine.analyzePosition(position, { lines: 0 }).lines.length, 1);
  assert.equal(engine.analyzePosition(position, { lines: 99 }).lines.length, 12);
});

test("line plans can be built from move notation strings", () => {
  const plan = buildLinePlan(createInitialPosition(), ["h7e7", "h0g2"]);

  assert.equal(plan.perspective, "red");
  assert.equal(plan.firstMove, "h7-e7");
  assert.equal(plan.expectedReply, "h0-g2");
  assert.equal(plan.moves[0].role, "engine-choice");
  assert.equal(plan.startingScore, plan.moves[0].scoreBefore);
  assert.equal(plan.endingScore, plan.moves.at(-1).scoreAfter);
  assert.equal(plan.evaluationSwing, plan.endingScore - plan.startingScore);
  assert.equal(plan.moves[0].scoreDelta, plan.moves[0].scoreAfter - plan.moves[0].scoreBefore);
  assert.match(plan.moves[0].scoreDeltaText, /^[+-]\d+ centipawns$/);
  assert.ok(plan.summary.includes("h7-e7"));
});
