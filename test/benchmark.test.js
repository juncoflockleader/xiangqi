import test from "node:test";
import assert from "node:assert/strict";
import {
  ENGINE_BENCHMARKS,
  formatBenchmarkReport,
  runBenchmarkSuite
} from "../src/index.js";

test("benchmark suite solves the starter engine positions", async () => {
  const report = await runBenchmarkSuite();

  assert.equal(report.total, ENGINE_BENCHMARKS.length);
  assert.equal(report.failed, 0);
  assert.equal(report.solved, report.total);
  assert.ok(report.results.some((result) => result.id === "book-central-cannon" && result.sourceMatched));
  assert.ok(report.results.every((result) => result.summary.length > 0));
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
  assert.ok(text.includes("PASS book-central-cannon"));
  assert.ok(text.includes("opening-book"));
});
