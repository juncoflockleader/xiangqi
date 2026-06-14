import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("native probe CLI verifies a configured UCI backend", async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    "examples/native-probe.mjs",
    "--command", process.execPath,
    "--arg", "fixtures/mock-ucci.mjs",
    "--protocol", "uci",
    "--depth", "2",
    "--time", "100",
    "--lines", "2",
    "--option", "Threads=2",
    "--option", "Hash=64",
    "--review", "h9-g7",
    "--json"
  ], {
    cwd: root,
    timeout: 5000
  });
  const report = JSON.parse(stdout);

  assert.equal(report.ok, true);
  assert.equal(report.protocol, "uci");
  assert.equal(report.backend.kind, "native-uci");
  assert.deepEqual(report.nativeOptions, [
    { name: "Threads", value: 2 },
    { name: "Hash", value: 64 }
  ]);
  assert.equal(report.bestMove, "h9-g7");
  assert.equal(report.source, "native-uci");
  assert.equal(report.scoreDetail.kind, "cp");
  assert.equal(report.scoreDetail.text, "+0.42");
  assert.equal(report.wdl, null);
  assert.equal(report.comparison.bestMove, "h9-g7");
  assert.equal(report.comparison.nextMove, "h7-e7");
  assert.equal(report.comparison.scoreGap, 30);
  assert.equal(report.alternatives.length, 2);
  assert.equal(report.alternatives[0].move, "h9-g7");
  assert.equal(report.alternatives[0].scoreDetail.kind, "cp");
  assert.equal(report.review.move, "h9-g7");
  assert.equal(report.review.classification, "best");
  assert.equal(report.review.bestScoreDetail.kind, "cp");
});

test("native probe CLI explains missing command configuration", async () => {
  await assert.rejects(
    () => execFileAsync(process.execPath, [
      "examples/native-probe.mjs",
      "--json"
    ], {
      cwd: root,
      timeout: 5000,
      env: {
        ...process.env,
        XIANGQI_ENGINE_COMMAND: ""
      }
    }),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /requires --command or XIANGQI_ENGINE_COMMAND/);
      return true;
    }
  );
});
