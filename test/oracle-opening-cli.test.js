import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("oracle opening CLI prints importable records", async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    "examples/oracle-opening.mjs",
    "--command", process.execPath,
    "--arg", "fixtures/mock-ucci.mjs",
    "--protocol", "uci",
    "--plies", "2",
    "--lines", "2",
    "--depth", "2",
    "--time", "100",
    "--source", "Mock Oracle",
    "--records-only"
  ], {
    cwd: root,
    timeout: 5000
  });
  const records = JSON.parse(stdout);

  assert.ok(Array.isArray(records));
  assert.ok(records.length >= 3);
  assert.equal(records[0].move, "h9-g7");
  assert.equal(records[0].weight, 100);
  assert.equal(records[0].source, "Mock Oracle");
  assert.equal(records[0].rank, 1);
  assert.ok(records[0].tags.includes("oracle"));
  assert.ok(records.some((record) => record.rank === 2));
});

test("oracle opening CLI writes reusable artifact files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "xiangqi-oracle-book-"));
  const outFile = join(dir, "book.json");

  try {
    const { stdout } = await execFileAsync(process.execPath, [
      "examples/oracle-opening.mjs",
      "--command", process.execPath,
      "--arg", "fixtures/mock-ucci.mjs",
      "--protocol", "uci",
      "--plies", "2",
      "--lines", "2",
      "--depth", "2",
      "--time", "100",
      "--source", "Mock Oracle",
      "--out", outFile
    ], {
      cwd: root,
      timeout: 5000
    });
    const artifact = JSON.parse(await readFile(outFile, "utf8"));

    assert.match(stdout, /Oracle opening:/);
    assert.equal(artifact.schema, "xiangqi.oracle-opening-book");
    assert.equal(artifact.version, 1);
    assert.equal(artifact.source, "Mock Oracle");
    assert.equal(artifact.parameters.protocol, "uci");
    assert.equal(artifact.parameters.depth, 2);
    assert.equal(artifact.candidateLines, 2);
    assert.ok(Array.isArray(artifact.records));
    assert.ok(artifact.records.length >= 3);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("oracle opening CLI explains missing native command", async () => {
  await assert.rejects(
    () => execFileAsync(process.execPath, [
      "examples/oracle-opening.mjs",
      "--json"
    ], {
      cwd: root,
      timeout: 5000,
      env: {
        ...process.env,
        XIANGQI_ENGINE_COMMAND: "",
        XIANGQI_ORACLE_ENGINE_COMMAND: ""
      }
    }),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /requires --command/);
      return true;
    }
  );
});
