import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("sparring CLI can run with a referee review pass", async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    "examples/sparring.mjs",
    "--plies", "1",
    "--depth", "1",
    "--time", "100",
    "--no-book",
    "--referee",
    "--referee-depth", "1",
    "--referee-time", "100"
  ], {
    cwd: root,
    timeout: 5000
  });

  assert.ok(stdout.includes("Sparring: Red JS (Red) vs Black JS (Black)"));
  assert.ok(stdout.includes("Referee: Referee JS"));
  assert.ok(stdout.includes("Final FEN:"));
});

test("sparring CLI forwards native engine options to players and referee", async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    "examples/sparring.mjs",
    "--plies", "1",
    "--depth", "1",
    "--time", "100",
    "--no-book",
    "--protocol", "ucci",
    "--referee-protocol", "ucci",
    "--referee-depth", "1",
    "--referee-time", "100",
    "--native-option", "Threads=2",
    "--red-option", "Hash=64",
    "--referee-option", "Hash=128"
  ], {
    cwd: root,
    timeout: 5000,
    env: {
      ...process.env,
      XIANGQI_RED_ENGINE_COMMAND: process.execPath,
      XIANGQI_RED_ENGINE_ARGS: "fixtures/mock-ucci.mjs",
      XIANGQI_REFEREE_ENGINE_COMMAND: process.execPath,
      XIANGQI_REFEREE_ENGINE_ARGS: "fixtures/mock-ucci.mjs"
    }
  });

  assert.ok(stdout.includes("Sparring: Red Native (Red) vs Black JS (Black)"));
  assert.ok(stdout.includes("Native options: Red Threads=2, Hash=64"));
  assert.ok(stdout.includes("Referee: Referee Native"));
  assert.ok(stdout.includes("Referee options: Threads=2, Hash=128"));
});

test("sparring CLI supports asymmetric native opponent settings", async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    "examples/sparring.mjs",
    "--plies", "2",
    "--depth", "1",
    "--time", "100",
    "--no-book",
    "--black-protocol", "uci",
    "--black-depth", "4",
    "--black-time", "200",
    "--black-option", "MockDepthFromGo=true"
  ], {
    cwd: root,
    timeout: 5000,
    env: {
      ...process.env,
      XIANGQI_BLACK_ENGINE_COMMAND: process.execPath,
      XIANGQI_BLACK_ENGINE_ARGS: "fixtures/mock-ucci.mjs"
    }
  });

  assert.ok(stdout.includes("Sparring: Red JS (Red) vs Black Native (Black)"));
  assert.ok(stdout.includes("1. Red"));
  assert.ok(stdout.includes("(Red JS, d1, search)"));
  assert.ok(stdout.includes("2. Black"));
  assert.ok(stdout.includes("(Black Native, d4, native-uci)"));
  assert.ok(stdout.includes("Native options: Black MockDepthFromGo=true"));
});

test("sparring CLI prints native candidate comparisons when lines are requested", async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    "examples/sparring.mjs",
    "--plies", "1",
    "--depth", "1",
    "--time", "100",
    "--lines", "2",
    "--no-book",
    "--red-protocol", "uci"
  ], {
    cwd: root,
    timeout: 5000,
    env: {
      ...process.env,
      XIANGQI_RED_ENGINE_COMMAND: process.execPath,
      XIANGQI_RED_ENGINE_ARGS: "fixtures/mock-ucci.mjs"
    }
  });

  assert.ok(stdout.includes("Compare: Native MultiPV rates h9-g7 30 centipawns above the next candidate h7-e7."));
  assert.ok(stdout.includes("Alt 2: h7-e7: playable, +0.12"));
});

test("sparring CLI applies Pikafish preset to a native player", async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    "examples/sparring.mjs",
    "--plies", "1",
    "--depth", "1",
    "--time", "100",
    "--no-book",
    "--red-preset", "pikafish",
    "--red-eval-file", "pikafish.nnue",
    "--red-option", "MockMateWdl=true"
  ], {
    cwd: root,
    timeout: 5000,
    env: {
      ...process.env,
      XIANGQI_RED_ENGINE_COMMAND: process.execPath,
      XIANGQI_RED_ENGINE_ARGS: "fixtures/mock-ucci.mjs"
    }
  });

  assert.ok(stdout.includes("Sparring: Red Native (Red) vs Black JS (Black)"));
  assert.ok(stdout.includes("(Red Native, d2, native-uci)"));
  assert.ok(stdout.includes("Native options: Red UCI_ShowWDL=true, EvalFile=pikafish.nnue, MockMateWdl=true"));
});

test("sparring generic preset does not create an implicit referee", async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    "examples/sparring.mjs",
    "--plies", "1",
    "--depth", "1",
    "--time", "100",
    "--no-book",
    "--preset", "pikafish",
    "--native-command", process.execPath,
    "--native-option", "MockMateWdl=true"
  ], {
    cwd: root,
    timeout: 5000,
    env: {
      ...process.env,
      XIANGQI_ENGINE_ARGS: "fixtures/mock-ucci.mjs"
    }
  });

  assert.ok(stdout.includes("Sparring: Red Native (Red) vs Black Native (Black)"));
  assert.ok(!stdout.includes("Referee:"));
});

test("sparring CLI reports an unresolved native preset command", async () => {
  await assert.rejects(
    () => execFileAsync(process.execPath, [
      "examples/sparring.mjs",
      "--plies", "1",
      "--red-preset", "pikafish"
    ], {
      cwd: root,
      timeout: 5000,
      env: {
        ...process.env,
        XIANGQI_ENGINE_COMMAND: "",
        XIANGQI_RED_ENGINE_COMMAND: "",
        XIANGQI_PIKAFISH_AUTO_DISCOVER: "false",
        XIANGQI_PIKAFISH_COMMAND: "",
        XIANGQI_PIKAFISH_HOME: "",
        PIKAFISH_COMMAND: "",
        PIKAFISH_HOME: ""
      }
    }),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /--red-preset pikafish did not resolve a native command/);
      return true;
    }
  );
});
