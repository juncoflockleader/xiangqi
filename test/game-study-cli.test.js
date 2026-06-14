import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("game study CLI prints a readable game learning report", async () => {
  const { stdout } = await runGameStudyCli([
    "--depth", "1",
    "--time", "100",
    "--study-depth", "1",
    "--study-time", "100",
    "--lines", "1",
    "--max-position-studies", "1",
    "--moves", "h7-e7 h0-g2 h9-g7"
  ]);

  assert.match(stdout, /Game study backend: JavaScript Reference Engine \(javascript\)/);
  assert.match(stdout, /Game study: 3 moves/);
  assert.match(stdout, /Lesson cards:/);
  assert.match(stdout, /Position studies:/);
  assert.match(stdout, /Next steps:/);
});

test("game study CLI imports western Xiangqi notation", async () => {
  const { stdout } = await runGameStudyCli([
    "--depth", "1",
    "--time", "100",
    "--max-position-studies", "0",
    "--moves", "1.C2=5 n8+7 2.N2+3 p7+1",
    "--json"
  ]);
  const report = JSON.parse(stdout);

  assert.deepEqual(report.options.moves, ["h7-e7", "h0-g2", "h9-g7", "g3-g4"]);
  assert.equal(report.study.summary.totalMoves, 4);
});

test("game study CLI emits JSON from a move file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "xiangqi-game-study-"));
  const file = join(dir, "game.json");

  try {
    await writeFile(file, JSON.stringify({
      event: "CLI Fixture",
      metadata: {
        source: "unit-test"
      },
      moves: ["h7-e7", "h0-g2"]
    }), "utf8");
    const { stdout } = await runGameStudyCli([
      "--file", file,
      "--depth", "1",
      "--time", "100",
      "--max-position-studies", "0",
      "--json"
    ]);
    const report = JSON.parse(stdout);

    assert.equal(report.ok, true);
    assert.equal(report.options.moveCount, 2);
    assert.deepEqual(report.options.moves, ["h7-e7", "h0-g2"]);
    assert.equal(report.import.metadata.event, "CLI Fixture");
    assert.equal(report.import.metadata.source, "unit-test");
    assert.equal(report.import.tokens[0].token, "h7-e7");
    assert.equal(report.import.tokens[0].notation, "h7-e7");
    assert.equal(report.study.type, "game-study");
    assert.equal(report.study.summary.totalMoves, 2);
    assert.equal(report.study.positionStudies.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("game study CLI can use a native UCI backend", async () => {
  const { stdout } = await runGameStudyCli([
    "--engine-command", process.execPath,
    "--engine-arg", "fixtures/mock-ucci.mjs",
    "--engine-protocol", "uci",
    "--startup-timeout", "1000",
    "--command-timeout", "1000",
    "--depth", "2",
    "--time", "100",
    "--max-position-studies", "0",
    "--no-book",
    "--moves", "h7-e7",
    "--json"
  ]);
  const report = JSON.parse(stdout);

  assert.equal(report.backend.kind, "hybrid");
  assert.equal(report.backend.status.primaryBackend.kind, "native-uci");
  assert.equal(report.options.useBook, false);
  assert.equal(report.study.review.moves[0].review.source, "native-uci");
  assert.equal(report.study.lessonPlan.cards[0].bestMove, "h9-g7");
});

test("game study CLI can use the Pikafish engine preset", async () => {
  const { stdout } = await runGameStudyCli([
    "--engine-preset", "pikafish",
    "--engine-command", process.execPath,
    "--engine-arg", "fixtures/mock-ucci.mjs",
    "--engine-eval-file", "pikafish.nnue",
    "--startup-timeout", "1000",
    "--command-timeout", "1000",
    "--depth", "2",
    "--time", "100",
    "--max-position-studies", "0",
    "--no-book",
    "--moves", "h7-e7",
    "--json"
  ]);
  const report = JSON.parse(stdout);

  assert.equal(report.options.enginePreset, "pikafish");
  assert.equal(report.backend.status.primaryBackend.name, "Pikafish");
  assert.equal(report.backend.status.primaryBackend.kind, "native-uci");
  assert.equal(report.backend.nativeOptions[0].name, "UCI_ShowWDL");
  assert.equal(report.backend.nativeOptions[1].name, "EvalFile");
  assert.equal(report.study.review.moves[0].review.source, "native-uci");
  assert.equal(report.study.lessonPlan.cards[0].bestMove, "h9-g7");
});

test("game study CLI explains missing moves", async () => {
  await assert.rejects(
    () => runGameStudyCli(["--json"]),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /requires moves/);
      return true;
    }
  );
});

function runGameStudyCli(args) {
  return execFileAsync(process.execPath, ["examples/game-study.mjs", ...args], {
    cwd: root,
    timeout: 10000,
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
      XIANGQI_PIKAFISH_AUTO_DISCOVER: "false",
      XIANGQI_GAME_STUDY_MOVES: "",
      XIANGQI_GAME_STUDY_FILE: ""
    }
  });
}
