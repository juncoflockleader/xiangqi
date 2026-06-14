import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { INITIAL_FEN } from "../src/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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

function runPlayCli(args, input) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, ["examples/play-cli.mjs", ...args], {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"]
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
