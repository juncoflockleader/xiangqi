import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  createInitialPosition,
  createUcciEngineBackend,
  moveToNotation,
  parseFen,
  runBenchmarkSuite,
  sameMove
} from "../src/index.js";

const BUILD_SCRIPT = "scripts/build-native.mjs";
let cachedBuild = null;

test("local C++ engine builds and searches through the native UCI backend", async (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const backend = createUcciEngineBackend({
    command: build.output,
    protocol: "uci",
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 3000
  });

  try {
    const position = createInitialPosition();
    const result = await backend.chooseMove(position, {
      useBook: false,
      lines: 2
    });
    const legalMoves = backend.legalMoves(position);

    assert.equal(result.source, "native-uci");
    assert.equal(result.depth, 2);
    assert.ok(result.nodes > 0);
    assert.ok(result.nps > 0);
    assert.equal(typeof result.hashfull, "number");
    assert.ok(result.raw.some((line) => /\bhashfull\b/.test(line)));
    assert.ok(legalMoves.some((move) => sameMove(move, result.bestMove)));
    assert.ok(result.candidates.length >= 2);
    assert.equal(result.candidates[0].move.notation, result.bestMove.notation);
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("UCI search")));
  } finally {
    await backend.close();
  }
});

test("local C++ engine finds the central rook capture tactic", async (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const backend = createUcciEngineBackend({
    command: build.output,
    protocol: "uci",
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 3000
  });

  try {
    const position = parseFen("4k4/9/4r4/9/9/9/9/9/9/3KR4 r");
    const result = await backend.chooseMove(position, {
      useBook: false,
      lines: 2
    });

    assert.equal(moveToNotation(result.bestMove), "e9-e2");
    assert.ok(result.score > 500);
    assert.ok(result.candidates[0].score > result.candidates[1].score);
  } finally {
    await backend.close();
  }
});

test("local C++ hybrid backend solves the starter benchmark suite", async (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const backend = createUcciEngineBackend({
    command: build.output,
    protocol: "uci",
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 3000
  });

  try {
    const report = await runBenchmarkSuite(backend, {
      searchOptions: {
        depth: 2,
        timeLimitMs: 500,
        lines: 2
      }
    });

    assert.equal(report.failed, 0);
    assert.equal(report.solved, report.total);
    assert.ok(report.aggregate.nodes > 0);
    assert.ok(report.aggregate.nodesPerSecond > 0);
  } finally {
    await backend.close();
  }
});

function buildNativeEngine() {
  if (cachedBuild) return cachedBuild;

  const result = spawnSync(process.execPath, [BUILD_SCRIPT, "--json"], {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  if (result.error?.code === "ENOENT") {
    cachedBuild = { skip: "No Node runtime available to build the native engine." };
    return cachedBuild;
  }
  if (result.status !== 0) {
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    if (/not found|no such file|unable to execute/i.test(output)) {
      cachedBuild = { skip: `No C++ compiler available: ${output.trim()}` };
      return cachedBuild;
    }
    assert.fail(`Native build failed:\n${output}`);
  }

  cachedBuild = JSON.parse(result.stdout);
  return cachedBuild;
}
