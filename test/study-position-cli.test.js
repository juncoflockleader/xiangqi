import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { INITIAL_FEN } from "../src/index.js";

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

test("study position CLI can load an oracle opening artifact", async () => {
  const dir = await mkdtemp(join(tmpdir(), "xiangqi-study-book-"));
  const bookPath = join(dir, "oracle-book.json");

  try {
    await writeFile(bookPath, `${JSON.stringify(oracleBookFixture(), null, 2)}\n`, "utf8");
    const { stdout } = await runStudyCli([
      "--book", bookPath,
      "--depth", "1",
      "--time", "100",
      "--json"
    ]);
    const report = JSON.parse(stdout);

    assert.equal(report.options.bookPath, bookPath);
    assert.equal(report.options.bookFormat, "json");
    assert.equal(report.study.bestMove, "h9-g7");
    assert.equal(report.study.decision.source, "opening-book");
    assert.match(report.study.decision.summary, /Fixture Oracle Horse/);
    assert.equal(report.study.openingCandidates[0].move, "h9-g7");
    assert.equal(report.study.openingCandidates[0].name, "Fixture Oracle Horse");
    assert.equal(report.study.searchDisagreement.openingMove, "h9-g7");
    assert.equal(report.study.searchDisagreement.searchMove, "b7-b0");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("study position CLI can use the Pikafish engine preset", async () => {
  const { stdout } = await runStudyCli([
    "--engine-preset", "pikafish",
    "--engine-command", process.execPath,
    "--engine-arg", "fixtures/mock-ucci.mjs",
    "--engine-eval-file", "pikafish.nnue",
    "--startup-timeout", "1000",
    "--command-timeout", "1000",
    "--depth", "2",
    "--time", "100",
    "--lines", "2",
    "--no-book",
    "--json"
  ]);
  const report = JSON.parse(stdout);

  assert.equal(report.options.enginePreset, "pikafish");
  assert.equal(report.backend.status.primaryBackend.name, "Pikafish");
  assert.equal(report.backend.status.primaryBackend.kind, "native-uci");
  assert.equal(report.backend.nativeOptions[0].name, "UCI_ShowWDL");
  assert.equal(report.backend.nativeOptions[1].name, "EvalFile");
  assert.equal(report.study.decision.source, "native-uci");
  assert.equal(report.study.bestMove, "h9-g7");
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

test("study position CLI can attach oracle preset evidence", async () => {
  const { stdout } = await runStudyCli([
    "--oracle-preset", "pikafish",
    "--oracle-command", process.execPath,
    "--oracle-arg", "fixtures/mock-ucci.mjs",
    "--oracle-eval-file", "pikafish.nnue",
    "--startup-timeout", "1000",
    "--command-timeout", "1000",
    "--depth", "1",
    "--time", "100",
    "--move", "h7-e7",
    "--json"
  ]);
  const report = JSON.parse(stdout);

  assert.equal(report.options.oraclePreset, "pikafish");
  assert.equal(report.backend.kind, "oracle-reviewed");
  assert.equal(report.study.oracleReview.backend.name, "Pikafish");
  assert.equal(report.study.playedMoveReview.reviewBackend.name, "Pikafish");
  assert.equal(report.study.playedMoveReview.oracleReview.bestMove, "h9-g7");
});

test("study position CLI reports an unresolved oracle preset", async () => {
  await assert.rejects(
    () => runStudyCli([
      "--oracle-preset", "pikafish",
      "--json"
    ]),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /--oracle-preset pikafish did not resolve a native command/);
      return true;
    }
  );
});

function runStudyCli(args) {
  return execFileAsync(process.execPath, ["examples/study-position.mjs", ...args], {
    cwd: root,
    timeout: 8000,
    env: {
      ...process.env,
      XIANGQI_ENGINE_COMMAND: "",
      XIANGQI_ENGINE_ARGS: "",
      XIANGQI_ENGINE_PRESET: "",
      XIANGQI_ENGINE_EVAL_FILE: "",
      XIANGQI_ENGINE_OPTIONS: "",
      XIANGQI_ORACLE_ENGINE_COMMAND: "",
      XIANGQI_ORACLE_ENGINE_ARGS: "",
      XIANGQI_ORACLE_ENGINE_PRESET: "",
      XIANGQI_ORACLE_ENGINE_EVAL_FILE: "",
      XIANGQI_ORACLE_ENGINE_OPTIONS: "",
      XIANGQI_OPENING_BOOK: "",
      XIANGQI_OPENING_BOOK_FORMAT: "",
      XIANGQI_PIKAFISH_AUTO_DISCOVER: "false",
      XIANGQI_STUDY_FEN: "",
      XIANGQI_STUDY_MOVE: ""
    }
  });
}

function oracleBookFixture() {
  return {
    schema: "xiangqi.oracle-opening-book",
    version: 1,
    source: "CLI Oracle Fixture",
    generatedAt: "2026-06-14T00:00:00.000Z",
    initialFen: INITIAL_FEN,
    records: [
      {
        fen: INITIAL_FEN,
        move: "h9-g7",
        weight: 150,
        name: "Fixture Oracle Horse",
        idea: "Use a generated oracle book to develop the horse first.",
        tags: ["oracle", "fixture"],
        source: "CLI Oracle Fixture",
        side: "red",
        ply: 1,
        rank: 1,
        engineScore: 42,
        centipawnLoss: 0,
        depth: 2,
        principalVariation: "h9-g7"
      }
    ]
  };
}
