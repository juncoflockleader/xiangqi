import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("benchmark CLI can run a native preset engine against a built-in suite", async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    "examples/benchmark.mjs",
    "--suite", "opening-oracle",
    "--id", "oracle-opening-central-cannon-horse-reply",
    "--engine-preset", "local-cpp",
    "--engine-command", process.execPath,
    "--engine-arg", "fixtures/mock-ucci.mjs",
    "--depth", "2",
    "--time", "100",
    "--json"
  ], {
    cwd: root,
    timeout: 8000
  });
  const report = JSON.parse(stdout);

  assert.equal(report.total, 1);
  assert.equal(report.failed, 0);
  assert.equal(report.results[0].id, "oracle-opening-central-cannon-horse-reply");
  assert.equal(report.results[0].actualMove, "h9-g7");
  assert.equal(report.results[0].source, "native-uci");
  assert.ok(report.aggregate.nodes > 0);
});

test("benchmark CLI can repeat a run and summarize speed samples", async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    "examples/benchmark.mjs",
    "--suite", "opening-oracle",
    "--id", "oracle-opening-central-cannon-horse-reply",
    "--engine-preset", "local-cpp",
    "--engine-command", process.execPath,
    "--engine-arg", "fixtures/mock-ucci.mjs",
    "--depth", "2",
    "--time", "100",
    "--repeat", "2",
    "--json"
  ], {
    cwd: root,
    timeout: 12000
  });
  const report = JSON.parse(stdout);

  assert.equal(report.total, 1);
  assert.equal(report.failed, 0);
  assert.equal(report.repeat.count, 2);
  assert.equal(report.repeat.samples.length, 2);
  assert.equal(report.repeat.samples[0].iteration, 1);
  assert.equal(report.repeat.samples[1].iteration, 2);
  assert.ok(report.repeat.aggregate.nodesPerSecondAvg > 0);
  assert.equal(report.repeat.failedRuns, 0);
});
