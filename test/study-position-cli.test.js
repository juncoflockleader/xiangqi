import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TACTICAL_FEN = "4k4/9/4r4/9/9/9/9/9/9/3KR4 r";

test("study position CLI prints a readable default study", async () => {
  const { stdout } = await runStudyCli([
    "--depth", "1",
    "--time", "100",
    "--lines", "2"
  ]);

  assert.match(stdout, /Study backend: JavaScript Reference Engine \(javascript\)/);
  assert.match(stdout, /Position study: Red to move, best h7-e7/);
  assert.match(stdout, /Hints:/);
  assert.match(stdout, /Candidates:/);
  assert.match(stdout, /Reasons:/);
});

test("study position CLI reviews a played move", async () => {
  const { stdout } = await runStudyCli([
    "--fen", TACTICAL_FEN,
    "--move", "e9-f9",
    "--depth", "2",
    "--time", "1000",
    "--lines", "2"
  ]);

  assert.match(stdout, /Position study: Red to move, best e9-e2/);
  assert.match(stdout, /Review: e9-f9 is blunder, \d+ cp loss; best e9-e2\./);
  assert.match(stdout, /Compare e9-f9 with e9-e2/);
});

test("study position CLI emits machine-readable native backend study", async () => {
  const { stdout } = await runStudyCli([
    "--engine-command", process.execPath,
    "--engine-arg", "fixtures/mock-ucci.mjs",
    "--engine-protocol", "uci",
    "--startup-timeout", "1000",
    "--command-timeout", "1000",
    "--depth", "2",
    "--time", "100",
    "--lines", "2",
    "--no-book",
    "--json"
  ]);
  const report = JSON.parse(stdout);

  assert.equal(report.ok, true);
  assert.equal(report.backend.kind, "hybrid");
  assert.equal(report.backend.status.primaryBackend.kind, "native-uci");
  assert.equal(report.options.useBook, false);
  assert.equal(report.study.bestMove, "h9-g7");
  assert.equal(report.study.decision.source, "native-uci");
  assert.equal(report.study.decision.comparison.bestMove, "h9-g7");
  assert.equal(report.study.decision.comparison.nextMove, "h7-e7");
  assert.equal(report.study.decision.alternatives.length, 2);
  assert.equal(report.study.decision.alternatives[1].verdict, "playable");
  assert.equal(report.study.candidateLines.length, 2);
  assert.equal(report.study.candidateLines[1].move, "h7-e7");
});

test("study position CLI can attach oracle review evidence", async () => {
  const { stdout } = await runStudyCli([
    "--oracle-command", process.execPath,
    "--oracle-arg", "fixtures/mock-ucci.mjs",
    "--oracle-protocol", "ucci",
    "--startup-timeout", "1000",
    "--command-timeout", "1000",
    "--depth", "1",
    "--time", "100",
    "--move", "h7-e7",
    "--json"
  ]);
  const report = JSON.parse(stdout);

  assert.equal(report.backend.kind, "oracle-reviewed");
  assert.equal(report.options.oracleProtocol, "ucci");
  assert.equal(report.study.decision.bestMove, "h7-e7");
  assert.equal(report.study.oracleReview.bestMove, "h9-g7");
  assert.equal(report.study.playedMoveReview.reviewBackend.name, "Study Oracle");
  assert.equal(report.study.playedMoveReview.oracleReview.bestMove, "h9-g7");
});

function runStudyCli(args) {
  return execFileAsync(process.execPath, ["examples/study-position.mjs", ...args], {
    cwd: root,
    timeout: 8000,
    env: {
      ...process.env,
      XIANGQI_ENGINE_COMMAND: "",
      XIANGQI_ENGINE_ARGS: "",
      XIANGQI_ENGINE_OPTIONS: "",
      XIANGQI_ORACLE_ENGINE_COMMAND: "",
      XIANGQI_ORACLE_ENGINE_ARGS: "",
      XIANGQI_ORACLE_ENGINE_OPTIONS: "",
      XIANGQI_STUDY_FEN: "",
      XIANGQI_STUDY_MOVE: ""
    }
  });
}
