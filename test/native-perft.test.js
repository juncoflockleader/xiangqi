import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  createInitialPosition,
  generateOpeningSuite,
  parseFen,
  perft,
  toFen
} from "../src/index.js";

const BUILD_SCRIPT = "scripts/build-native.mjs";
let cachedBuild = null;

// Canonical xiangqi perft series from the start position. The native engine and
// the JS reference must both reproduce these exactly, or move generation is wrong.
const STARTPOS_PERFT = [
  { depth: 1, nodes: 44 },
  { depth: 2, nodes: 1920 },
  { depth: 3, nodes: 79666 },
  { depth: 4, nodes: 3290240 }
];

test("native perft matches the canonical startpos series", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const startFen = toFen(createInitialPosition());
  for (const { depth, nodes } of STARTPOS_PERFT) {
    assert.equal(
      runNativePerft(build.output, startFen, depth),
      nodes,
      `native perft depth ${depth} should equal ${nodes}`
    );
  }
});

test("native perft agrees with JS perft across diverse positions", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const fens = [
    toFen(createInitialPosition()),
    // Bare-kings flying-general edge case: only one legal king move.
    "4k4/9/9/9/9/9/9/9/9/3K5 r",
    // Diverse legal midgame-ish positions generated deterministically.
    ...generateOpeningSuite({ count: 5, plies: 8, seed: 20260624, includeStart: false })
  ];

  const depth = 3;
  for (const fen of fens) {
    const expected = perft(parseFen(fen), depth);
    const actual = runNativePerft(build.output, fen, depth);
    assert.equal(actual, expected, `perft mismatch at depth ${depth} for FEN: ${fen}`);
  }
});

function runNativePerft(binary, fen, depth) {
  const input = `position fen ${fen}\nperft ${depth}\nquit\n`;
  const result = spawnSync(binary, [], { input, encoding: "utf8", timeout: 30000 });
  if (result.status !== 0 && result.error) {
    assert.fail(`native engine failed: ${result.error.message}`);
  }
  const line = (result.stdout ?? "")
    .split(/\r?\n/)
    .reverse()
    .find((text) => /^perft \d+$/.test(text.trim()));
  assert.ok(line, `native engine did not emit a perft total for FEN ${fen}\n${result.stdout}`);
  return Number(line.trim().split(/\s+/)[1]);
}

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
