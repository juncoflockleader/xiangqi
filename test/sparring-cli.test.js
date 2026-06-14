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
