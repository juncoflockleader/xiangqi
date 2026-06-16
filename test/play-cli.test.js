import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { INITIAL_FEN } from "../src/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MOCK_UCCI_PATH = "fixtures/mock-ucci.mjs";

test("play CLI can load an oracle opening artifact as its book", async () => {
  const dir = await mkdtemp(join(tmpdir(), "xiangqi-play-book-"));
  const bookPath = join(dir, "oracle-book.json");

  try {
    await writeFile(bookPath, `${JSON.stringify({
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
    }, null, 2)}\n`, "utf8");

    const result = await runPlayCli([
      "--side", "black",
      "--book", bookPath,
      "--depth", "1",
      "--time", "100"
    ], "quit\n");

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Opening book: .*oracle-book\.json \(json\)/);
    assert.match(result.stdout, /Engine played h9-g7/);
    assert.match(result.stdout, /Fixture Oracle Horse/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("play CLI can load raw game records as an opening book", async () => {
  const dir = await mkdtemp(join(tmpdir(), "xiangqi-play-games-book-"));
  const bookPath = join(dir, "games-book.json");

  try {
    await writeFile(bookPath, `${JSON.stringify({
      source: "Play Fixture Games",
      maxPly: 2,
      games: [
        { moves: ["h9-g7", "h0-g2"], result: "1-0" },
        { moves: "h9-g7 h0-g2", result: "1/2-1/2" },
        { moves: ["h7-e7", "b0-c2"], result: "0-1" }
      ]
    }, null, 2)}\n`, "utf8");

    const result = await runPlayCli([
      "--side", "black",
      "--book", bookPath,
      "--depth", "1",
      "--time", "100"
    ], "quit\n");

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Opening book: .*games-book\.json \(json\)/);
    assert.match(result.stdout, /Engine played h9-g7/);
    assert.match(result.stdout, /Game Database Continuation/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("play CLI can use a native UCI engine backend", async () => {
  const result = await runPlayCli([
    "--side", "black",
    "--engine-command", process.execPath,
    "--engine-arg", MOCK_UCCI_PATH,
    "--engine-protocol", "uci",
    "--startup-timeout", "1000",
    "--command-timeout", "1000",
    "--depth", "2",
    "--time", "100",
    "--no-book"
  ], "quit\n");

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Engine backend: .*hybrid/);
  assert.match(result.stdout, /Native engine: uci /);
  assert.match(result.stdout, /Engine played h9-g7/);
  assert.match(result.stdout, /selected by Native UCI Engine/);
});

test("play CLI best command shows structured engine reasoning", async () => {
  const result = await runPlayCli([
    "--side", "red",
    "--engine-command", process.execPath,
    "--engine-arg", MOCK_UCCI_PATH,
    "--engine-protocol", "uci",
    "--startup-timeout", "1000",
    "--command-timeout", "1000",
    "--depth", "2",
    "--time", "100",
    "--lines", "2",
    "--no-book"
  ], "best\nquit\n");

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Best move: h9-g7/);
  assert.match(result.stdout, /Plan: Start with h9-g7; expect h0-g2; theme: creates threat, answers threat\./);
  assert.match(result.stdout, /1\. Red engine choice h9-g7: \+0\.00 -> \+\d+\.\d\d \(\+\d+ centipawns\) \[creates threat, answers threat\]/);
  assert.match(result.stdout, /2\. Black expected reply h0-g2: \+\d+\.\d\d -> \+0\.00 \(-\d+ centipawns\) \[creates threat, answers threat\]/);
  assert.match(result.stdout, /Confidence: Medium confidence/);
  assert.match(result.stdout, /Comparison: Native MultiPV rates h9-g7 30 centipawns above the next candidate h7-e7\./);
  assert.match(result.stdout, /Alternatives:/);
  assert.match(result.stdout, /1\. h9-g7: best, \+0\.42, loss 0 cp, expects h0-g2/);
  assert.match(result.stdout, /2\. h7-e7: playable, \+0\.12, loss 30 cp, expects h0-g2/);
  assert.match(result.stdout, /Why not: This native line starts with h7-e7; the top native line starts with h9-g7/);
  assert.match(result.stdout, /Reasons:/);
});

test("play CLI can use the Pikafish native preset", async () => {
  const result = await runPlayCli([
    "--side", "black",
    "--engine-preset", "pikafish",
    "--engine-command", process.execPath,
    "--engine-arg", MOCK_UCCI_PATH,
    "--engine-eval-file", "pikafish.nnue",
    "--engine-option", "MockMateWdl=true",
    "--startup-timeout", "1000",
    "--command-timeout", "1000",
    "--depth", "2",
    "--time", "100",
    "--no-book"
  ], "quit\n");

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Native engine: uci /);
  assert.match(result.stdout, /Engine preset: Pikafish/);
  assert.match(result.stdout, /Engine played h9-g7/);
  assert.match(result.stdout, /reported score of mate in 2/);
});

test("play CLI does not cap native preset defaults with shallow JS depth", async () => {
  const result = await runPlayCli([
    "--side", "black",
    "--engine-preset", "pikafish",
    "--engine-command", process.execPath,
    "--engine-arg", MOCK_UCCI_PATH,
    "--engine-option", "MockDepthFromGo=true",
    "--engine-option", "MockNoDepthDepth64=true",
    "--startup-timeout", "1000",
    "--command-timeout", "1000",
    "--no-book"
  ], "quit\n");

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Native engine: uci /);
  assert.match(result.stdout, /Engine preset: Pikafish/);
  assert.match(result.stdout, /Engine played h9-g7/);
  assert.match(result.stdout, /\(depth 64, 123 nodes\)/);
});

test("play CLI applies named play levels to native engine defaults", async () => {
  const result = await runPlayCli([
    "--side", "black",
    "--level", "beginner",
    "--engine-preset", "pikafish",
    "--engine-command", process.execPath,
    "--engine-arg", MOCK_UCCI_PATH,
    "--engine-option", "MockDepthFromGo=true",
    "--startup-timeout", "1000",
    "--command-timeout", "1000",
    "--no-book"
  ], "quit\n");

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Engine level: Beginner Learner/);
  assert.match(result.stdout, /Engine played h9-g7/);
  assert.match(result.stdout, /\(depth 1, 123 nodes\)/);
});

test("play CLI reports an unresolved native preset command", async () => {
  const result = await runPlayCli([
    "--engine-preset", "pikafish",
    "--depth", "1",
    "--time", "100"
  ], "quit\n", {
    XIANGQI_ENGINE_COMMAND: "",
    XIANGQI_PIKAFISH_AUTO_DISCOVER: "false",
    XIANGQI_PIKAFISH_COMMAND: "",
    XIANGQI_PIKAFISH_HOME: "",
    PIKAFISH_COMMAND: "",
    PIKAFISH_HOME: ""
  });

  assert.equal(result.code, 1);
  assert.match(result.stderr, /--engine-preset pikafish did not resolve a native command/);
});

test("play CLI can show an oracle review for the current engine pick", async () => {
  const result = await runPlayCli([
    "--side", "black",
    "--oracle-command", process.execPath,
    "--oracle-arg", MOCK_UCCI_PATH,
    "--oracle-protocol", "ucci",
    "--oracle-depth", "2",
    "--oracle-time", "100",
    "--startup-timeout", "1000",
    "--command-timeout", "1000",
    "--depth", "1",
    "--time", "100"
  ], "quit\n");

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Engine backend: .*Oracle Review/);
  assert.match(result.stdout, /Oracle reviewer: ucci /);
  assert.match(result.stdout, /Engine played h7-e7/);
  assert.match(result.stdout, /Oracle review: good, 59 cp loss; oracle preferred h9-g7\./);
});

test("play CLI uses the oracle reviewer for player move feedback", async () => {
  const result = await runPlayCli([
    "--side", "red",
    "--oracle-command", process.execPath,
    "--oracle-arg", MOCK_UCCI_PATH,
    "--oracle-protocol", "ucci",
    "--oracle-depth", "2",
    "--oracle-time", "100",
    "--startup-timeout", "1000",
    "--command-timeout", "1000",
    "--depth", "1",
    "--time", "100"
  ], "h7e7\nquit\n");

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /You played h7-e7/);
  assert.match(result.stdout, /Review source: Play Oracle\./);
  assert.match(result.stdout, /Review: good, 59 cp loss\./);
  assert.match(result.stdout, /Score: played -0\.17; best \+0\.42\./);
  assert.match(result.stdout, /Your plan: Start with h7-e7; expect h0-g2; theme: pin, creates threat, answers threat\./);
  assert.match(result.stdout, /Engine preferred h9-g7\./);
  assert.match(result.stdout, /Best plan: Start with h9-g7; expect h0-g2; theme: creates threat, answers threat\./);
  assert.match(result.stdout, /Plan comparison: Your plan starts with h7-e7; the engine prefers h9-g7, a good gap of 59 centipawns\. Both lines expect h0-g2\./);
  assert.match(result.stdout, /1\. Red engine choice h9-g7: \+0\.00 -> \+\d+\.\d\d \(\+\d+ centipawns\) \[creates threat, answers threat\]/);
});

test("play CLI prints practice focus for player move reviews", async () => {
  const result = await runPlayCli([
    "--side", "red",
    "--fen", "4k4/9/4r4/9/9/9/9/9/9/3KR4 r",
    "--depth", "2",
    "--time", "500",
    "--no-book"
  ], "e9f9\nquit\n");

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Initial FEN: 4k4\/9\/4r4\/9\/9\/9\/9\/9\/9\/3KR4 r/);
  assert.match(result.stdout, /You played e9-f9/);
  assert.match(result.stdout, /Review: blunder,/);
  assert.match(result.stdout, /Practice: Material tactics \(candidate-captures\) - Practice scanning forcing captures before choosing a quiet move\./);
});

function runPlayCli(args, input, env = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, ["examples/play-cli.mjs", ...args], {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...env
      }
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`play CLI timed out\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    }, 5000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolvePromise({ code, stdout, stderr });
    });

    child.stdin.end(input);
  });
}
