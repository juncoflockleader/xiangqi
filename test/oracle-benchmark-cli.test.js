import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
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

test("oracle benchmark CLI applies the Pikafish oracle preset", async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    "examples/oracle-benchmark.mjs",
    "--oracle-preset", "pikafish",
    "--oracle-command", process.execPath,
    "--oracle-arg", "fixtures/mock-ucci.mjs",
    "--oracle-eval-file", "pikafish.nnue",
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

  assert.equal(report.oracle.name, "Pikafish");
  assert.equal(report.oracle.kind, "native-uci");
  assert.equal(report.results[0].oracleMove, "h9-g7");
  assert.match(report.results[0].oracleSummary, /Pikafish/);
});

test("oracle benchmark CLI can load custom positions without expected moves", async () => {
  const dir = await mkdtemp(join(tmpdir(), "xiangqi-oracle-benchmark-cli-"));
  const suitePath = join(dir, "suite.json");

  try {
    await writeFile(suitePath, JSON.stringify({
      benchmarks: [
        {
          id: "oracle-only-opening",
          fen: "rheakaehr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RHEAKAEHR r",
          tags: ["oracle-only"],
          lesson: "Oracle-only suites do not need an expected move."
        }
      ]
    }, null, 2), "utf8");

    const { stdout } = await execFileAsync(process.execPath, [
      "examples/oracle-benchmark.mjs",
      "--benchmarks", suitePath,
      "--oracle-command", process.execPath,
      "--oracle-arg", "fixtures/mock-ucci.mjs",
      "--oracle-protocol", "uci",
      "--oracle-depth", "2",
      "--oracle-time", "100",
      "--candidate-depth", "1",
      "--candidate-time", "100",
      "--json"
    ], {
      cwd: root,
      timeout: 8000
    });
    const report = JSON.parse(stdout);

    assert.equal(report.total, 1);
    assert.equal(report.results[0].id, "oracle-only-opening");
    assert.equal(report.results[0].candidateMove, "h7-e7");
    assert.equal(report.results[0].oracleMove, "h9-g7");
    assert.equal(report.results[0].oracleReview.classification, "good");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
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
        XIANGQI_ENGINE_PRESET: "",
        XIANGQI_ORACLE_ENGINE_COMMAND: "",
        XIANGQI_ORACLE_ENGINE_PRESET: "",
        XIANGQI_PIKAFISH_AUTO_DISCOVER: "false"
      }
    }),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /requires --oracle-command/);
      return true;
    }
  );
});
