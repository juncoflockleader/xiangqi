import test from "node:test";
import assert from "node:assert/strict";
import {
  ENGINE_TACTICS_BENCHMARKS,
  createJavaScriptEngineBackend,
  resolveBenchmarkSuite,
  runBenchmarkSuite
} from "../src/index.js";

test("tactics suite is registered and resolvable by name", () => {
  const suite = resolveBenchmarkSuite("tactics");
  assert.equal(suite, ENGINE_TACTICS_BENCHMARKS);
  assert.ok(suite.length >= 3, "tactics suite should have several positions");
  for (const record of suite) {
    assert.ok(record.fen, `${record.id} needs a FEN`);
    assert.ok(record.expectedMoves.length >= 1, `${record.id} needs an expected move`);
  }
});

test("JS engine solves every tactic in the regression suite", async () => {
  const engine = createJavaScriptEngineBackend({ profile: "balanced" });
  const report = await runBenchmarkSuite(engine, {
    benchmarks: ENGINE_TACTICS_BENCHMARKS
  });

  const failures = report.results
    .filter((result) => !result.solved)
    .map((result) => `${result.id}: expected ${result.expectedMoves}, got ${result.actualMove}`);

  assert.deepEqual(failures, [], "all tactics should be solved");
  assert.equal(report.solved, report.total);
  assert.equal(report.total, ENGINE_TACTICS_BENCHMARKS.length);
});
