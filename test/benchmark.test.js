import test from "node:test";
import assert from "node:assert/strict";
import {
  ENGINE_BENCHMARKS,
  ENGINE_OPENING_ORACLE_BENCHMARKS,
  compareEngineToOracle,
  compareEngineBackends,
  createBenchmarkSuite,
  createJavaScriptEngineBackend,
  createLearningEngineBackend,
  formatBenchmarkReport,
  formatEngineComparisonReport,
  formatOracleComparisonReport,
  listBenchmarkSuiteNames,
  resolveBenchmarkSuite,
  runBenchmarkSuite
} from "../src/index.js";

test("benchmark suite solves the starter engine positions", async () => {
  const report = await runBenchmarkSuite();

  assert.equal(report.total, ENGINE_BENCHMARKS.length);
  assert.equal(report.failed, 0);
  assert.equal(report.solved, report.total);
  assert.ok(report.aggregate.nodes >= 0);
  assert.ok(report.aggregate.nodesPerSecond >= 0);
  assert.ok(report.aggregate.averageDepth >= 0);
  assert.equal(report.aggregate.timedOut, 0);
  assert.equal(typeof report.aggregate.stats.qnodes, "number");
  assert.ok(report.results.some((result) => result.id === "book-central-cannon" && result.sourceMatched));
  assert.ok(report.results.every((result) => result.summary.length > 0));
  assert.ok(report.results.every((result) => result.stats));
});

test("benchmark suite can filter by tag", async () => {
  const report = await runBenchmarkSuite(null, { tag: "mate" });

  assert.equal(report.total, 1);
  assert.equal(report.results[0].id, "rook-delivers-face-capture");
  assert.equal(report.results[0].actualMove, "e9-e8");
});

test("benchmark suite can filter by id", async () => {
  const report = await runBenchmarkSuite(null, { id: "book-central-cannon" });

  assert.equal(report.total, 1);
  assert.equal(report.results[0].id, "book-central-cannon");
  assert.equal(report.results[0].actualMove, "h7-e7");
});

test("named opening oracle suite captures native regression positions", () => {
  const suite = resolveBenchmarkSuite("opening-oracle");
  const aliases = listBenchmarkSuiteNames();

  assert.equal(suite, ENGINE_OPENING_ORACLE_BENCHMARKS);
  assert.ok(aliases.includes("starter"));
  assert.ok(aliases.includes("opening-oracle"));
  assert.equal(suite.length, 6);
  assert.ok(suite.every((benchmark) => benchmark.tags.includes("oracle")));
  assert.ok(suite.every((benchmark) => benchmark.options.useBook === false));
  assert.ok(suite.every((benchmark) => benchmark.options.lines === 5));
  assert.ok(suite.some((benchmark) => benchmark.id === "oracle-opening-left-screen-central-cannon"));
  assert.equal(resolveBenchmarkSuite("starter"), ENGINE_BENCHMARKS);
  assert.throws(() => resolveBenchmarkSuite("missing-suite"), /Unknown benchmark suite/);
});

test("benchmark report is readable", async () => {
  const report = await runBenchmarkSuite(null, { tag: "opening" });
  const text = formatBenchmarkReport(report);

  assert.ok(text.includes("Benchmarks: 3/3 solved"));
  assert.ok(text.includes("nodes"));
  assert.ok(text.includes("depth"));
  assert.ok(text.includes("PASS book-central-cannon"));
  assert.ok(text.includes("PASS book-central-cannon-oracle-continuation"));
  assert.ok(text.includes("opening-book"));
});

test("custom benchmark suites can be normalized and run", async () => {
  const suite = createBenchmarkSuite({
    defaults: {
      tags: "custom learning",
      options: {
        depth: 2,
        timeLimitMs: 1000,
        useBook: false
      }
    },
    benchmarks: [
      {
        id: "custom-rook-win",
        name: "Custom Rook Win",
        fen: "4k4/9/4r4/9/9/9/9/9/9/3KR4 r",
        expectedMove: "e9-e2",
        lines: 3,
        lesson: "Custom suites can capture lesson positions from sparring."
      }
    ]
  });
  const report = await runBenchmarkSuite(null, { benchmarks: suite });

  assert.equal(suite[0].id, "custom-rook-win");
  assert.deepEqual(suite[0].tags, ["custom", "learning"]);
  assert.equal(suite[0].options.useBook, false);
  assert.equal(suite[0].options.lines, 3);
  assert.equal(report.total, 1);
  assert.equal(report.failed, 0);
  assert.equal(report.results[0].actualMove, "e9-e2");
});

test("custom benchmark suites validate required fields", () => {
  assert.throws(
    () => createBenchmarkSuite([{ id: "missing-fen", expectedMove: "h7-e7" }]),
    /requires fen/
  );
  assert.throws(
    () => createBenchmarkSuite([{ id: "missing-expected", fen: ENGINE_BENCHMARKS[0].fen }]),
    /requires expectedMoves/
  );
});

test("engine comparison reports multiple sync and async backends", async () => {
  const jsBackend = createJavaScriptEngineBackend({ depth: 2, timeLimitMs: 500 });
  const asyncBackend = {
    id: "async-reference",
    name: "Async Reference",
    kind: "test",
    chooseMove: async (position, options) => jsBackend.chooseMove(position, options)
  };

  const comparison = await compareEngineBackends([
    jsBackend,
    { engine: asyncBackend, searchOptions: { depth: 2, timeLimitMs: 500 } }
  ], {
    tag: "opening"
  });
  const text = formatEngineComparisonReport(comparison);

  assert.equal(comparison.totalBackends, 2);
  assert.equal(comparison.benchmarkTotal, 3);
  assert.equal(comparison.backends[0].solved, 3);
  assert.equal(comparison.backends[1].solved, 3);
  assert.equal(comparison.backends[1].id, "async-reference");
  assert.equal(comparison.backends[0].status.state, "primary");
  assert.equal(comparison.backends[0].fallbackCount, 0);
  assert.ok(comparison.backends[0].aggregate.nodes >= 0);
  assert.ok(text.includes("JavaScript Reference Engine"));
  assert.ok(text.includes("Async Reference"));
  assert.ok(text.includes("status primary"));
  assert.ok(text.includes("3/3 solved"));
});

test("engine comparison reports fallback backend usage", async () => {
  const backend = createLearningEngineBackend({
    command: "/path/that/should/not/start",
    profile: "native-ucci",
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 50,
    commandTimeoutMs: 50,
    javascript: {
      profile: "balanced",
      depth: 2,
      timeLimitMs: 1000
    }
  });

  try {
    const comparison = await compareEngineBackends([backend], { tag: "tactic" });
    const text = formatEngineComparisonReport(comparison);
    const report = comparison.backends[0];

    assert.equal(report.kind, "hybrid");
    assert.equal(report.status.state, "fallback");
    assert.equal(report.fallbackCount, 1);
    assert.equal(report.report.results[0].backendFallback.fallbackBackend, "javascript-reference");
    assert.ok(text.includes("status fallback"));
    assert.ok(text.includes("1 fallback"));
  } finally {
    await backend.close();
  }
});

test("oracle comparison grades candidate moves with oracle review", async () => {
  const candidate = createJavaScriptEngineBackend({ name: "Candidate JS", depth: 1, timeLimitMs: 100 });
  const oracle = createJavaScriptEngineBackend({ name: "Oracle JS", depth: 1, timeLimitMs: 100 });
  const comparison = await compareEngineToOracle(candidate, oracle, {
    tag: "opening",
    searchOptions: { useBook: true, depth: 1, timeLimitMs: 100 },
    oracleSearchOptions: { useBook: true, depth: 1, timeLimitMs: 100 },
    oracleReviewOptions: { depth: 1, timeLimitMs: 100 }
  });
  const text = formatOracleComparisonReport(comparison);

  assert.equal(comparison.total, 3);
  assert.equal(comparison.exactMatches, 3);
  assert.equal(comparison.acceptable, 3);
  assert.equal(comparison.results[0].candidateMove, "h7-e7");
  assert.equal(comparison.results[0].oracleMove, "h7-e7");
  assert.equal(comparison.results[0].oracleReview.classification, "best");
  assert.ok(comparison.aggregate.averageCentipawnLoss >= 0);
  assert.ok(text.includes("Oracle comparison:"));
  assert.ok(text.includes("PASS book-central-cannon"));
});

test("oracle comparison surfaces review-needed disagreements", async () => {
  const base = createJavaScriptEngineBackend({ depth: 1, timeLimitMs: 100 });
  const candidate = createScriptedBenchmarkBackend(base, "a9-a8");
  const oracle = createScriptedOracleBackend(base, "h7-e7", {
    classification: "blunder",
    centipawnLoss: 180
  });
  const comparison = await compareEngineToOracle(candidate, oracle, {
    benchmarks: ENGINE_BENCHMARKS.filter((benchmark) => benchmark.id === "book-central-cannon"),
    acceptableLossCp: 60
  });
  const text = formatOracleComparisonReport(comparison);
  const result = comparison.results[0];

  assert.equal(comparison.exactMatches, 0);
  assert.equal(comparison.acceptable, 0);
  assert.equal(comparison.failed, 1);
  assert.equal(result.candidateMove, "a9-a8");
  assert.equal(result.oracleMove, "h7-e7");
  assert.equal(result.oracleReview.centipawnLoss, 180);
  assert.equal(result.oracleReview.classification, "blunder");
  assert.equal(result.oracleReview.planComparison.summary, "Scripted plan starts with a9-a8; scripted oracle prefers h7-e7, a blunder gap of 180 centipawns.");
  assert.equal(result.oracleReview.practiceFocus.title, "Decision quality");
  assert.equal(result.oracleReview.playedLinePlan.firstMove, "a9-a8");
  assert.equal(result.oracleReview.bestLinePlan.firstMove, "h7-e7");
  assert.ok(text.includes("REVIEW book-central-cannon"));
  assert.ok(text.includes("candidate a9-a8 vs oracle h7-e7"));
  assert.ok(text.includes("Plan: Scripted plan starts with a9-a8; scripted oracle prefers h7-e7"));
  assert.ok(text.includes("Focus: Decision quality"));
});

test("engine comparison rejects entries without chooseMove", async () => {
  await assert.rejects(
    () => compareEngineBackends([{ id: "bad-engine" }]),
    /missing chooseMove/
  );
});

function createScriptedBenchmarkBackend(base, notation) {
  return {
    id: "scripted-candidate",
    name: "Scripted Candidate",
    kind: "scripted",
    features: base.features,
    chooseMove(position) {
      const move = base.legalMoves(position).find((candidate) => candidate.notation === notation);
      return {
        bestMove: move,
        source: "scripted",
        score: 0,
        depth: 0,
        nodes: 0,
        principalVariation: move ? [move] : [],
        explanation: {
          summary: `Scripted candidate chooses ${notation}.`,
          reasons: [`Scripted benchmark forces ${notation}.`]
        }
      };
    }
  };
}

function createScriptedOracleBackend(base, notation, reviewResult) {
  return {
    id: "scripted-oracle",
    name: "Scripted Oracle",
    kind: "scripted",
    features: base.features,
    chooseMove(position) {
      const move = base.legalMoves(position).find((candidate) => candidate.notation === notation);
      return {
        bestMove: move,
        source: "oracle",
        score: 100,
        depth: 1,
        nodes: 10,
        principalVariation: move ? [move] : [],
        explanation: {
          summary: `Scripted oracle prefers ${notation}.`,
          reasons: [`Scripted oracle uses ${notation} as the benchmark answer.`]
        }
      };
    },
    reviewMove(position, playedNotation) {
      const played = base.legalMoves(position).find((move) => move.notation === playedNotation);
      const bestMove = base.legalMoves(position).find((move) => move.notation === notation);
      return {
        move: played,
        bestMove,
        classification: reviewResult.classification,
        centipawnLoss: reviewResult.centipawnLoss,
        playedScore: -reviewResult.centipawnLoss,
        bestScore: 0,
        depth: 1,
        nodes: 12,
        playedLinePlan: {
          summary: `Start with ${playedNotation}.`,
          firstMove: playedNotation,
          expectedReply: null,
          continuation: [],
          moves: [],
          motifs: [],
          evaluationSwing: 0
        },
        bestLinePlan: {
          summary: `Start with ${notation}.`,
          firstMove: notation,
          expectedReply: null,
          continuation: [],
          moves: [],
          motifs: [],
          evaluationSwing: 0
        },
        planComparison: {
          kind: "different-first-move",
          summary: `Scripted plan starts with ${playedNotation}; scripted oracle prefers ${notation}, a ${reviewResult.classification} gap of ${reviewResult.centipawnLoss} centipawns.`,
          playedMove: playedNotation,
          bestMove: notation,
          sameFirstMove: false,
          sameExpectedReply: true,
          sameContinuation: true,
          sharedMotifs: [],
          missedMotifs: [],
          playedOnlyMotifs: [],
          centipawnLoss: reviewResult.centipawnLoss,
          classification: reviewResult.classification,
          evaluationSwingDelta: 0,
          evaluationSwingDeltaText: "+0 centipawns",
          playedSummary: `Start with ${playedNotation}.`,
          bestSummary: `Start with ${notation}.`,
          reasons: [`Scripted oracle prefers ${notation}.`]
        },
        practiceFocus: {
          kind: "practice",
          category: "scripted",
          title: "Decision quality",
          text: "Practice comparing candidate moves before committing.",
          drill: "candidate-comparison",
          severity: 1
        },
        explanation: {
          summary: `${playedNotation} loses ${reviewResult.centipawnLoss} centipawns against the oracle.`,
          reasons: [`The oracle prefers ${notation}.`]
        }
      };
    }
  };
}
