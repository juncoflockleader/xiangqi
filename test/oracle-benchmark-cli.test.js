import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("oracle benchmark CLI compares JavaScript candidate to native oracle", async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    "examples/oracle-benchmark.mjs",
    "--oracle-command", process.execPath,
    "--oracle-arg", "fixtures/mock-ucci.mjs",
    "--oracle-protocol", "uci",
    "--oracle-depth", "2",
    "--oracle-time", "100",
    "--candidate-depth", "1",
    "--candidate-time", "100",
    "--tag", "opening",
    "--oracle-option", "Threads=2",
    "--json"
  ], {
    cwd: root,
    timeout: 5000
  });
  const report = JSON.parse(stdout);

  assert.equal(report.total, 1);
  assert.equal(report.candidate.kind, "javascript");
  assert.equal(report.oracle.kind, "native-uci");
  assert.equal(report.results[0].id, "book-central-cannon");
  assert.equal(report.results[0].candidateMove, "h7-e7");
  assert.equal(report.results[0].oracleMove, "h9-g7");
  assert.equal(report.results[0].oracleReview.classification, "good");
  assert.ok(report.aggregate.averageCentipawnLoss >= 0);
});

test("oracle benchmark CLI explains missing oracle command configuration", async () => {
  await assert.rejects(
    () => execFileAsync(process.execPath, [
      "examples/oracle-benchmark.mjs",
      "--json"
    ], {
      cwd: root,
      timeout: 5000,
      env: {
        ...process.env,
        XIANGQI_ENGINE_COMMAND: "",
        XIANGQI_ORACLE_ENGINE_COMMAND: ""
      }
    }),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /requires --oracle-command/);
      return true;
    }
  );
});
