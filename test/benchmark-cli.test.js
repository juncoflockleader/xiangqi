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

test("benchmark CLI can load a custom JSON suite", async () => {
  const dir = await mkdtemp(join(tmpdir(), "xiangqi-benchmark-cli-"));
  const suitePath = join(dir, "suite.json");

  try {
    await writeFile(suitePath, JSON.stringify({
      defaults: {
        tags: ["custom"],
        options: {
          depth: 2,
          timeLimitMs: 1000,
          useBook: false
        }
      },
      benchmarks: [
        {
          id: "custom-rook-win",
          fen: "4k4/9/4r4/9/9/9/9/9/9/3KR4 r",
          expectedMove: "e9-e2",
          lesson: "Custom benchmark loaded by the CLI."
        }
      ]
    }, null, 2), "utf8");

    const { stdout } = await execFileAsync(process.execPath, [
      "examples/benchmark.mjs",
      "--benchmarks", suitePath,
      "--json"
    ], {
      cwd: root,
      timeout: 8000
    });
    const report = JSON.parse(stdout);

    assert.equal(report.total, 1);
    assert.equal(report.failed, 0);
    assert.equal(report.results[0].id, "custom-rook-win");
    assert.equal(report.results[0].actualMove, "e9-e2");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
