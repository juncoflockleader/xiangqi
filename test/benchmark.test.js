import test from "node:test";
import assert from "node:assert/strict";
import {
  ENGINE_BENCHMARKS,
  compareEngineBackends,
  createJavaScriptEngineBackend,
  createLearningEngineBackend,
  formatBenchmarkReport,
  formatEngineComparisonReport,
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
  assert.equal(report.results[0].actualMove, "e9-e0");
});

test("benchmark report is readable", async () => {
  const report = await runBenchmarkSuite(null, { tag: "opening" });
  const text = formatBenchmarkReport(report);

  assert.ok(text.includes("Benchmarks: 1/1 solved"));
  assert.ok(text.includes("nodes"));
  assert.ok(text.includes("depth"));
  assert.ok(text.includes("PASS book-central-cannon"));
  assert.ok(text.includes("opening-book"));
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
  assert.equal(comparison.benchmarkTotal, 1);
  assert.equal(comparison.backends[0].solved, 1);
  assert.equal(comparison.backends[1].solved, 1);
  assert.equal(comparison.backends[1].id, "async-reference");
  assert.equal(comparison.backends[0].status.state, "primary");
  assert.equal(comparison.backends[0].fallbackCount, 0);
  assert.ok(comparison.backends[0].aggregate.nodes >= 0);
  assert.ok(text.includes("JavaScript Reference Engine"));
  assert.ok(text.includes("Async Reference"));
  assert.ok(text.includes("status primary"));
  assert.ok(text.includes("1/1 solved"));
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

test("engine comparison rejects entries without chooseMove", async () => {
  await assert.rejects(
    () => compareEngineBackends([{ id: "bad-engine" }]),
    /missing chooseMove/
  );
});
