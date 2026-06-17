import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
    startupTimeoutMs: 5000,
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
    assert.equal(build.portable, false);
    assert.ok(build.flags.includes("-march=native"));
    assert.equal(build.flags.includes("-flto"), build.lto);
    assert.equal(result.depth, 2);
    assert.ok(result.nodes > 0);
    assert.ok(result.nps > 0);
    assert.equal(typeof result.hashfull, "number");
    assert.ok(result.raw.some((line) => /\bhashfull\b/.test(line)));
    assert.ok(result.raw.some((line) => /\bhistory\b/.test(line)));
    assert.ok(result.raw.some((line) => /\bnmp\b/.test(line) && /\bnmv\b/.test(line) && /\bnmvfail\b/.test(line) && /\bnmrboost\b/.test(line) && /\bnmmguard\b/.test(line) && /\brfp\b/.test(line) && /\bmdp\b/.test(line) && /\brazor\b/.test(line) && /\bsee\b/.test(line) && /\blacache\b/.test(line) && /\blastores\b/.test(line) && /\bpcut\b/.test(line) && /\bpcsearch\b/.test(line) && /\bpcskip\b/.test(line) && /\bfutil\b/.test(line) && /\bhprune\b/.test(line) && /\bhpguard\b/.test(line) && /\bdelta\b/.test(line) && /\bqdskip\b/.test(line) && /\bqsee\b/.test(line) && /\blmp\b/.test(line) && /\blmp3\b/.test(line) && /\blmr\b/.test(line) && /\bredply\b/.test(line) && /\bdeepred\b/.test(line) && /\bpvguard\b/.test(line) && /\bcutboost\b/.test(line) && /\bimp\b/.test(line) && /\bnimp\b/.test(line) && /\bimprd\b/.test(line) && /\bnimprd\b/.test(line) && /\bimplmp\b/.test(line) && /\bnimlmp\b/.test(line) && /\bttmove\b/.test(line) && /\bcaphist\b/.test(line) && /\bcaphstores\b/.test(line) && /\bcaphm\b/.test(line) && /\bcaphguard\b/.test(line) && /\bcm\b/.test(line) && /\bch\b/.test(line) && /\bchred\b/.test(line) && /\bchredm\b/.test(line) && /\bce\b/.test(line) && /\bcecap\b/.test(line) && /\bceblock\b/.test(line) && /\bceking\b/.test(line) && /\bcheckhist\b/.test(line) && /\bcheckhstores\b/.test(line) && /\bcheckhm\b/.test(line) && /\bcheckcache\b/.test(line) && /\biid\b/.test(line) && /\biidhit\b/.test(line) && /\brootmoves\b/.test(line) && /\brootstate\b/.test(line) && /\brootred\b/.test(line) && /\brootredply\b/.test(line) && /\broottt\b/.test(line) && /\brootttstores\b/.test(line) && /\bsingtry\b/.test(line) && /\bsingext\b/.test(line) && /\bsingrej\b/.test(line) && /\bpvs\b/.test(line) && /\basp\b/.test(line) && /\baspwide\b/.test(line) && /\btguard\b/.test(line)));
    assert.ok(result.raw.some((line) => /\bcrisk \d+\/\d+\b/.test(line)));
    assert.ok(result.raw.some((line) => /\bext\b/.test(line) && /\brecext\b/.test(line) && /\bpawnext\b/.test(line) && /\bpawnord\b/.test(line) && /\brecorder\b/.test(line) && /\bqnodes\b/.test(line) && /\bqchecks\b/.test(line) && /\bqcheckhist\b/.test(line) && /\bqcheckhstores\b/.test(line) && /\bqcheckhm\b/.test(line) && /\bqcapguard\b/.test(line) && /\bqcaphist\b/.test(line) && /\bqcapstores\b/.test(line) && /\bqcaphm\b/.test(line)));
    assert.ok(result.raw.some((line) => /\bqtt\b/.test(line) && /\bqttstores\b/.test(line) && /\beval\b/.test(line) && /\bevalskip\b/.test(line) && /\brep\b/.test(line)));
    assert.ok(legalMoves.some((move) => sameMove(move, result.bestMove)));
    assert.ok(result.candidates.length >= 2);
    assert.equal(result.candidates[0].move.notation, result.bestMove.notation);
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("UCI search")));
  } finally {
    await backend.close();
  }
});

test("local C++ build script can emit a portable release binary", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const output = join(tmpdir(), `xiangqi-native-portable-${process.pid}`);
  const result = spawnSync(process.execPath, [
    BUILD_SCRIPT,
    "--json",
    "--portable",
    "--out",
    output
  ], {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  const portableBuild = JSON.parse(result.stdout);
  assert.equal(portableBuild.portable, true);
  assert.ok(!portableBuild.flags.includes("-march=native"));
  assert.equal(portableBuild.flags.includes("-flto"), portableBuild.lto);
});

test("local C++ build script can disable release LTO", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const output = join(tmpdir(), `xiangqi-native-no-lto-${process.pid}`);
  const result = spawnSync(process.execPath, [
    BUILD_SCRIPT,
    "--json",
    "--no-lto",
    "--out",
    output
  ], {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  const noLtoBuild = JSON.parse(result.stdout);
  assert.equal(noLtoBuild.lto, false);
  assert.equal(noLtoBuild.ltoFallback, false);
  assert.ok(!noLtoBuild.flags.includes("-flto"));
});

test("local C++ engine advertises the stronger default hash size", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const result = spawnSync(build.output, {
    input: "uci\nquit\n",
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /option name Hash type spin default 64 min 1 max 1024/);
  assert.match(result.stdout, /option name Clear Hash type button/);
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

test("local C++ engine keeps exposed-general forcing rook moves ahead of king moves", async (t) => {
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
    const position = parseFen("4k4/9/9/9/9/9/9/9/9/3KR4 r");
    const result = await backend.chooseMove(position, {
      useBook: false,
      lines: 2
    });
    const forcingRookMoves = new Set([
      "e9-e8",
      "e9-e7",
      "e9-e6",
      "e9-e5",
      "e9-e4",
      "e9-e3",
      "e9-e2",
      "e9-e1"
    ]);

    assert.ok(forcingRookMoves.has(moveToNotation(result.bestMove)), result.raw.join("\n"));
    assert.ok(result.score > 900);
  } finally {
    await backend.close();
  }
});

test("local C++ engine scores projected repeated positions as draw-assumed", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position startpos moves b0c2 b9c7 c2b0 c7b9 b0c2 b9c7 c2b0 c7b9",
    "go depth 1 searchmoves b0c2",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8",
    timeout: 3000
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\bscore cp 0\b/);
  assert.match(result.stdout, /\brep [1-9]\d*\b/);
  assert.match(result.stdout, /\bbestmove b0c2\b/);
});

test("local C++ engine preserves repetition guards after long replayed histories", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const cycle = ["b0c2", "b9c7", "c2b0", "c7b9"];
  const history = Array.from({ length: 12 }, () => cycle).flat().join(" ");
  const input = [
    "uci",
    `position startpos moves ${history}`,
    "go depth 3 searchmoves b0c2",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8",
    timeout: 3000
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\bscore cp 0\b/);
  assert.match(result.stdout, /\brep [1-9]\d*\b/);
  assert.match(result.stdout, /\bbestmove b0c2\b/);
});

test("local C++ engine lets movetime-only protocol searches iterate beyond the shallow default", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position fen 4k4/9/9/9/9/9/9/9/9/3KR4 r",
    "go movetime 80",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8",
    timeout: 3000
  });

  assert.equal(result.status, 0, result.stderr);
  const depth = Number(result.stdout.match(/\bdepth\s+(\d+)/)?.[1] ?? 0);
  assert.ok(depth > 4, result.stdout);
  assert.match(result.stdout, /\bbestmove\b/);
});

test("local C++ depth-only protocol searches reach the requested depth", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position startpos",
    "go depth 7",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\bdepth 7\b/);
  assert.match(result.stdout, /\bbestmove\b/);
});

test("local C++ engine reuses search ordering memory across go commands", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position startpos",
    "go depth 3",
    "position startpos",
    "go depth 3",
    "ucinewgame",
    "position startpos",
    "go depth 3",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  const ages = [...result.stdout.matchAll(/\bmemage\s+(\d+)/g)].map((match) => Number(match[1]));
  assert.deepEqual(ages, [1, 2, 1]);
  const rootOrderHits = [...result.stdout.matchAll(/\brootord\s+(\d+)/g)].map((match) => Number(match[1]));
  assert.equal(rootOrderHits.length, 3, result.stdout);
  assert.equal(rootOrderHits[0], 0);
  assert.ok(rootOrderHits[1] > 0, result.stdout);
  assert.equal(rootOrderHits[2], 0);
});

test("local C++ Clear Hash option resets persistent search memory", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position startpos",
    "go depth 3",
    "position startpos",
    "go depth 3",
    "setoption name Clear Hash",
    "position startpos",
    "go depth 3",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  const ages = [...result.stdout.matchAll(/\bmemage\s+(\d+)/g)].map((match) => Number(match[1]));
  assert.deepEqual(ages, [1, 2, 1]);
  const rootOrderHits = [...result.stdout.matchAll(/\brootord\s+(\d+)/g)].map((match) => Number(match[1]));
  assert.equal(rootOrderHits.length, 3, result.stdout);
  assert.equal(rootOrderHits[0], 0);
  assert.ok(rootOrderHits[1] > 0, result.stdout);
  assert.equal(rootOrderHits[2], 0);
});

test("local C++ timed opening priors guide pure native central cannon branches", async (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const backend = createUcciEngineBackend({
    command: build.output,
    protocol: "uci",
    depth: 4,
    timeLimitMs: 200,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 3000
  });

  try {
    const huTrap = parseFen("rheakaer1/9/1c4hc1/p1p1p3p/6p2/9/P1P1P1P1P/1CH1C1H2/9/R1EAKAE1R r");
    const centralCannon = parseFen("rheakae1r/9/1c4hc1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1H2/9/RHEAKAE1R b");
    const pawnChallenge = parseFen("rheakae1r/9/1c4hc1/p3p1p1p/2p6/9/P1P1P1P1P/1C2C1H2/9/RHEAKAE1R r");
    const pawnChallengeDoubleHorse = parseFen("r1eakae1r/9/1ch3hc1/p3p1p1p/2p6/9/P1P1P1P1P/HC2C1H2/9/R1EAKAE1R r");
    const shiftedCannons = parseFen("rheakae1r/9/1c4hc1/p1p1p1p1p/9/9/P1P1P1P1P/3CC4/9/RHEAKAEHR b");
    const shiftedCannonsDoubleHorse = parseFen("r1eakae1r/9/1ch3hc1/p1p1p1p1p/9/9/P1P1P1P1P/2HCC4/9/R1EAKAEHR b");
    const doubleHorseRedRook = parseFen("rheakae1r/9/1c4hc1/p1p1p3p/6p2/9/P1P1P1P1P/1C2C1H2/9/RHEAKAER1 b");
    const doubleHorseBothRooks = parseFen("rheakaer1/9/1c4hc1/p1p1p3p/6p2/9/P1P1P1P1P/1C2C1H2/9/RHEAKAER1 r");
    const doubleHorseRookPressure = parseFen("rheakaer1/9/1c4hc1/p1p1p3p/6p2/7R1/P1P1P1P1P/1C2C1H2/9/RHEAKAE2 b");
    const leftScreen = parseFen("r1eakaehr/9/1ch4c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RHEAKAEHR r");

    const huResult = await backend.chooseMove(huTrap, {
      useBook: false,
      depth: 4,
      timeLimitMs: 200
    });
    const centralResult = await backend.chooseMove(centralCannon, {
      useBook: false,
      depth: 4,
      timeLimitMs: 200,
      lines: 5
    });
    const pawnChallengeResult = await backend.chooseMove(pawnChallenge, {
      useBook: false,
      depth: 4,
      timeLimitMs: 200,
      lines: 5
    });
    const pawnChallengeDoubleHorseResult = await backend.chooseMove(pawnChallengeDoubleHorse, {
      useBook: false,
      depth: 4,
      timeLimitMs: 200,
      lines: 5
    });
    const shiftedResult = await backend.chooseMove(shiftedCannons, {
      useBook: false,
      depth: 4,
      timeLimitMs: 200
    });
    const shiftedDoubleHorseResult = await backend.chooseMove(shiftedCannonsDoubleHorse, {
      useBook: false,
      depth: 4,
      timeLimitMs: 200,
      lines: 5
    });
    const doubleHorseRedRookResult = await backend.chooseMove(doubleHorseRedRook, {
      useBook: false,
      depth: 4,
      timeLimitMs: 200,
      lines: 5
    });
    const doubleHorseBothRooksResult = await backend.chooseMove(doubleHorseBothRooks, {
      useBook: false,
      depth: 4,
      timeLimitMs: 200,
      lines: 5
    });
    const doubleHorseRookPressureResult = await backend.chooseMove(doubleHorseRookPressure, {
      useBook: false,
      depth: 4,
      timeLimitMs: 200,
      lines: 5
    });
    const leftScreenResult = await backend.chooseMove(leftScreen, {
      useBook: false,
      depth: 4,
      timeLimitMs: 200,
      lines: 5
    });

    assert.equal(moveToNotation(huResult.bestMove), "i9-h9");
    assert.equal(moveToNotation(centralResult.bestMove), "g3-g4");
    assert.equal(moveToNotation(pawnChallengeResult.bestMove), "b9-a7");
    assert.equal(moveToNotation(pawnChallengeDoubleHorseResult.bestMove), "i9-h9");
    assert.equal(moveToNotation(shiftedResult.bestMove), "b0-c2");
    assert.equal(moveToNotation(shiftedDoubleHorseResult.bestMove), "a0-b0");
    assert.equal(moveToNotation(doubleHorseRedRookResult.bestMove), "i0-h0");
    assert.equal(moveToNotation(doubleHorseBothRooksResult.bestMove), "h9-h5");
    assert.equal(moveToNotation(doubleHorseRookPressureResult.bestMove), "h2-i2");
    assert.equal(moveToNotation(leftScreenResult.bestMove), "h9-g7");
    assert.ok(huResult.nodes > 0);
    assert.ok(centralResult.nodes > 0);
    assert.ok(pawnChallengeResult.nodes > 0);
    assert.ok(pawnChallengeDoubleHorseResult.nodes > 0);
    assert.ok(shiftedResult.nodes > 0);
    assert.ok(shiftedDoubleHorseResult.nodes > 0);
    assert.ok(doubleHorseRedRookResult.nodes > 0);
    assert.ok(doubleHorseBothRooksResult.nodes > 0);
    assert.ok(doubleHorseRookPressureResult.nodes > 0);
    assert.ok(leftScreenResult.nodes > 0);
  } finally {
    await backend.close();
  }
});

test("local C++ engine keeps the Pikafish central-cannon double-horse timed choice", async (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const backend = createUcciEngineBackend({
    command: build.output,
    protocol: "uci",
    depth: 8,
    timeLimitMs: 1000,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 3000
  });

  try {
    const position = parseFen("rheakae1r/9/1c4hc1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1H2/9/RHEAKAE1R b");
    const result = await backend.chooseMove(position, {
      useBook: false,
      depth: 8,
      timeLimitMs: 1000,
      lines: 5
    });

    assert.equal(moveToNotation(result.bestMove), "g3-g4");
    assert.ok(result.nodes > 0);
  } finally {
    await backend.close();
  }
});

test("local C++ engine preserves mate-range TT scores across repeated searches", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position fen 4k4/4R4/9/9/9/9/9/9/9/4K4 r",
    "go depth 3",
    "go depth 4",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /score cp 99997/);
  assert.equal(result.stdout.match(/bestmove e8e5/g)?.length, 2);
  assert.match(result.stdout, /\btt [1-9]\d*\/\d+\b/);
});

test("local C++ engine reuses root TT best moves across repeated searches", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position startpos",
    "go depth 2",
    "position startpos",
    "go depth 3",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  const rootTtHits = [...result.stdout.matchAll(/\broottt\s+(\d+)/g)].map((match) => Number(match[1]));
  const rootTtStores = [...result.stdout.matchAll(/\brootttstores\s+(\d+)/g)].map((match) => Number(match[1]));

  assert.ok(rootTtHits.length >= 2, result.stdout);
  assert.equal(rootTtHits[0], 0, result.stdout);
  assert.ok(rootTtHits.at(-1) >= 1, result.stdout);
  assert.ok(rootTtStores.every((stores) => stores >= 1), result.stdout);
  assert.match(result.stdout, /\bbestmove b0c2\b/);
});

test("local C++ searchmoves probes do not seed root TT best moves", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position startpos",
    "go depth 2 searchmoves h2e2",
    "position startpos",
    "go depth 2",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  const rootTtHits = [...result.stdout.matchAll(/\broottt\s+(\d+)/g)].map((match) => Number(match[1]));
  const rootTtStores = [...result.stdout.matchAll(/\brootttstores\s+(\d+)/g)].map((match) => Number(match[1]));

  assert.deepEqual(rootTtHits, [0, 0], result.stdout);
  assert.equal(rootTtStores[0], 0, result.stdout);
  assert.ok(rootTtStores[1] >= 1, result.stdout);
  assert.match(result.stdout, /\bbestmove h2e2\b/);
  assert.match(result.stdout, /\bbestmove b0c2\b/);
});

test("local C++ searchmoves probes do not warm persistent search memory", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position startpos",
    "go depth 3 searchmoves h2e2",
    "position startpos",
    "go depth 3",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  const ages = [...result.stdout.matchAll(/\bmemage\s+(\d+)/g)].map((match) => Number(match[1]));
  const bestMoves = [...result.stdout.matchAll(/\bbestmove\s+([a-i][0-9][a-i][0-9]|0000)\b/g)].map((match) => match[1]);

  assert.deepEqual(ages, [1, 1], result.stdout);
  assert.deepEqual(bestMoves, ["h2e2", "b2c2"], result.stdout);
});

test("local C++ engine reuses quiescence TT cutoffs across repeated searches", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position fen 4k4/9/4r4/9/9/9/9/9/9/3KR4 r",
    "go depth 5",
    "position fen 4k4/9/4r4/9/9/9/9/9/9/3KR4 r",
    "go depth 5",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  const nodes = [...result.stdout.matchAll(/\bnodes\s+(\d+)/g)].map((match) => Number(match[1]));
  const qnodes = [...result.stdout.matchAll(/\bqnodes\s+(\d+)/g)].map((match) => Number(match[1]));
  const qttStats = [...result.stdout.matchAll(/\bqtt\s+(\d+)\/(\d+)/g)].map((match) => ({
    hits: Number(match[1]),
    probes: Number(match[2])
  }));
  const qttStores = [...result.stdout.matchAll(/\bqttstores\s+(\d+)/g)].map((match) => Number(match[1]));
  const qttCutoffs = [...result.stdout.matchAll(/\bqttcut\s+(\d+)/g)].map((match) => Number(match[1]));

  assert.ok(nodes.length >= 2, result.stdout);
  assert.ok(qnodes.length >= 2, result.stdout);
  assert.ok(qttStats.length >= 2, result.stdout);
  assert.ok(qttStores.length >= 2, result.stdout);
  assert.ok(qttCutoffs.length >= 2, result.stdout);
  assert.ok(nodes.at(-1) < nodes[0], result.stdout);
  assert.ok(qnodes.every((value, index) => value > 0 && value < nodes[index]), result.stdout);
  assert.ok(qttStats.at(-1).hits > 0, result.stdout);
  assert.ok(qttCutoffs.at(-1) > 0, result.stdout);
  assert.ok(qttStores.every((stores, index) => stores <= qttStats[index].probes), result.stdout);
});

test("local C++ engine reuses eval cache across side-to-move flips", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const placement = "4k4/9/4r4/9/9/9/9/9/9/3KR4";
  const input = [
    "uci",
    `position fen ${placement} r`,
    "go depth 1",
    `position fen ${placement} b`,
    "go depth 1",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  const evalStats = [...result.stdout.matchAll(/\beval\s+(\d+)\/(\d+)\s+evalstores\s+(\d+)/g)].map((match) => ({
    hits: Number(match[1]),
    probes: Number(match[2]),
    stores: Number(match[3])
  }));

  assert.ok(evalStats.length >= 2, result.stdout);
  assert.equal(evalStats[0].hits, 0, result.stdout);
  assert.ok(evalStats.at(-1).hits > 0, result.stdout);
  assert.ok(evalStats.at(-1).stores < evalStats.at(-1).probes, result.stdout);
});

test("local C++ engine keeps piece lists valid through repeated piece moves", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position startpos moves h0g2 h9g7 g2h0 g7h9 h0g2",
    "go depth 1 searchmoves h9g7",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\bbestmove h9g7\b/);
  assert.doesNotMatch(result.stdout, /\bbestmove 0000\b/);
});

test("local C++ engine keeps cached material stable through capture search undo", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position fen 4k4/9/4r4/9/9/9/9/9/9/3KR4 r",
    "go depth 2 searchmoves e0e7",
    "position fen 4k4/9/4r4/9/9/9/9/9/9/3KR4 r",
    "go depth 2 searchmoves e0e7",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal((result.stdout.match(/\bbestmove e0e7\b/g) ?? []).length, 2, result.stdout);
  const scores = [...result.stdout.matchAll(/\bscore cp (-?\d+)/g)].map((match) => Number(match[1]));
  assert.equal(scores.length, 2, result.stdout);
  assert.equal(scores[0], scores[1], result.stdout);
  assert.ok(scores[0] > 900, result.stdout);
});

test("local C++ engine keeps cached positional score stable through reversible quiet moves", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position startpos",
    "go depth 1 searchmoves b0c2",
    "setoption name Clear Hash",
    "position startpos moves b0c2 b9c7 c2b0 c7b9",
    "go depth 1 searchmoves b0c2",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal((result.stdout.match(/\bbestmove b0c2\b/g) ?? []).length, 2, result.stdout);
  const scores = [...result.stdout.matchAll(/\bscore cp (-?\d+)/g)].map((match) => Number(match[1]));
  assert.equal(scores.length, 2, result.stdout);
  assert.equal(scores[0], scores[1], result.stdout);
});

test("local C++ engine keeps cached guard-pair score stable through advisor captures", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const fen = "4k4/9/9/9/4P4/9/9/9/3r5/3AKA3 b";
  const input = [
    "uci",
    `position fen ${fen}`,
    "go depth 2 searchmoves d1d0",
    `position fen ${fen}`,
    "go depth 2 searchmoves d1d0",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal((result.stdout.match(/\bbestmove d1d0\b/g) ?? []).length, 2, result.stdout);
  const scores = [...result.stdout.matchAll(/\bscore cp (-?\d+)/g)].map((match) => Number(match[1]));
  assert.equal(scores.length, 2, result.stdout);
  assert.equal(scores[0], scores[1], result.stdout);
});

test("local C++ engine keeps cached total piece count stable through capture search undo", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const fen = "4k4/9/9/p8/4P4/9/9/9/3r5/2BAK4 b";
  const input = [
    "uci",
    `position fen ${fen}`,
    "go depth 2 searchmoves d1d0",
    "setoption name Clear Hash",
    "go depth 1 searchmoves a6a5",
    "setoption name Clear Hash",
    `position fen ${fen}`,
    "go depth 1 searchmoves a6a5",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal((result.stdout.match(/\bbestmove a6a5\b/g) ?? []).length, 2, result.stdout);
  const scores = [...result.stdout.matchAll(/\bscore cp (-?\d+)/g)].map((match) => Number(match[1]));
  assert.equal(scores.length, 3, result.stdout);
  assert.equal(scores[1], scores[2], result.stdout);
});

test("local C++ engine preserves stable ordering for tied small move lists", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position startpos",
    "go depth 1 searchmoves b0c2 h0g2",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\brootmoves 2\b/);
  assert.match(result.stdout, /\bbestmove b0c2\b/);
});

test("local C++ engine preserves root PVs across MultiPV root moves", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "setoption name MultiPV value 2",
    "position startpos",
    "go depth 2",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /info multipv 1\b.*\bpv b0c2 b7e7/);
  assert.match(result.stdout, /info multipv 2\b.*\bpv h0g2 h7e7/);
});

test("local C++ engine reduces late quiet root moves in MultiPV searches", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "setoption name MultiPV value 5",
    "position fen rheakae1r/9/1c4hc1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1H2/9/RHEAKAE1R b",
    "go depth 6",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\binfo multipv 5\b/);
  assert.match(result.stdout, /\brootred [1-9]\d*\/[1-9]\d*\b/);
  assert.match(result.stdout, /\brootredply [1-9]\d*\b/);
  assert.match(result.stdout, /\bbestmove [a-i][0-9][a-i][0-9]\b/);
});

test("local C++ engine respects vertical horse-leg checks", async (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const backend = createUcciEngineBackend({
    command: build.output,
    protocol: "uci",
    depth: 1,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 3000
  });

  try {
    const position = parseFen("4k4/9/9/9/9/9/9/5h3/9/R3K4 r");
    const result = await backend.chooseMove(position, {
      useBook: false,
      lines: 2
    });
    const notation = moveToNotation(result.bestMove);

    assert.match(notation, /^e9-/);
    assert.ok(backend.legalMoves(position).some((move) => sameMove(move, result.bestMove)));
  } finally {
    await backend.close();
  }
});

test("local C++ engine detects line checks from the a0 square", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position fen R3k4/9/9/9/9/9/9/9/9/3K5 b",
    "go depth 1 searchmoves e0d0",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /bestmove 0000/);
});

test("local C++ engine rejects literal king captures as legal moves", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position fen 4k4/9/9/9/9/9/9/9/9/3KR4 w",
    "go depth 1 searchmoves e0e9",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /bestmove 0000/);
});

test("local C++ engine rejects pinned moves that expose the king line", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position fen 4k4/9/9/9/4r4/9/4N4/9/9/4K4 r",
    "go depth 1 searchmoves e3c2",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /bestmove 0000/);
});

test("local C++ engine rejects moves that reveal a horse-leg check", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position fen 4k4/9/9/9/9/9/9/5h3/5A3/4K4 r",
    "go depth 1 searchmoves f1e2",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /bestmove 0000/);
});

test("local C++ engine rejects moves that create a cannon screen against its own king", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position fen 4k4/9/9/9/9/9/4c4/9/9/3AK4 r",
    "go depth 1 searchmoves d0e1",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /bestmove 0000/);
});

test("local C++ engine extends immediate recaptures after root captures", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "isready",
    "position fen 4k4/9/9/4r4/9/4c4/9/4R4/9/4K4 r",
    "go depth 3 searchmoves e2e4",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /bestmove e2e4/);
  assert.match(result.stdout, /\brecext [1-9]\d*\b/);
});

test("local C++ engine orders immediate recaptures aggressively", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position fen 3k5/9/9/9/4R4/r3h4/9/9/9/5K3 r",
    "go depth 3",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\brecorder [1-9]\d*\b/);
  assert.match(result.stdout, /\brecext [1-9]\d*\b/);
});

test("local C++ engine extends forced check evasions", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position fen 4k4/9/9/9/9/9/9/4r4/9/4K4 r",
    "go depth 2",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\bext [1-9]\d*\b/);
  assert.match(result.stdout, /\bce [1-9]\d*\b/);
  assert.match(result.stdout, /\bceking [1-9]\d*\b/);
  assert.match(result.stdout, /bestmove [a-i][0-9][a-i][0-9]/);
});

test("local C++ engine reports recursive PVS and aspiration telemetry", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position fen rheakaer1/9/1c4hc1/p1p1p3p/6p2/9/P1P1P1P1P/1CH1C1H2/9/R1EAKAE1R r",
    "go depth 4",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\bpvs [1-9]\d*\b/);
  assert.match(result.stdout, /\basp [1-9]\d*\b/);
  assert.match(result.stdout, /bestmove [a-i][0-9][a-i][0-9]/);
});

test("local C++ engine widens failed aspiration windows before full re-search", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position fen 3k5/9/9/9/4Ph3/9/9/9/9/5K3 r",
    "go depth 6",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\baspwide [1-9]\d*\b/);
  assert.match(result.stdout, /\basphi [1-9]\d*\b/);
  assert.match(result.stdout, /\bbestmove e5f5\b/);
});

test("local C++ engine boosts reductions in deep cut nodes", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position fen 2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r",
    "go depth 8 movetime 2000",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\bcutboost [1-9]\d*\b/);
  assert.match(result.stdout, /\bredply [1-9]\d*\b/);
  assert.match(result.stdout, /\bdeepred [1-9]\d*\b/);
  assert.match(result.stdout, /\bqsee [1-9]\d{2,}\b/);
  assert.match(result.stdout, /\brootred [1-9]\d*\/\d+\b/);
  assert.match(result.stdout, /\brootredply [1-9]\d*\b/);
  assert.match(result.stdout, /\bnmrboost [1-9]\d*\b/);
  assert.match(result.stdout, /bestmove [a-i][0-9][a-i][0-9]/);
});

test("local C++ engine razors shallow quiet branches", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position fen 2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r",
    "go depth 4",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\brazor [1-9]\d*\/\d+\b/);
  assert.match(result.stdout, /bestmove [a-i][0-9][a-i][0-9]/);
});

test("local C++ engine prunes clearly losing shallow captures", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position fen 4k4/9/4r4/9/4p4/9/4P4/9/9/3AKR3 r",
    "go depth 5",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\bsee [1-9]\d*\b/);
  assert.match(result.stdout, /\bqdskip [1-9]\d*\b/);
  assert.match(result.stdout, /bestmove [a-i][0-9][a-i][0-9]/);
});

test("local C++ engine skips capture-risk probes for favorable captures", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position fen 3k5/9/9/9/4Ph3/9/9/9/9/5K3 r",
    "go depth 2",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\bcrisk \d+\/[1-9]\d*\b/);
  assert.match(result.stdout, /\blacache \d+\/\d+\b/);
  assert.match(result.stdout, /\blastores \d+\b/);
  assert.match(result.stdout, /bestmove [a-i][0-9][a-i][0-9]/);
});

test("local C++ engine prunes bad-history quiet moves conservatively", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position startpos",
    "go depth 4",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\bhprune [1-9]\d*\b/);
  assert.match(result.stdout, /\bhpguard \d+\b/);
  assert.match(result.stdout, /\bttmove [1-9]\d*\b/);
  assert.match(result.stdout, /\bch [1-9]\d*\b/);
  assert.match(result.stdout, /\bbestmove b2g2\b/);
});

test("local C++ engine tunes selective pruning in improving positions", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position startpos",
    "go depth 4",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\bimp [1-9]\d*\b/);
  assert.match(result.stdout, /\bnimp [1-9]\d*\b/);
  assert.match(result.stdout, /\brfp [1-9]\d*\b/);
  assert.match(result.stdout, /\bfutil [1-9]\d*\b/);
  assert.match(result.stdout, /\bhprune [1-9]\d*\b/);
  assert.match(result.stdout, /\bimplmp [1-9]\d*\b/);
  assert.match(result.stdout, /\blmp [1-9]\d*\b/);
  assert.match(result.stdout, /\bch [1-9]\d*\b/);
  assert.match(result.stdout, /\bbestmove b2g2\b/);
});

test("local C++ engine extends late-move pruning to depth three", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position startpos",
    "go depth 5",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\blmp [1-9]\d*\b/);
  assert.match(result.stdout, /\blmp3 [1-9]\d*\b/);
  assert.match(result.stdout, /\blacache [1-9]\d*\/[1-9]\d*\b/);
  assert.match(result.stdout, /\blastores [1-9]\d*\b/);
  assert.match(result.stdout, /\bbestmove h2c2\b/);
});

test("local C++ engine uses continuation history for reply ordering", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position fen 2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r",
    "go depth 5",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\bch [1-9]\d*\b/);
  assert.match(result.stdout, /\bchred \d+\b/);
  assert.match(result.stdout, /\bchredm \d+\b/);
  assert.match(result.stdout, /\bqsee [1-9]\d*\b/);
  assert.match(result.stdout, /\bbestmove e3e6\b/);
});

test("local C++ engine uses quiet-check history for checking move ordering", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position startpos",
    "go depth 4",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\bqchecks [1-9]\d*\b/);
  assert.match(result.stdout, /\bqcheckhist [1-9]\d*\b/);
  assert.match(result.stdout, /\bqcheckhstores [1-9]\d*\b/);
  assert.match(result.stdout, /\bqcheckhm [1-9]\d*\b/);
  assert.match(result.stdout, /\bqcapguard [1-9]\d*\b/);
  assert.match(result.stdout, /\bqnodes [1-9]\d*\b/);
  assert.match(result.stdout, /\bcheckhist [1-9]\d*\b/);
  assert.match(result.stdout, /\bcheckhstores [1-9]\d*\b/);
  assert.match(result.stdout, /\bcheckhm [1-9]\d*\b/);
  assert.match(result.stdout, /\bcheckcache [1-9]\d*\/[1-9]\d*\b/);
  assert.match(result.stdout, /\bbestmove b2g2\b/);
});

test("local C++ engine verifies ProbCut capture cutoffs", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position fen 2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r",
    "go depth 6",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\bpcut [1-9]\d*\b/);
  assert.match(result.stdout, /\bpcsearch [1-9]\d*\b/);
  assert.match(result.stdout, /\bpcskip [1-9]\d*\b/);
  assert.match(result.stdout, /bestmove [a-i][0-9][a-i][0-9]/);
});

test("local C++ engine uses internal iterative deepening at deeper nodes", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position fen 2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r",
    "go depth 6",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\biid [1-9]\d*\b/);
  assert.match(result.stdout, /\biidhit [1-9]\d*\b/);
  assert.match(result.stdout, /bestmove [a-i][0-9][a-i][0-9]/);
});

test("local C++ engine verifies deep null-move cutoffs", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position fen 2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r",
    "go depth 6",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\bnmp [1-9]\d*\b/);
  assert.match(result.stdout, /\bnmv [1-9]\d*\b/);
  assert.match(result.stdout, /\bnmvfail \d+\b/);
});

test("local C++ engine guards null-move pruning in defensive-only endgames", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position fen 4k4/9/9/9/9/9/9/9/4A4/3AKAE2 r",
    "go depth 5",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\bnmmguard [1-9]\d*\b/);
  assert.match(result.stdout, /\bnmp 0\b/);
  assert.match(result.stdout, /bestmove [a-i][0-9][a-i][0-9]/);
});

test("local C++ engine extends singular hash moves", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position fen 2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r",
    "go depth 7",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\bsingtry [1-9]\d*\b/);
  assert.match(result.stdout, /\bsingext [1-9]\d*\b/);
  assert.match(result.stdout, /\bimp [1-9]\d*\b/);
  assert.match(result.stdout, /\bnimp [1-9]\d*\b/);
  assert.match(result.stdout, /\bimprd [1-9]\d*\b/);
  assert.match(result.stdout, /bestmove [a-i][0-9][a-i][0-9]/);
});

test("local C++ engine values clear central passed pawns", async (t) => {
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
    const position = parseFen("4k4/9/9/4P4/9/9/9/9/9/4K4 r");
    const result = await backend.chooseMove(position, {
      useBook: false,
      lines: 2
    });

    assert.equal(moveToNotation(result.bestMove), "e3-e2");
    assert.ok(result.score > 250);
  } finally {
    await backend.close();
  }
});

test("local C++ engine extends late-game pawn pressure at the root", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position fen 4k4/9/9/4P4/9/9/9/9/9/4K4 r",
    "go depth 2 searchmoves e6e7",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\bbestmove e6e7\b/);
  assert.match(result.stdout, /\bpawnext [1-9]\d*\b/);
  assert.match(result.stdout, /\bext [1-9]\d*\b/);
});

test("local C++ engine orders late-game pawn pressure before ordinary quiets", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position fen 4k4/9/9/4P4/9/9/9/9/9/4K4 r",
    "go depth 1",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\bpawnord [1-9]\d*\b/);
});

test("local C++ engine rewards unclogging the palace center", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const position = "4k4/9/9/9/4p4/9/9/9/4N4/4K4 r";
  const input = [
    "uci",
    `position fen ${position}`,
    "go depth 1 searchmoves e1f3",
    `position fen ${position}`,
    "go depth 1 searchmoves e0d0",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /bestmove e1f3/);
  assert.match(result.stdout, /bestmove e0d0/);

  const scores = [...result.stdout.matchAll(/score cp (-?\d+)/g)].map((match) => Number(match[1]));
  assert.equal(scores.length, 2, result.stdout);
  assert.ok(scores[0] - scores[1] >= 60, result.stdout);
});

test("local C++ engine rewards clearing blocked king escapes", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const scores = forcedSearchScores(build.output, "4k4/9/9/9/4P4/9/9/9/9/R3KC3 r", [
    "f0f1",
    "a0a1"
  ]);

  assert.ok(scores[0] - scores[1] >= 12, scores.join(", "));
});

test("local C++ engine rewards central advisor fortress shape", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const scores = forcedSearchScores(build.output, "4k4/9/9/9/4P4/9/9/9/9/3AK4 r", [
    "d0e1",
    "e0f0"
  ]);

  assert.ok(scores[0] - scores[1] >= 24, scores.join(", "));
});

test("local C++ engine rewards latent king-line pressure", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const rookPressure = forcedSearchScores(build.output, "4k4/9/4p4/9/3R5/9/9/9/9/4K4 r", [
    "d5e5",
    "d5d4"
  ]);
  const cannonPressure = forcedSearchScores(build.output, "4k4/9/9/9/3C5/9/9/4P4/9/4K4 r", [
    "d5e5",
    "d5d4"
  ]);

  assert.ok(rookPressure[0] > rookPressure[1], rookPressure.join(", "));
  assert.ok(cannonPressure[0] > cannonPressure[1], cannonPressure.join(", "));
});

test("local C++ engine rewards rook control from the river rank", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const scores = forcedSearchScores(build.output, "4k4/9/9/9/9/4P4/9/9/9/R3K4 r", [
    "a0a4",
    "e0d0"
  ]);

  assert.ok(scores[0] - scores[1] >= 25, scores.join(", "));
});

test("local C++ engine rewards cannon control from the river rank", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const scores = forcedSearchScores(build.output, "4k4/9/9/9/9/4P4/9/9/9/C3K4 r", [
    "a0a4",
    "e0d0"
  ]);

  assert.ok(scores[0] - scores[1] >= 12, scores.join(", "));
});

test("local C++ engine rewards connected rooks on an open rank", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const scores = forcedSearchScores(build.output, "4k4/9/9/9/4p4/9/9/9/R7R/4K4 r", [
    "a1d1",
    "a1a2"
  ]);

  assert.ok(scores[0] - scores[1] >= 8, scores.join(", "));
});

test("local C++ engine rewards coordinated cannon batteries", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const scores = forcedSearchScores(build.output, "4k4/9/9/9/2C3C2/4P4/9/9/9/4K4 r", [
    "c5d5",
    "c5c6"
  ]);

  assert.ok(scores[0] - scores[1] >= 8, scores.join(", "));
});

test("local C++ engine rewards pinning palace guards to the king line", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const rookPin = forcedSearchScores(build.output, "4k4/9/4a4/9/3R5/9/9/9/9/4K4 r", [
    "d5e5",
    "d5d4"
  ]);
  const cannonPin = forcedSearchScores(build.output, "4k4/9/4a4/4P4/3C5/9/9/9/9/4K4 r", [
    "d5e5",
    "d5d4"
  ]);

  assert.ok(rookPin[0] - rookPin[1] >= 40, rookPin.join(", "));
  assert.ok(cannonPin[0] - cannonPin[1] >= 40, cannonPin.join(", "));
});

test("local C++ engine rewards rook-cannon batteries on the king line", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const scores = forcedSearchScores(build.output, "4k4/4a4/9/9/4R4/9/3C5/9/9/4K4 r", [
    "d3e3",
    "d3d4"
  ]);

  assert.ok(scores[0] - scores[1] >= 16, scores.join(", "));
});

test("local C++ engine rewards freeing a blocked horse leg", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const scores = forcedSearchScores(build.output, "4k4/9/9/9/9/9/9/4P4/4N4/4K4 r", [
    "e2e3",
    "e0d0"
  ]);

  assert.ok(scores[0] > scores[1], scores.join(", "));
});

test("local C++ engine rewards linked horse coordination", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const scores = forcedSearchScores(build.output, "4k4/9/4p4/9/9/2N3N2/9/9/9/4K4 r", [
    "g4e5",
    "g4i5"
  ]);

  assert.ok(scores[0] > scores[1], scores.join(", "));
});

test("local C++ engine rewards horse jumps that pressure the enemy palace", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const scores = forcedSearchScores(build.output, "3k5/9/9/9/9/1N7/9/9/9/5K3 r", [
    "b4c6",
    "b4a6"
  ]);

  assert.ok(scores[0] - scores[1] >= 75, scores.join(", "));
});

test("local C++ engine rewards horse outposts that control general escapes", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const scores = forcedSearchScores(build.output, "4k4/9/9/9/1N2P4/9/9/9/9/4K4 r", [
    "b5c7",
    "b5d6"
  ]);

  assert.ok(scores[0] - scores[1] >= 12, scores.join(", "));
});

test("local C++ engine rewards opening an elephant eye", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const scores = forcedSearchScores(build.output, "4k4/9/9/9/4p4/9/9/9/3A5/2B1K4 r", [
    "d1e2",
    "e0d0"
  ]);

  assert.ok(scores[0] > scores[1], scores.join(", "));
});

test("local C++ engine rewards central elephant fortress shape", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const scores = forcedSearchScores(build.output, "4k4/9/9/9/4p4/9/9/9/9/2B1K4 r", [
    "c0e2",
    "e0d0"
  ]);

  assert.ok(scores[0] - scores[1] >= 18, scores.join(", "));
});

test("local C++ engine rewards crossed pawn attacks on valuable pieces", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const scores = forcedSearchScores(build.output, "3k5/9/9/9/4P1h2/9/9/9/9/5K3 r", [
    "e5f5",
    "e5d5"
  ]);

  assert.ok(scores[0] - scores[1] >= 30, scores.join(", "));
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

function forcedSearchScores(enginePath, fen, moves) {
  const input = [
    "uci",
    ...moves.flatMap((move) => [
      `position fen ${fen}`,
      `go depth 1 searchmoves ${move}`
    ]),
    "quit"
  ].join("\n");
  const result = spawnSync(enginePath, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  for (const move of moves) {
    assert.match(result.stdout, new RegExp(`bestmove ${move}`));
  }
  const scores = [...result.stdout.matchAll(/score cp (-?\d+)/g)].map((match) => Number(match[1]));
  assert.equal(scores.length, moves.length, result.stdout);
  return scores;
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
