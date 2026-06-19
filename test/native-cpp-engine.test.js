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
    assert.ok(result.stats.ttStores > 0);
    assert.ok(result.raw.some((line) => /\bhashfull\b/.test(line)));
    assert.ok(result.raw.some((line) => /\bhistory\b/.test(line)));
    assert.ok(result.raw.some((line) => /\bnmp\b/.test(line) && /\bnmv\b/.test(line) && /\bnmvfail\b/.test(line) && /\bnmrboost\b/.test(line) && /\bnmmguard\b/.test(line) && /\brfp\b/.test(line) && /\bmdp\b/.test(line) && /\brazor\b/.test(line) && /\bsee\b/.test(line) && /\blacache\b/.test(line) && /\blastores\b/.test(line) && /\bpcut\b/.test(line) && /\bpcsearch\b/.test(line) && /\bpcskip\b/.test(line) && /\bfutil\b/.test(line) && /\bhprune\b/.test(line) && /\bhpguard\b/.test(line) && /\bdelta\b/.test(line) && /\bqdskip\b/.test(line) && /\bqsee\b/.test(line) && /\bqseepf\b/.test(line) && /\blmp\b/.test(line) && /\blmp3\b/.test(line) && /\blmp4\b/.test(line) && /\blmr\b/.test(line) && /\bredply\b/.test(line) && /\bdeepred\b/.test(line) && /\bpvguard\b/.test(line) && /\bcutboost\b/.test(line) && /\bimp\b/.test(line) && /\bnimp\b/.test(line) && /\bimprd\b/.test(line) && /\bnimprd\b/.test(line) && /\bimplmp\b/.test(line) && /\bnimlmp\b/.test(line) && /\bttstores\b/.test(line) && /\bttmove\b/.test(line) && /\bttpref\b/.test(line) && /\bcaphist\b/.test(line) && /\bcaphstores\b/.test(line) && /\bcaphm\b/.test(line) && /\bcaphguard\b/.test(line) && /\bcm\b/.test(line) && /\bcmstores\b/.test(line) && /\bch\b/.test(line) && /\bchstores\b/.test(line) && /\bchred\b/.test(line) && /\bchredm\b/.test(line) && /\bfch\b/.test(line) && /\bfchstores\b/.test(line) && /\bfchred\b/.test(line) && /\bfchredm\b/.test(line) && /\bce\b/.test(line) && /\bcecap\b/.test(line) && /\bceblock\b/.test(line) && /\bceking\b/.test(line) && /\bcheckhist\b/.test(line) && /\bcheckhstores\b/.test(line) && /\bcheckhm\b/.test(line) && /\bcheckcache\b/.test(line) && /\biid\b/.test(line) && /\biidcut\b/.test(line) && /\biidhit\b/.test(line) && /\brootmoves\b/.test(line) && /\brootstate\b/.test(line) && /\brootred\b/.test(line) && /\brootredply\b/.test(line) && /\broottt\b/.test(line) && /\brootttstores\b/.test(line) && /\bsingtry\b/.test(line) && /\bsingext\b/.test(line) && /\bsingrej\b/.test(line) && /\bpvs\b/.test(line) && /\basp\b/.test(line) && /\baspwide\b/.test(line) && /\btguard\b/.test(line)));
    assert.ok(result.raw.some((line) => /\broothrguard\b/.test(line) && /\broothrboost\b/.test(line)));
    assert.ok(result.raw.some((line) => /\bcrisk \d+\/\d+\b/.test(line)));
    assert.ok(result.raw.some((line) => /\bext\b/.test(line) && /\brecext\b/.test(line) && /\bpawnext\b/.test(line) && /\bpawnord\b/.test(line) && /\bklineext\b/.test(line) && /\bklineord\b/.test(line) && /\brecorder\b/.test(line) && /\bqnodes\b/.test(line) && /\bqchecks\b/.test(line) && /\bqcheckhist\b/.test(line) && /\bqcheckhstores\b/.test(line) && /\bqcheckhm\b/.test(line) && /\bqcapguard\b/.test(line) && /\bqcaphist\b/.test(line) && /\bqcapstores\b/.test(line) && /\bqcaphm\b/.test(line)));
    assert.ok(result.raw.some((line) => /\bqtt\b/.test(line) && /\bqttstores\b/.test(line) && /\bqttpref\b/.test(line) && /\beval\b/.test(line) && /\bevalpref\b/.test(line) && /\bevalskip\b/.test(line) && /\bevalguard\b/.test(line) && /\brep\b/.test(line)));
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
  assert.match(result.stdout, /option name Hash type spin default 128 min 1 max 1024/);
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
    startupTimeoutMs: 3000,
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

test("local C++ engine clears stale eval trends on static-eval skips", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position startpos",
    "go depth 3",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\bevalskip [1-9]\d*\b/);
  assert.match(result.stdout, /\bevalguard [1-9]\d*\b/);
  assert.match(result.stdout, /\bbestmove b2c2\b/);
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
    startupTimeoutMs: 3000,
    commandTimeoutMs: 3000
  });

  try {
    const huTrap = parseFen("rheakaer1/9/1c4hc1/p1p1p3p/6p2/9/P1P1P1P1P/1CH1C1H2/9/R1EAKAE1R r");
    const centralHorseReply = parseFen("rheakae1r/9/1c4hc1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RHEAKAEHR r");
    const centralCannon = parseFen("rheakae1r/9/1c4hc1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1H2/9/RHEAKAE1R b");
    const pawnChallenge = parseFen("rheakae1r/9/1c4hc1/p3p1p1p/2p6/9/P1P1P1P1P/1C2C1H2/9/RHEAKAE1R r");
    const pawnChallengeDoubleHorse = parseFen("r1eakae1r/9/1ch3hc1/p3p1p1p/2p6/9/P1P1P1P1P/HC2C1H2/9/R1EAKAE1R r");
    const shiftedCannons = parseFen("rheakae1r/9/1c4hc1/p1p1p1p1p/9/9/P1P1P1P1P/3CC4/9/RHEAKAEHR b");
    const shiftedCannonsDoubleHorse = parseFen("r1eakae1r/9/1ch3hc1/p1p1p1p1p/9/9/P1P1P1P1P/2HCC4/9/R1EAKAEHR b");
    const doubleHorseRedRook = parseFen("rheakae1r/9/1c4hc1/p1p1p3p/6p2/9/P1P1P1P1P/1C2C1H2/9/RHEAKAER1 b");
    const doubleHorseBothRooks = parseFen("rheakaer1/9/1c4hc1/p1p1p3p/6p2/9/P1P1P1P1P/1C2C1H2/9/RHEAKAER1 r");
    const doubleHorseRookPressure = parseFen("rheakaer1/9/1c4hc1/p1p1p3p/6p2/7R1/P1P1P1P1P/1C2C1H2/9/RHEAKAE2 b");
    const leftScreen = parseFen("r1eakaehr/9/1ch4c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RHEAKAEHR r");
    const earlyPawnCannonSide = parseFen("rheakaehr/9/1c4c2/p1p1p1p1p/9/6P2/P1P1P3P/1C5C1/9/RHEAKAEHR r");
    const earlyPawnChallenge = parseFen("rheakaehr/9/1c5c1/p3p1p1p/2p6/6P2/P1P1P3P/1C5C1/9/RHEAKAEHR r");
    const refreshedPawnPushContinuation = parseFen("rheakae1r/9/1c4h1c/p1p1p1p1p/9/6P2/P1P1P3P/1C2C4/9/RHEAKAEHR r");
    const shiftedLeftPawn = parseFen("r1eakaehr/9/1ch4c1/p1p1p1p1p/9/6P2/P1P1P3P/1C2C4/9/RHEAKAEHR b");
    const earlyPawnBlackCannonSide = parseFen("rheakaehr/9/1c5c1/p1p1p1p1p/9/6P2/P1P1P3P/1C5C1/9/RHEAKAEHR b");
    const centralCannonEarlyPawnBlack = parseFen("rheakae1r/9/1c4hc1/p1p1p1p1p/9/6P2/P1P1P3P/1C2C4/9/RHEAKAEHR b");
    const earlyPawnRedElephantBlack = parseFen("rheakaehr/9/1c4c2/p1p1p1p1p/9/6P2/P1P1P3P/1C2E2C1/9/RH1AKAEHR b");
    const earlyPawnShiftedCannonBlack = parseFen("rheakaehr/9/1c4c2/p1p1p1p1p/9/6P2/P1P1P3P/4C2C1/9/RHEAKAEHR b");

    const huResult = await backend.chooseMove(huTrap, {
      useBook: false,
      depth: 4,
      timeLimitMs: 200
    });
    const centralHorseReplyResult = await backend.chooseMove(centralHorseReply, {
      useBook: false,
      depth: 4,
      timeLimitMs: 200,
      lines: 5
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
    const earlyPawnCannonSideResult = await backend.chooseMove(earlyPawnCannonSide, {
      useBook: false,
      depth: 4,
      timeLimitMs: 200,
      lines: 5
    });
    const earlyPawnChallengeResult = await backend.chooseMove(earlyPawnChallenge, {
      useBook: false,
      depth: 4,
      timeLimitMs: 200,
      lines: 5
    });
    const refreshedPawnPushContinuationResult = await backend.chooseMove(refreshedPawnPushContinuation, {
      useBook: false,
      depth: 4,
      timeLimitMs: 200,
      lines: 5
    });
    const shiftedLeftPawnResult = await backend.chooseMove(shiftedLeftPawn, {
      useBook: false,
      depth: 4,
      timeLimitMs: 200,
      lines: 5
    });
    const earlyPawnBlackCannonSideResult = await backend.chooseMove(earlyPawnBlackCannonSide, {
      useBook: false,
      depth: 4,
      timeLimitMs: 200,
      lines: 5
    });
    const centralCannonEarlyPawnBlackResult = await backend.chooseMove(centralCannonEarlyPawnBlack, {
      useBook: false,
      depth: 4,
      timeLimitMs: 200,
      lines: 5
    });
    const earlyPawnRedElephantBlackResult = await backend.chooseMove(earlyPawnRedElephantBlack, {
      useBook: false,
      depth: 4,
      timeLimitMs: 200,
      lines: 5
    });
    const earlyPawnShiftedCannonBlackResult = await backend.chooseMove(earlyPawnShiftedCannonBlack, {
      useBook: false,
      depth: 4,
      timeLimitMs: 200,
      lines: 5
    });

    assert.equal(moveToNotation(huResult.bestMove), "i9-h9");
    assert.equal(moveToNotation(centralHorseReplyResult.bestMove), "h9-g7");
    assert.equal(moveToNotation(centralResult.bestMove), "g3-g4");
    assert.equal(moveToNotation(pawnChallengeResult.bestMove), "i9-h9");
    assert.equal(moveToNotation(pawnChallengeDoubleHorseResult.bestMove), "i9-h9");
    assert.equal(moveToNotation(shiftedResult.bestMove), "g3-g4");
    assert.equal(moveToNotation(shiftedDoubleHorseResult.bestMove), "a0-b0");
    assert.equal(moveToNotation(doubleHorseRedRookResult.bestMove), "i0-h0");
    assert.equal(moveToNotation(doubleHorseBothRooksResult.bestMove), "h9-h3");
    assert.equal(moveToNotation(doubleHorseRookPressureResult.bestMove), "h2-i2");
    assert.equal(moveToNotation(leftScreenResult.bestMove), "h9-g7");
    assert.equal(moveToNotation(earlyPawnCannonSideResult.bestMove), "b7-e7");
    assert.equal(moveToNotation(earlyPawnChallengeResult.bestMove), "b7-c7");
    assert.equal(moveToNotation(refreshedPawnPushContinuationResult.bestMove), "b7-d7");
    assert.equal(moveToNotation(shiftedLeftPawnResult.bestMove), "g0-e2");
    assert.equal(moveToNotation(earlyPawnBlackCannonSideResult.bestMove), "h2-g2");
    assert.equal(moveToNotation(centralCannonEarlyPawnBlackResult.bestMove), "c3-c4");
    assert.equal(moveToNotation(earlyPawnRedElephantBlackResult.bestMove), "h0-i2");
    assert.equal(moveToNotation(earlyPawnShiftedCannonBlackResult.bestMove), "c0-e2");
    assert.ok(huResult.nodes > 0);
    assert.ok(centralHorseReplyResult.nodes > 0);
    assert.ok(centralResult.nodes > 0);
    assert.ok(pawnChallengeResult.nodes > 0);
    assert.ok(pawnChallengeDoubleHorseResult.nodes > 0);
    assert.ok(shiftedResult.nodes > 0);
    assert.ok(shiftedDoubleHorseResult.nodes > 0);
    assert.ok(doubleHorseRedRookResult.nodes > 0);
    assert.ok(doubleHorseBothRooksResult.nodes > 0);
    assert.ok(doubleHorseRookPressureResult.nodes > 0);
    assert.ok(leftScreenResult.nodes > 0);
    assert.ok(earlyPawnCannonSideResult.nodes > 0);
    assert.ok(earlyPawnChallengeResult.nodes > 0);
    assert.ok(refreshedPawnPushContinuationResult.nodes > 0);
    assert.ok(shiftedLeftPawnResult.nodes > 0);
    assert.ok(earlyPawnBlackCannonSideResult.nodes > 0);
    assert.ok(centralCannonEarlyPawnBlackResult.nodes > 0);
    assert.ok(earlyPawnRedElephantBlackResult.nodes > 0);
    assert.ok(earlyPawnShiftedCannonBlackResult.nodes > 0);
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

test("local C++ engine keeps the refreshed Pikafish shifted-cannon central response at depth seven", async (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const backend = createUcciEngineBackend({
    command: build.output,
    protocol: "uci",
    depth: 7,
    timeLimitMs: 1000,
    startupTimeoutMs: 3000,
    commandTimeoutMs: 5000
  });

  try {
    const position = parseFen("rheakaehr/9/1c4c2/p1p1p1p1p/9/6P2/P1P1P3P/4C2C1/9/RHEAKAEHR b");
    const result = await backend.chooseMove(position, {
      useBook: false,
      depth: 7,
      timeLimitMs: 1000,
      lines: 5
    });

    assert.equal(moveToNotation(result.bestMove), "c0-e2");
    assert.ok(result.nodes > 0);
  } finally {
    await backend.close();
  }
});

test("local C++ engine balances root threat response against invaded-piece captures", async (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const backend = createUcciEngineBackend({
    command: build.output,
    protocol: "uci",
    depth: 6,
    timeLimitMs: 1000,
    startupTimeoutMs: 3000,
    commandTimeoutMs: 5000
  });

  try {
    const threatPressure = parseFen("1heak1ehr/3ra4/7c1/2p3p1p/p3p4/9/c1P1P1P1P/R2C3C1/4A4/1HEA1KEHR b");
    const fullThreatNeutralization = parseFen("1heak1ehr/4a4/7c1/2C5p/p3p1p2/r8/c1P1P1P1P/R6C1/4AK3/1HEA2EHR b");
    const invadedBackRank = parseFen("rCeak1ehr/4a4/c1h4c1/p1p3p1p/4p4/P8/2P1P1P1P/4E2C1/3H5/1R1AKAEHR b");

    const threatPressureResult = await backend.chooseMove(threatPressure, {
      useBook: false,
      depth: 6,
      timeLimitMs: 1000
    });
    const fullNeutralizationResult = await backend.chooseMove(fullThreatNeutralization, {
      useBook: false,
      depth: 6,
      timeLimitMs: 1000
    });
    const invadedBackRankResult = await backend.chooseMove(invadedBackRank, {
      useBook: false,
      depth: 6,
      timeLimitMs: 1000
    });

    assert.equal(moveToNotation(threatPressureResult.bestMove), "a4-a5");
    assert.equal(moveToNotation(fullNeutralizationResult.bestMove), "a5-f5");
    assert.equal(moveToNotation(invadedBackRankResult.bestMove), "a0-b0");
    assert.ok(threatPressureResult.nodes > 0);
    assert.ok(fullNeutralizationResult.nodes > 0);
    assert.ok(invadedBackRankResult.nodes > 0);
  } finally {
    await backend.close();
  }
});

test("local C++ engine follows oracle early-midgame development priors", async (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const backend = createUcciEngineBackend({
    command: build.output,
    protocol: "uci",
    depth: 6,
    timeLimitMs: 1000,
    startupTimeoutMs: 3000,
    commandTimeoutMs: 5000
  });

  try {
    const development = parseFen("rheakaehr/9/c6c1/2pC2p1p/p3p4/9/P1P1P1P1P/5A1C1/9/RHEAK1EHR r");
    const pawnRelief = parseFen("1heak1ehr/4a4/7c1/2p3p1p/p3p4/r8/c1P1P1P1P/R2C3C1/4AK3/1HEA2EHR r");

    const developmentResult = await backend.chooseMove(development, {
      useBook: false,
      depth: 6,
      timeLimitMs: 1000
    });
    const pawnReliefResult = await backend.chooseMove(pawnRelief, {
      useBook: false,
      depth: 6,
      timeLimitMs: 1000
    });

    assert.equal(moveToNotation(developmentResult.bestMove), "b9-c7");
    assert.equal(moveToNotation(pawnReliefResult.bestMove), "c6-c5");
    assert.ok(developmentResult.nodes > 0);
    assert.ok(pawnReliefResult.nodes > 0);
  } finally {
    await backend.close();
  }
});

test("local C++ engine promotes near-tied home-horse captures in early middlegames", async (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const backend = createUcciEngineBackend({
    command: build.output,
    protocol: "uci",
    depth: 6,
    timeLimitMs: 1000,
    startupTimeoutMs: 3000,
    commandTimeoutMs: 5000
  });

  try {
    const position = parseFen("rhea1ae2/8r/2C1k4/p5p1p/2p1p4/2P4C1/c3P1P1P/R8/2c1K4/1HEA1AEHR b");
    const result = await backend.chooseMove(position, {
      useBook: false,
      depth: 6,
      timeLimitMs: 1000
    });

    assert.equal(moveToNotation(result.bestMove), "b0-c2");
    assert.ok(result.nodes > 0);
  } finally {
    await backend.close();
  }
});

test("local C++ engine follows oracle cannon-pressure priors in random middlegames", async (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const backend = createUcciEngineBackend({
    command: build.output,
    protocol: "uci",
    depth: 6,
    timeLimitMs: 1000,
    startupTimeoutMs: 3000,
    commandTimeoutMs: 5000
  });

  try {
    const cannonLift = parseFen("rh1akaehr/9/4e4/p1p1p1p1p/9/5c3/P1P1P1P1P/Hc6C/2R1A2CR/2EAK1EH1 r");
    const backRankCannon = parseFen("1hea1k2r/4a4/1c2e2c1/r1p1h1p2/p3p3p/2P3P2/P3P1C1P/H3E2C1/R3A2R1/3AK1EH1 b");

    const cannonLiftResult = await backend.chooseMove(cannonLift, {
      useBook: false,
      depth: 6,
      timeLimitMs: 1000
    });
    const backRankCannonResult = await backend.chooseMove(backRankCannon, {
      useBook: false,
      depth: 6,
      timeLimitMs: 1000
    });

    assert.equal(moveToNotation(cannonLiftResult.bestMove), "h8-h5");
    assert.equal(moveToNotation(backRankCannonResult.bestMove), "h2-h8");
    assert.ok(cannonLiftResult.nodes > 0);
    assert.ok(backRankCannonResult.nodes > 0);
  } finally {
    await backend.close();
  }
});

test("local C++ engine follows fresh random oracle priors", async (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const backend = createUcciEngineBackend({
    command: build.output,
    protocol: "uci",
    depth: 6,
    timeLimitMs: 1000,
    startupTimeoutMs: 3000,
    commandTimeoutMs: 5000
  });

  try {
    const cases = [
      ["r1eakhe1r/4a4/7c1/p5p2/2h5p/9/P3P1P1P/4E1C1H/9/R2K1AE1R r", "i9-h9"],
      ["C4a2r/3k5/C3e1h2/p1p5p/4p1p2/9/PcP1P1P1P/H1RAE4/9/1RE1KA3 b", "f0-e1"],
      ["1heaka1hr/8r/1C2e4/4p1p1p/p1p6/9/P1P1P1P1P/E3EC3/8R/1R2KA3 r", "i8-d8"],
      ["r1eaka3/3c5/h3e4/p5p1r/4p4/4C3P/P1P1P1P2/4EA3/1R7/3AK2HR r", "i5-i4"],
      ["rhea1ae2/4k3r/9/p1C1p3p/9/8P/2P3c2/5A1CR/9/RHEAK1EH1 r", "c3-c5"],
      ["1R1a1a1hr/2Ck5/6c2/p1p1p1p1p/6e2/P1P5P/4P1P2/4E4/4C4/2EAK3R b", "g2-e2"],
      ["rheak3r/9/3a2R2/p1p3p1p/4p1e2/6P2/P1P1P3P/R1C6/9/2EcKAEH1 b", "d9-f9"],
      ["1heakae1r/2r6/2c5h/p1p3p1p/4p2c1/8P/P1PCP1P2/3CE4/9/RH1AKAEHR b", "h4-h6"],
      ["rhCa1a2r/4k4/6h2/P1p3p2/4p1e1p/9/4c1P1c/4C4/1R2H4/RHEAKAE2 b", "a0-a1"],
      ["1heakae2/7r1/r8/p1p1p1p2/4c3p/6P2/P1P5P/4CAH2/4HR3/R1EAK1E2 b", "a2-d2"],
      ["3aka2r/r5c1h/2h1e3e/p1C1p4/7c1/4P1P2/PCP3H1P/4E4/1R3H3/3AKAE1R b", "i0-h0"],
      ["1heaka1h1/2c5r/e8/r3p1p1p/p8/2C6/P1PHP1P1P/3CE1H2/1c2A4/R2AK1E1R b", "i1-i2"],
      ["1h1akae2/9/e2c5/p1p1h1p1r/4p3p/3r4P/P1P1P1P2/1R2E4/C3R2C1/1H1AKAEH1 r", "b7-b0"],
      ["r3kaehr/4a4/2h1e4/p3p2cp/5CC2/2P1P4/c7P/8H/4R4/2E1K1E2 r", "e8-e6"],
      ["rhC1kaehr/4a4/9/p1p1p3p/6p2/Pc6P/4P1P2/9/4K4/cH1A1AEHR b", "a0-a1"],
      ["rh1akae1r/9/e5h2/p1p1CC2p/R7c/2P6/4P4/9/8R/1cEAKAEH1 b", "g2-e3"],
      ["1heakaehr/9/c8/p1p1p1p2/8p/2P6/P3H1P2/4r4/4R4/RH2KAE2 r", "g9-e7"],
      ["rhCa2e2/4k4/r8/p1p1p1p1p/9/6P1P/P1P1P4/1c2E4/8H/1R1AKAE1R r", "b9-b7"],
      ["rheak2r1/4a4/4e3C/p3p4/2p3p2/7c1/P1c1P1P1P/4E1H2/5K3/RH1A1AE1R b", "b0-c2"],
      ["1hea1ae2/9/r3k4/pCp1p3p/6p2/2P5P/PR2P1P2/2c6/4A4/2EAK1E1r b", "i9-g9"],
      ["r2a2e1r/3k5/2h2c3/1c5Cp/p3p4/2P3p2/P3P3P/HC2E4/4K4/R1EA1A1HR r", "h9-f8"],
      ["1hea1ar2/4k4/8h/r1p1C1p1p/p5e2/1CP4R1/PR2P1P1P/4EA3/9/3A1KE2 r", "c5-c4"],
      ["r2akae1r/6C2/e7h/1cp1p1p2/p7p/2C1P4/P1P3P1P/9/7c1/RHEAKAEHR r", "a9-a8"],
      ["1he1ka1h1/4a4/r3e4/2p3c2/4p4/p3P4/P1P3P1R/R1H1E4/4C2r1/3AKAEH1 r", "a7-b7"],
      ["2eaka3/6h1r/h3e1c2/r3p1p1p/2p4c1/p1C5C/P1P1P1PHP/R4A3/9/1HE1KAER1 r", "i5-i1"],
      ["rhea1aehr/4k4/9/pC4p1p/2p1p2c1/4P3P/P5P2/1R2E4/9/1HEAKA1HR r", "e5-e4"],
      ["r1ek1ae1C/4a3c/h4r3/6p2/2pC4p/1pP5P/Pc2P1P2/E5H1E/7R1/2RAKA3 r", "i5-i4"],
      ["4kaeh1/9/e1c6/2p1p1p1p/P3c4/2Pr2P2/4P2rP/3CE2H1/3K5/RHEA1AR2 b", "d5-d7"],
      ["1r1a1aeh1/2h1k4/2cce3r/p3p1p2/2p3P1p/P1P5P/1C2P4/4C3E/R3K4/1HEA1A1HR r", "a8-b8"],
      ["rhe1kaehr/4aC3/1c2c4/p1p1p1p1p/7C1/2P5P/P3P1P2/H3E4/4A4/R1E1KA1HR b", "b0-a2"],
      ["r2akaehr/5c3/h3e4/p1p1p1p1p/6P2/P8/1cP1P3P/7CC/9/RHEAKAEHR r", "i9-i8"],
      ["3a2Ch1/r3a2c1/e3k4/p1p1phprp/9/9/P1P1P1P1P/H3E3H/6R2/1C1AKcE1R r", "e9-f9"],
      ["2ea1aeh1/r3k3r/2h4C1/p5p1p/1cp3c2/P8/2P1P1P1P/R3E2CE/4A4/1H1AK2HR r", "g6-g5"],
      ["rh1akaer1/6h2/1c2e4/p1p1p1p1p/9/9/P1P1P1PcP/2HC4H/9/RCEAKAE1R b", "h6-e6"],
      ["2e1kae2/4a4/hr6h/p5p2/2p1p4/P1E4rp/2P1P1P1C/E8/3RA1HC1/1H1A1K1cR r", "i6-h6"],
      ["rheak1er1/1c7/5a3/p1p5p/4C1p1h/2E1P4/P1P3P1P/2H4c1/7R1/R2AKAEH1 b", "b1-f1"],
      ["1h1akaehr/4c4/1r2eR3/p1p3p1p/1c5C1/P1P1P1P2/8P/4C3H/H8/R1EAKAE2 r", "a9-b9"],
      ["r1ea1ae2/h3k3r/4c4/C1p3pCp/9/P5P2/2P1P3P/3RE4/4K4/1HcA1A1HR b", "a0-b0"],
      ["2eaka1hr/r8/hcc1e4/p1p3pCp/4p4/P2C5/2P1P1P1P/H5H2/4K3R/R1EA1AE2 b", "a1-d1"],
      ["r1e1ka1hr/4a4/eh1C2c2/2p1p3p/pc4p2/6P2/P1P1P2CP/E3E1H2/3K4R/RH1A1A3 r", "g5-g4"],
      ["rheakaeh1/c8/5c2r/p1C1p2Cp/6p2/2E6/P1P1P1P1P/9/8R/1H1AKAEHR b", "b0-a2"],
      ["1hea1ae1r/4k4/6hC1/4prc2/p5p1p/P1pH2E1P/4c1P2/R3C4/4A4/2EAK2HR r", "h2-h3"],
      ["2eakaeh1/8r/h8/p1p1C1p1p/1r6c/4P1P2/P1P5P/2H1K3E/2cCA4/R4A2R b", "h0-g2"],
      ["rheaka3/9/4e2r1/p1p1p1p1p/9/4P4/P1P2CP1P/1c7/2H1A3H/R1EA1KR2 r", "a9-b9"],
      ["r1eakaehr/9/2h4c1/p1p3p1p/1C2p4/9/P1P1P1P1P/6H2/3C5/R1EK1AE1R b", "a0-b0"],
      ["2Raka2r/8c/4e1h2/p5p1p/9/4p4/P7P/6H1E/4A3R/2C1KA3 r", "c0-c2"],
      ["3ak1e2/9/h3e4/2p6/6p2/4P3P/2c6/C2A2H2/9/RHE1KAER1 r", "a7-a5"],
      ["rh1aka1r1/9/4ec2e/p1p1p1pcp/9/9/P1P1P1P1P/C8/4K3R/RHEA1AEH1 b", "b0-c2"],
      ["2e1kh3/9/9/p3p1p1p/2PC2e2/8P/P3PcP2/H2C4H/7r1/R1EAKAE1R b", "f0-g2"],
      ["1hea1ke2/r8/4c2cr/p1p1C1p1p/9/9/P1P1P1P1P/9/9/RHEAKAEHR r", "h9-g7"],
      ["2e1k1e2/8r/2c6/p1p5p/3rp1pR1/9/PCP1P1P1P/6H2/9/R1EcKAE2 r", "c9-e7"],
      ["2ea1a3/3ck4/6h1e/p3p1p1p/2p6/8P/P3r4/E7E/1R2A4/R3K4 b", "e6-d6"],
      ["rheaka1hr/c8/4e4/p1p1p1p2/7cp/2E1P1P2/P1P1H3P/5C3/4K2C1/R1EA1A1HR b", "b0-c2"],
      ["rh1a2e1r/4k4/4e2R1/p1p3p1p/9/P4p3/2P3P1P/2R6/1C1c5/2EAKAcH1 r", "f9-e8"],
      ["1reakae1r/5c3/8h/p1p3p1p/4p4/8P/P1P1P1P2/7C1/9/RHEAKAE1R r", "i9-i8"],
      ["rheaka1hr/9/3C3Ce/p1p3p1p/7R1/4p4/P1P1H1P1P/E8/R8/3AKAE2 b", "e5-e6"],
      ["1heakaehr/7C1/r8/p1p1p1p1p/9/9/PCP1P1P1P/4E4/9/1R1AKAER1 b", "a2-b2"],
      ["1heakaeh1/1C5c1/r7r/p1p1p1p2/9/1c6p/P1P1P1P1P/H1C1E3E/9/R2AKA1HR r", "i6-i5"],
      ["r1eaka1h1/1r1c5/e1h6/2p1p3p/p5p2/6E2/P1P1P1P1P/H6CC/4R4/2EAKA2R r", "i9-h9"],
      ["rhe2aer1/cC7/4kah1C/p5p2/2p1p3p/2c3P2/P3P3P/2H6/R8/1REAKAE2 b", "e2-e1"],
      ["1hea1aehr/1c2k4/4c4/r3p1p1p/p1p6/2P1P1ECP/P5P2/1C6R/4A4/RHE1KA1H1 b", "a3-b3"],
      ["2ea2eh1/3ka3r/h1c2c3/r1p1p1p1p/p4C3/P1P5P/4P1PC1/4K3H/9/RHEA1AE1R b", "i1-h1"],
      ["c1e1k2hr/5r3/8e/2p6/pC4p2/4p3P/PcP1P1P2/E5R1E/3HK4/R2A1A1H1 b", "f1-b1"],
      ["rhea1ke2/5c3/5ah1r/p1p1p1p2/2P5p/4C3P/P3P1PC1/R2A4E/1c7/1HEAKHR2 r", "a7-b7"],
      ["2eaka2r/3c5/r1h3h2/3Cp1p2/p1p3e1p/5c2P/P1P1P1P1H/1C2E4/R3A4/1HE1KA2R r", "b9-a7"],
      ["rh1akae2/5C2r/c1c1e3h/p3p1p1p/2p6/9/P1P1P1P1P/2C5H/7R1/1HEAKAE1R r", "f1-f7"],
      ["1heaka2r/9/6h1e/p1p1p3p/6p2/4P4/PcP3PcP/E4r2E/3CH2CR/RH1AKA3 r", "a7-c9"],
      ["1heakaeh1/2c5r/9/p1p3p2/7rp/2P1C1P2/P3c2R1/E3C4/4A4/RH1K1AEH1 r", "h6-h4"],
      ["rh2kaehr/4a1c2/4eC1R1/p3p1p1p/2p6/9/P1P1P1P1P/RC7/9/2EK1AEH1 r", "h2-h1"],
      ["2Ca1a1hr/3h5/e3k4/p1p1p1p1p/6e2/P1P1P4/5c2P/4E3H/4CR1c1/RHEAKA3 b", "h8-e8"],
      ["1heakaehr/r8/5c3/4p1P1p/p1p6/1c7/P1P1P3P/7C1/R1C6/1HEAKAEHR r", "c6-c5"],
      ["r1ea1ae2/2c1k4/hc4h1r/p5p1p/2p6/4C1P2/P1P1P3P/4R4/7C1/1HEAKAEHR b", "c4-c5"],
      ["rheakae1r/9/6h2/2p1p2cp/p5p2/6E2/P1P1P1P1P/R1C2A1CR/9/1HEAKc1H1 b", "f9-d9"],
      ["2rhkaehr/9/3ae1c2/pC2p3p/2p3p2/4P3C/P1P3P1P/H6cE/R3K4/2EA1A1HR b", "h0-i2"],
      ["1h2ka1h1/r3a3r/e4c2e/p1p3p1p/9/P1P1P3P/3R1cP2/H6CE/4K1C2/2EA1A1HR b", "f2-e2"],
      ["rheakae1r/3c5/6h2/p1p1p1p1p/9/9/P1P1P2c1/6C1H/2H6/R1EAKAECR r", "i9-i8"],
      ["r1eakaehr/3C5/h7c/p1p1p1p2/8p/4P4/P1P3P1P/C2c5/4K4/RHEA1AEHR r", "d1-d4"],
      ["2e1ka1r1/r3h4/2hae2c1/p1p3p1p/4p4/2PC5/Pc2P1P1P/2H6/R3A1C2/2E1KAEHR r", "h9-i7"],
      ["rhea1a1h1/4k4/4e3r/2p1p1p2/p7p/P1P1P4/5cP1P/2H2c3/2C1K2C1/R1EA1AEHR r", "i9-i7"],
      ["rheakaehr/9/4c2c1/p1p1p1p1p/9/4P4/P1P3P1P/3C3C1/R8/1HEAKAEHR r", "g9-e7"],
      ["rhea1a1hr/4k4/2c1ec3/p1p1p1p1p/7C1/9/P1P1P1P1P/1C2E4/4A3R/RHEAK2H1 b", "h0-g2"],
      ["r1eakaeh1/1r7/hc1c5/p1p3p1p/4p4/P7P/2P1P1P2/4C2C1/4A4/RHE1KAEHR r", "e7-e4"],
      ["rheakaeh1/9/4c2cr/p3p1p1p/2p6/6C2/P1P1P1P1P/6C2/9/RHEAKAEHR b", "e2-e6"],
      ["r1eak3r/2h1a4/4e1c1h/1cp1p1p1p/p5C2/C6R1/P1P1P1P1P/2H6/9/2EAKAEHR r", "a5-a0"],
      ["rh1aka1h1/4r4/4e1c1e/p1p1p1p1p/9/9/P1P1P1P1P/H3E1C2/3KA3R/RC1A2EH1 r", "i8-h8"],
      ["rheakaehr/1c7/4c4/pCp1p3p/6p2/P3P4/2P3P1P/R1H5C/9/2EAKAEHR r", "b3-e3"],
      ["rh1aka1h1/c7r/e7c/2p1p1p1p/p5e2/P7P/R1P1P1P2/2C3H1C/8R/1HEAKAE2 b", "a4-a5"],
      ["rc1akaeh1/3r5/h3e2c1/p1p1p1p2/7Cp/9/P1P1P1P1P/1C2E1H2/R3A4/1H1AK1E1R r", "h4-h0"],
      ["rheak1eh1/8r/3a3c1/pCp1p1p1p/5c3/2E3P1P/P1P1P4/2C5E/R8/1H1AKA1HR b", "c3-c4"],
      ["1hea1aeh1/r3k4/2c2c2r/pCp1p1pC1/8p/9/P1P1P1P1P/4EA3/R8/1HE1KA1HR b", "e3-e4"],
      ["rheaka1hr/9/2c1e2c1/pC2p1p1p/2p6/9/P1P1P1P1P/3C5/6R2/RHEAKAEH1 b", "c4-c5"],
      ["rheaka1hr/1c7/8e/p1p1p1p1p/1C4cC1/9/P1P1P1P1P/8E/4A4/RHE1KA1HR b", "g4-f4"],
      ["rhea1a1c1/4kh2r/8e/p1p1p1p1p/2P6/P8/3cP1P1P/1C6E/4K2C1/RHEA1A1HR r", "c4-d4"],
      ["r1ea1a1hr/3k5/hc2e2c1/p1p3p1p/1C2p4/9/P1P1P1P1P/6C1R/9/RHEAKAEH1 b", "d1-e1"],
      ["rh1akaehr/9/4e4/p1p1p3p/6p2/4P4/P1P3PcP/R8/1cC4CR/1HEAKAEH1 b", "b8-b4"],
      ["r1ea1ae1r/4k4/c1h3c1h/p1p1p1p1p/9/9/P1P1P1P1P/2H3CC1/R8/2EAKAEHR r", "h7-h2"],
      ["rhe1ka1hr/9/c2a4e/4p2c1/pCp3pCp/2E6/P1P1P1P1P/9/3R5/RH1AKAEH1 r", "d8-d2"],
      ["rheakaeh1/9/c4c2r/p1p6/4p1p1p/1C6P/P1P1P1P2/5C3/4K3R/RHEA1AEH1 r", "f7-e7"],
      ["1heakaeh1/9/r4c1cr/p1p1p3p/6p2/4P4/P1P3P1P/E8/1C2C4/RH1AKAEHR b", "f2-e2"],
      ["1reak1ehr/5C3/h4acc1/6p1p/p3p4/2P5P/P3P1P2/8C/4A4/RHE1KAEHR r", "f1-d1"],
      ["rhea1a1hr/4k4/6c1e/p1p1p1p1p/8c/9/P1P1P1P1P/6CCH/4AR3/RHE1KAE2 r", "f8-f0"],
      ["rheaka1hr/9/2c5e/p1c3p1p/2p1p3P/CRP1P4/P5P2/H4CH2/9/2EAKAE1R b", "b0-a2"],
      ["rhea1aehr/4kC1c1/9/pCc1p1p1p/9/9/P1p1P1P1P/8E/4A3R/RHE1KA1H1 r", "f1-f5"],
      ["rheaka1hr/6c2/3c4e/2p3p1p/p2C5/4p1P2/P1P1P3P/H2AE1HC1/9/R1EAK3R b", "d2-e2"],
      ["rh1a1ae1r/3c1k1c1/6h2/p1p1p1p1p/2e6/P7P/2P1P1P2/H2C3C1/R3A4/2E1KAEHR r", "h7-e7"],
      ["rheakachr/9/7ce/pCp1p1p1P/9/9/P1P1P1P2/7CH/4K4/RHEA1AE1R r", "b3-e3"],
      ["r1e1kaehr/4a4/2h6/p1pcp1pCp/9/9/PcP1PHP1P/5C3/4A4/R1E1KAEHR r", "h9-g7"],
      ["C1eakaeh1/6r1r/1c7/p1p1p3p/9/2P3pcP/P3P1P2/CR6H/4K4/1HEA1AE1R b", "g1-b1"],
      ["1heaka1h1/r8/2c1e3r/p1p3pC1/4p3p/8P/P1P1c1P2/4C3R/R3H4/2EAKAEH1 r", "h9-g7"],
      ["1hcak1eh1/r3a4/e8/p1p1p1pcr/8p/P8/2P1P1P1P/EC7/2C1A3R/RH1AK1EH1 r", "a7-c9"],
      ["rhe1kae1r/4a4/6h2/2p1p1c1p/p8/6p2/PcP1P1P1P/2H3HCE/2C6/R1EAKA2R r", "a9-b9"],
      ["rheaka1hr/9/8e/pcp1p1p1p/7c1/8P/P1P1P1P2/6C1E/C8/RHEAKA1HR r", "b9-c7"],
      ["rhea1aehr/2c6/2c1k4/p1p5p/4p1p2/9/P1P1P1P1P/ECC6/9/RH1AKAEHR r", "c7-e7"],
      ["rheakaehr/4c4/9/p1p1p1p1p/9/2P5P/P3P1Pc1/4C1HC1/9/RHEAKAE1R b", "h0-g2"],
      ["r3kaehr/3ha4/4e4/pcp1p1p1p/5c3/4P4/P1P3P1P/1C1C5/4K4/RHEA1AEHR r", "h9-g7"],
      ["rhe1kaeh1/1C7/c4a2r/p1p1p1p1p/9/2P6/P3P1PCP/4E4/9/1R1AKAEHR r", "h9-g7"],
      ["rh2kaehr/4a4/e4c3/2p1p1pc1/p7p/5C3/P1P1P1P1P/9/7C1/RHEAKAEHR b", "h0-i2"],
      ["rCeaka1hr/7c1/4e4/2p1p1Cc1/p7p/4P4/P1P3P1P/4E3H/9/RHEAKA2R r", "b0-b5"],
      ["2eakaeh1/7r1/1chc4r/p1p1p1p1p/9/6P2/P1P1P3P/H1C5C/9/R1EAKAEHR r", "h9-g7"],
      ["rh2ka1hr/4a4/e4c2e/p1p1p1p1p/9/6Pc1/P1P1P3P/2CA4C/9/RHEAK1EHR b", "h0-g2"],
      ["r3kaehr/9/h2cea2c/p1p1p1p1p/2P6/9/P3P1P1P/1C7/1C2K4/RHEA1AEHR r", "c4-b4"],
      ["2eakaehr/r8/h3c4/p1p1p1C1p/9/9/P1P3P1P/2C1c4/R8/1HEAKAEHR b", "e7-e4"],
      ["1r1a1ae1r/4k4/4c3h/p3p1pcp/2p3e2/4P1P2/P1P5P/H1C6/9/R1EAKAEHR b", "e2-e5"],
      ["rheakaeh1/2r6/4c4/pcp1p1C1p/3C5/9/P1P1P1P1P/4E3H/R3A3R/1HE1KA3 r", "d4-g4"],
      ["rheakaehr/9/5c2c/p1p1p1p1p/9/9/P1P1P1P1P/EC4HC1/3HA4/1R2KAE1R r", "h7-h3"],
      ["1he1kaehr/rc2a4/8c/p1p3p1p/4pC3/8P/P1P1P1P2/R4CH2/4K4/1HEA1AE1R b", "b1-d1"],
      ["1h1a1aehr/r2k5/e3c2c1/p1p1C1p1p/9/6P2/P1P1P3P/9/H3A4/RCEAK1EHR b", "b0-c2"],
      ["2rakaeh1/cr7/e6c1/C3p3p/3h5/9/P1P1P1P1P/E4R1C1/9/1HEAKA1HR b", "a1-a3"],
      ["rh1aka1hr/9/1c2e3c/p1p1p1p1p/6e2/2P6/P3P1P1P/8C/1C1R5/RHEAKAEH1 b", "h0-f1"],
      ["1heakaehr/1C7/6r2/p5p2/2p1p2cp/2P2R3/P3P1P1P/C3K4/3R5/1HEA1AE2 r", "b1-b4"],
      ["rheakaehr/4c4/c8/4p1p1p/p1p6/P8/2P1P1P1P/3C5/R4C3/1HEAKAEHR b", "e1-e6"],
      ["1heak3r/4a4/rc2c1h2/p1p3p1p/4p1e2/P1P5P/2C1P1P2/E1HA4C/9/2RAK1EHR b", "e2-e6"],
      ["rh1ak2hr/4a4/2c1e3e/p1p3p2/4p2Cp/P8/2P3PcP/5C2R/R3K4/1HEA1AEH1 b", "h0-g2"],
      ["r2akaehr/3h5/3ce2c1/p3p3p/2p3p2/2P6/P3P1P1P/2C1C3R/9/RHEAKAEH1 b", "c4-c5"],
      ["rheaka1hr/9/3c3ce/p1p3p1p/9/4p1P2/P1P1P3P/C7E/1C2A4/RHEAK2HR b", "b0-a2"],
      ["rCea1aeh1/r3k4/5c1c1/p1p1p3p/6p2/P5P2/2P1P2CP/H1R5E/5H3/2EAKA2R b", "a0-b0"],
      ["rheakaehr/5c3/3c5/p1p1p1p1p/9/2C6/P1P1P1P1P/9/4C4/RHEAKAEHR b", "c0-e2"],
      ["rCeakaehr/9/1c7/p1p1p1p1p/9/9/P1P1P1P1P/1C7/4A2c1/RHE1KAEHR r", "i9-i8"],
      ["2eakaehr/9/h4c3/prp1p1p1p/8c/4P3P/P1P3P2/4C3R/3CA4/R1EAK1EH1 r", "i5-i4"],
      ["2eakae1r/7R1/c7h/pCp3p1p/4p4/P7P/2P1P1P2/3R5/4c4/1HEAKAEH1 b", "f0-e1"],
      ["r1eaka1hr/9/1ch6/p3p1p1p/1Cp3e2/4P4/P1P3P1P/4K2C1/4A4/RHE2AEHR r", "b4-b7"],
      ["1reak1ehr/4a4/5c3/p1p1p1p2/8p/9/PcP1P1P1P/4K4/4C4/RHEA1AEHR b", "h0-i2"],
      ["rheakaehr/9/4c2c1/pC2p1p1p/9/2p1P4/P1P3P1P/4K2C1/9/RHEA1AEHR b", "b0-c2"],
      ["1heCkae2/5r3/r2c2h2/p1p1p1p1p/C7R/9/P1P1P1P2/E8/4A4/RH2KAEH1 b", "a2-b2"],
      ["rheakaer1/9/1c1c5/2p1p1p1p/p8/4P3P/P1P3P2/C8/9/RHEAKAEHR b", "h0-h8"],
      ["rhea1aeC1/3k4r/9/p5p2/4P3p/5C3/P1P3P1P/H6c1/9/1REAKAEHR b", "h7-h1"],
      ["r1ek1a2r/9/1c1ce4/2p1p1p1p/9/p7P/2P1P1P2/H1R6/4A4/1REAK1EH1 b", "a0-a2"],
      ["rheakaehr/9/7c1/p1C1p1p1p/9/9/P1P1P1P1P/1C7/9/1REAKAEHR r", "b7-e7"],
      ["1he1ka1hr/4a4/r3e4/p1p1p1p1p/9/6c2/P1P1P3P/4C2C1/8R/RHEAKAEc1 r", "b9-c7"],
      ["r1eakaehr/9/h7c/p1C3p1p/1c2p4/9/P1P1P1P1P/E4C3/9/RH1AKAEHR r", "c3-c5"],
      ["rCeakaeh1/5r3/1C5c1/p1p1p1p1p/9/9/P1P1P1P1P/9/9/1REAKAEHR r", "b2-b5"],
      ["rhe1kaehr/4a4/1c7/p1p3p1p/4p4/4P4/P1P3P1P/3C5/9/RHEcKAEHR r", "e5-e4"],
      ["r1ea1aehr/4k4/h3c2c1/p1p1p1p1p/9/8P/P1P1P1P2/6CCR/9/RHEAKAEH1 r", "b9-c7"],
      ["rheakae1r/9/9/pcC1phCcp/9/9/P1P1P1P1P/6H2/9/RHEAKAE1R b", "b0-a2"],
      ["r2k1aeh1/9/1c2e3r/p1p1pcp1p/9/6P1P/P1P1P4/2C1E4/9/RHEAKA1HR b", "b2-d2"],
      ["rhe1kaehr/9/1c3a3/p1p1p1pcp/9/9/P1P1P1P1P/R1C4C1/9/1HEAKAEHR r", "a7-b7"],
      ["r2akaehr/3h5/1c7/p1p1p1p1p/2e6/9/P1P1P1PCP/HC7/9/R1EAKAER1 b", "b2-e2"],
      ["rheakae2/2c2C1cr/8h/C1p1p1p1p/9/9/P1P1P1P1P/9/3R5/1HEAKAER1 b", "h1-h3"],
      ["rheakaehr/9/9/2p3p2/p8/4C1P1p/P1c1P4/1C2E4/4A4/RHEAK2R1 b", "i5-h5"],
      ["rh1akaehr/9/1c2e2c1/p1p1p1p1p/9/2C6/P1P1P1P1P/HC7/4K4/R1EA1AEHR b", "i0-i1"],
      ["1heaR2hr/3k5/r3c3e/p1p1p1p2/8p/P8/2P1P1P1P/5c2H/3C5/RHEAKAE2 b", "d0-e1"],
      ["rheakaehr/9/1c7/pcp1p1p2/8p/9/P1P1P1P1P/C1H3C2/R7R/2EAKAEH1 r", "a6-a5"],
      ["rheakaehr/9/6c2/p3pCp1p/2p6/9/P1P1P1P1P/2H1C4/9/1REAKAEcR b", "h9-f9"],
      ["rheak1ehr/4a4/6c2/2p1p3p/p5p2/2P5P/P3P1c2/R3E1C2/4C4/1HEAKA1HR r", "i9-i6"],
      ["rh1akae2/9/4e3r/p1p1p3p/5cp1P/2P3P2/c3P3H/3A4C/7C1/RHEAK1E1R b", "a6-i6"],
      ["rheakaeh1/8r/1c7/p1p1p1p1p/1C7/7C1/P1P1P1c1P/R7E/4A4/1HEAK2HR b", "b2-b9"],
      ["rh1akaehr/9/4e1c2/p1C4Cp/4p1p2/6P2/c1P1P3P/4E3H/4A4/RH1AK1E1R b", "a6-a4"],
      ["2e1kCe2/r6cr/9/2p5p/p2Cp1p2/2P6/P3c1P1P/2H6/9/R1EAKAEHR r", "c7-e6"],
      ["2eakaehr/9/rc7/pCp1p3p/6p2/4P1PR1/PCP5P/9/9/RHEAKAE2 b", "h0-g2"],
      ["rheC1a1r1/5k3/4e1hc1/p1pcp1p1p/9/9/PCP1P1P1P/E1H6/2R1A4/4KAEHR b", "f0-e1"],
      ["r1eakae1r/6h2/h3c4/p2cp1pC1/2p5p/9/P1P1P1P1P/6R2/1C7/RHEAKAEH1 r", "h3-e3"],
      ["r2akaeh1/9/c1C1e4/p1p1p4/1r4p1p/2P6/PC2P1P1c/E3E4/4A4/RH1A1K1HR b", "i6-e6"],
      ["rhea2eh1/5k3/c4a2r/4p3p/p5pc1/2p1C3P/P1P1P1P2/C3E4/R8/1HEAKA1HR r", "c6-c5"],
      ["2e2kehr/h3a3c/7r1/p1p1p1p2/5Cc1p/6E2/P1P1P1PCP/5A2H/9/RHEAK3R r", "i9-h9"],
      ["2eak2h1/r3a2cr/2h1e4/p1p1p1p1p/1c7/P5P2/2P1P3P/2C2C2H/4A4/RHE1KAE1R b", "b4-h4"],
      ["r1eaka1h1/8r/h7e/p1p4Cp/1c2p1p2/2P1P1c2/P5P1P/E6CH/9/RH1AKAER1 b", "g5-g9"],
      ["1he1ka1r1/4a4/r3e4/5hp2/p5C2/P1p6/2c1P1PcP/1R6E/4KC3/1HEA1A1HR b", "g3-g4"],
      ["rhc1kaehr/4a4/4e4/p3p1p1p/2p6/P4C1c1/2P1P1P1P/C3E4/4A4/RH2KAEHR b", "h5-a5"],
      ["r2akaehr/1c1h5/e8/p1p1p3p/6pc1/9/P1P1P1P1P/3C3CE/3K5/RHEA1A1HR r", "b9-c7"],
      ["r1eakaeh1/4h4/1c3c2r/p1p1p1p1p/9/4C4/P1P1P1P1P/R2C5/9/1HEAKAEHR r", "h9-g7"],
      ["rhcak1eh1/4a4/e5r2/p1p1p1p1p/1c7/9/P1P1P1P1P/2H2CC1H/8R/R1EAKAE2 b", "b0-c2"],
      ["1heakaehr/9/rc2c4/p1p1p1p1p/9/9/P1P1P1P1P/7C1/2C6/RHEAKAEHR r", "b9-c7"],
      ["1h1akaehr/9/r3e4/1c2p1pcp/p1p6/4C4/P1P1P1P1P/9/7C1/RHEAKAEHR b", "a2-d2"],
      ["1heaka2r/9/4c1hce/4p1pCp/p1p6/6C1P/PrP1P1P2/E8/2RH5/3AKAEHR b", "i0-g0"],
      ["rheaka1hr/9/2c4ce/p1p1p1p1p/9/4P4/P1P3P1P/2C3H1C/R3K4/1HEA1AE1R b", "h0-f1"],
      ["r1ea1a2r/4k4/1Ch1e2ch/p1p1p1p2/8p/2P6/P3P1c1P/1C7/H8/R1EAKAEHR b", "i2-h4"],
      ["rh1a1a2r/4k4/c4ch1e/p1p1C1pC1/2e6/8p/P1P1P1P1P/H3E4/R8/3AKAEHR b", "i0-h0"],
      ["r1eak4/4a2cr/c1h3h1e/p1p1p1p2/1C6p/P8/2PRP1P1P/6C2/4H3R/1HEAKAE2 r", "c6-c5"],
      ["rhe1kae1r/4a4/6cch/p1p1p3p/6p2/P8/2P1P1P1P/H4CHC1/9/R1EAKAE1R r", "g9-e7"],
      ["r1eaka1h1/4h4/c5r1e/p1C1p1p2/3c4p/P8/2P1P1P1P/EC6E/3H5/R2AKA1HR b", "g2-d2"],
      ["rheaka1hr/9/4e3c/2p1p1p1p/pc2P4/6P2/P1P5P/1CH3HCE/9/R1EAKA2R r", "e4-f4"],
      ["rhe1kae2/4a4/1cc1r3h/2p1pC2p/pC4p1P/4P1P2/P1P6/R7H/4A4/1HE1KAE1R r", "b9-c7"],
      ["r1ea1a2r/4kh3/h3ec1c1/p1p1p1p1p/1C7/8P/P1P1P1P2/4EC3/4H4/R1EAKA1HR b", "a0-b0"],
      ["rheaka1hr/6C2/4e4/p3p1p1p/2p6/c5P2/R1P1P3P/6C2/3cK4/1HEA1AEHR b", "a3-a4"],
      ["rheakaehr/2C6/4c4/p1p3p1p/4p4/9/P1P1P1P1P/HC3c3/8R/R1EAKAEH1 r", "i8-f8"],
      ["rh1akaehr/1C7/2c1e4/p3p1p1p/2p2c3/6P1P/P1P1P4/ECH6/9/2RAKAEHR b", "i0-i1"],
      ["r2aka1hr/9/echC4e/p1p3p1C/4p3p/2P6/P3P3P/E3E4/4KH3/RH1A1Ac1R b", "g9-d9"],
      ["rheakaeCr/9/9/p1p3p1p/2c6/4p4/P1PCP1P1P/5cH2/4A4/RHE1KAE1R r", "i9-h9"],
      ["1he1kae1r/4a4/r5h2/p1p1p1p1p/4C3P/4Pc3/P1P1H1P2/1c7/4A3C/R1EAK1EHR r", "e4-d4"],
      ["rh1a1aehr/4k4/e1c4C1/p3p3p/2p3p2/2E2c3/P1P1P1P1P/1RC6/9/1H1AKAEHR b", "i0-i2"],
      ["rhea1aehr/7c1/1c2k4/p1p1p1p1p/9/1CP4C1/P3P1P1P/H5H2/4K4/R1EA1AE1R b", "e2-e1"],
      ["rheakaeh1/9/1c2c1r2/p1p1p4/1C5Cp/2P3p1P/P3P1P2/E2A4E/3H5/R2AK2HR r", "g6-g5"],
      ["rhe1kaehr/4a4/3c5/2p1p1p1p/p5c2/7C1/P1P1P1P1P/R6C1/8R/1HEAKAEH1 b", "b0-a2"],
      ["2eakaehr/r3c4/h8/p1p1p1p1p/9/2Ec5/P1P1P1P1P/4C2CR/9/RHEAKA1H1 b", "e1-e6"],
      ["rhea1ae1r/4k4/c6C1/p1p1p1p2/8p/c5P2/PCP1P3P/E8/3H5/R2AKAEHR b", "i0-h0"],
      ["r1eakaeh1/9/h6cr/p1p1p1p1p/6P2/4c2C1/P1P1P3P/1C7/4A4/RHEAK1EHR r", "h5-i5"],
      ["rheakhe1r/4a4/5c3/p3p1p1p/2p4c1/4P3P/PHP3P2/6C2/8C/R1EAKAEHR b", "b0-c2"],
      ["rhe1kaehr/4a4/c5c2/2p1p1p1p/p8/8P/P1P1P1P2/H2C3CE/9/R1EAKA1HR r", "a9-b9"],
      ["rheak2hr/4a4/5c3/2p1p1p1p/p5e2/8P/P1P1P1P2/C2c2H1E/6C2/RHEAKA2R r", "g6-g5"],
      ["rhe1ka1hr/9/c4a2e/pcp3p2/4p2Cp/2P3E2/P3P1P1P/H5H2/8C/R1EAKAR2 b", "h0-f1"],
      ["r2a1aecr/h3k4/4e3h/p1p1p1p1p/9/1cP5P/P1C1P1P1R/5C3/9/RHEAKAEH1 b", "e1-e0"],
      ["2eakaehr/h2C4c/r8/p1p1p1p1p/9/8P/PcP1P1P2/EC7/9/RH1AKAEHR r", "h9-g7"],
      ["rheakae1r/9/c3c3h/p1p1pCp1p/9/2P6/P3P1P1P/7CR/9/RHEAKAEH1 r", "b9-c7"],
      ["1heakaehr/r8/c8/pCp1p1p1p/9/2E6/PCP1P1P1P/9/2R4c1/1H1AKAEHR b", "h8-h4"],
      ["r1ehkaehr/4a4/6c2/p1p1p1p1p/9/P3P4/1cP3P1P/H1C3C2/9/R1EAKAEHR r", "a7-b5"],
      ["rheakae1r/2c6/8h/p1p1p1p1p/9/2c6/P1P1P1P1P/C7C/5R1R1/1HEAKAEH1 r", "c6-c5"],
      ["rheakae1r/8c/1c7/p1p1h1p1p/1C1Pp4/6P2/P3P3P/7C1/5K3/RHEA1AEHR b", "e4-e5"],
      ["rheaka1hr/9/4e4/p1p1p1p1p/9/4P4/P1P3P1P/3c1CHCR/Rc7/1HEAKAE2 b", "d7-g7"],
      ["r1eakae1r/9/2h1c1h2/2p1p1pcp/p8/P5P2/2P1P1C1P/E4C3/9/RH1AKAEHR b", "e2-e6"],
      ["rheakaehr/9/8c/2p1p3p/p5p2/7C1/P1P1P1P1P/1c7/6C2/RHEAKAEHR r", "h5-b5"],
      ["r1ea1aehr/4k4/2hc5/p1pcp1p1p/9/9/P1P3P1P/EC7/4AC3/RH2KAEHR b", "e3-e4"],
      ["1reakae1r/7c1/cCh5h/p3p4/2p3p1p/9/P1P1P1P1P/3C5/R8/1HEAKAEHR r", "a8-b8"],
      ["r1ea1ae1r/4k1c2/2h5h/p1p1p1p1p/7c1/P7P/H1PCP1PC1/6H2/4K4/R1EA1AE1R b", "a3-a4"],
      ["r1eakaehr/9/2h6/p1p1p1p1p/9/9/P1PcP1PCP/1c4H2/7C1/RHEAKAE1R r", "g7-e8"],
      ["1hea1aehr/7C1/4k1c2/p1p1p1p1p/9/8P/P1P1P1P2/1c2E4/4K3C/RHEA1A1HR r", "b9-c7"],
      ["rhe1kaehr/4a4/1c2c4/p1p1p3p/6p2/P8/2P1P1P1P/E3C2CE/R8/1H1AKA1HR r", "h9-f8"],
      ["rheakaeh1/9/2c4r1/p3p1p1p/2p6/6P2/P1P1c3P/2C1EA3/4A2C1/RHE2K1HR r", "c7-c8"],
      ["1heakaehr/r8/1cc6/p1p3p1p/4p4/4P4/P1P3P1P/1C2E4/4A2C1/RHE1KA1HR b", "e4-e5"],
      ["rh1akae1r/4h4/4e4/p1p1p2cp/9/P4p2P/2P1P1P2/4C2CH/9/RcEAKAE1R b", "b9-b6"],
      ["rheak1e2/9/3c1ah1r/pcp1p1p1p/9/2P2C2P/P3P1P2/HC7/4A4/R1EAK1EHR b", "g3-g4"],
      ["rceakaehr/1C7/2hc3C1/p1p1p1p1p/9/9/P1P1P1P1P/9/R8/1HEAKAEHR b", "b0-b9"],
      ["1heakaeCr/3r5/2c6/p1p1p3p/6p2/4P4/P1P3P1P/EC6E/4R4/3AKA1HR r", "e8-h8"],
      ["1heak1e2/rc2a4/9/p1p1p1p1p/5r3/c7P/P1P1P1P2/4C3H/4K4/RHEA1AE1R r", "i7-h5"],
      ["rheakaehr/9/6c2/p1p1p1p2/7Cp/P2c5/2P1P1P1P/7C1/9/RHEAKAEHR b", "b0-c2"],
      ["1heaka1hr/r8/1c6e/p1p1p1pcp/1C5C1/9/P1P1P1P1P/2H5E/3R5/R1EAKA1H1 r", "b4-b0"],
      ["1CeakaeCr/r8/7c1/2p3p1p/p3p4/2P6/P3P1P1P/4E4/1c7/RHEAKA1HR r", "h0-f0"],
      ["r1eakaehr/9/2c3c2/p1p3p2/4p3p/9/P1P1P1P1P/E5C2/1C4H2/RH1AKAE1R b", "a0-b0"],
      ["rh1akae1r/9/e7h/p1p1p1p1p/9/6P2/P1P1c3P/7CE/1C7/RHEAKA1R1 b", "b0-c2"],
      ["rheakaehr/9/1C7/p1p3p2/4C2c1/9/c1P1P1P1P/6H2/9/RHEAKAE1R b", "g3-g4"],
      ["1heakaeh1/9/r2c4r/p1p5p/4p1p2/P1C3E2/2P1P1P1P/E5C2/9/2RAKA1HR b", "c0-e2"],
      ["r1eakaeh1/7c1/h8/p1p1C1p2/6c2/9/P1P1P1P1R/4E4/5C3/RHEAKA1H1 b", "a0-b0"],
      ["r1e1k3C/6c2/h2ae4/P5p1p/2p1p4/9/2P1P1P1P/1c4H2/4A4/RHE1KAE1R r", "g6-g5"],
      ["rheak1ehr/4a4/2c6/p1p1p1p1p/9/9/PCP1P1PCP/9/9/RHEAKAEcR b", "c2-h2"],
      ["r1eakaehr/9/2h6/p2cp1p1p/2p6/1C4P2/P1P1P3P/E1C1E4/8H/1R1AKA2R b", "a0-b0"],
      ["rheakaehr/9/8c/p1p1p1p1p/9/9/P1P1P1P1P/6CCR/4A4/RHE2KE2 b", "h0-g2"],
      ["rheakaehr/9/5c1C1/p1p1p1p1p/9/P8/2P1P1P1P/1C7/7c1/RHEAKAE1R r", "i9-h9"],
      ["C4aehr/4k1cR1/9/p1p1C1p1p/2e6/9/P1P1P1P1P/H8/9/R1EAKAE2 r", "a9-b9"],
      ["1h2kaehr/6r2/e4a1c1/p1p1C1p1p/9/1C7/P1P1P1P1P/8H/8R/R1E1KcE2 b", "g1-d1"],
      ["rheakaeCr/9/9/pcp1p1p1p/1C7/9/P1P1P1P1P/R8/7c1/1HEAKAEHR r", "h0-h7"],
      ["1heakaeh1/r8/8r/pcp1p1p1p/9/9/P1P1c1P1P/8E/2C1K2C1/RHEA1A1HR r", "b9-c7"],
      ["rheCka2r/3c1h3/2c5e/p3C1p1p/2p6/8P/P1P1P1P2/E8/8R/RH1AKAEH1 r", "d0-b0"],
      ["r1C2a3/4k2r1/9/p1p1p1p2/8p/4P4/P1P3P1P/Ec6H/4K4/RH1A1AEcR b", "h1-h8"],
      ["rheakaeh1/8r/9/p1p1p1p2/8p/5c3/P3P1P1P/E2C4H/6Cc1/RH1AKAE1R r", "i9-h9"],
      ["1r1akaehr/9/ecc6/p1p1p1pCp/9/9/P1P1P1P1P/2H6/9/R1EAKAEHR r", "h3-e3"],
      ["rheakaehr/9/1c7/p1p1p1C1p/5c3/6P2/P1P1P3P/7C1/9/RHEAK1E1R r", "b9-c7"],
      ["rhea1a1hr/4k4/4e4/p1p3p1p/2P1p4/c8/4P1PcP/2C3H2/1CR6/RHEAKAE2 b", "a3-a4"],
      ["2ea2R2/r3hk3/4c4/p1C1p1p1p/9/9/P1P1P1P1c/8E/9/RHEAK4 b", "i6-e6"],
      ["rhe1kae1r/9/9/2p1p1p2/p7p/2P3E1c/P3P1P2/1C6R/9/3RKAEH1 b", "b0-c2"],
      ["r1e1kae2/4a4/1c4h1r/p1p1h1p1p/4P4/3c5/P1P3P1P/3C3CE/4A4/RHE1KA1HR b", "d5-e5"],
      ["2ek4r/r3a4/1c2e3h/p1p1p3p/6p2/P3P4/2PC2P1P/9/9/RHEA1KE1R r", "b9-c7"],
      ["r2akaeh1/8r/hc2e2C1/p1p1p1p1p/9/P3P4/2P3P1P/RCH6/9/2EA1KE1R b", "b2-h2"],
      ["rhea1a1h1/5k3/7ce/p1pc2p1r/8p/P1C3E2/2P1P1P1P/1C7/4A4/R3K1EHR r", "i9-i7"],
      ["rheakaehr/9/9/p1p1p1p1p/9/PC7/R1P1PcP1P/5A3/7C1/1HE1KAER1 b", "h0-g2"],
      ["rCeakaeC1/9/8r/p1p1p1p1p/9/2P6/P3P1P1P/9/1c1K4c/RHEA1AEHR r", "b0-b3"],
      ["2eakaehr/7C1/9/prp3p1p/9/1c5c1/P1P1P1P1P/4E4/9/RHEAKA1HR r", "h1-f1"],
      ["c2akae1r/9/e5C1h/p1pcp1p1p/9/P1P6/1r2PHP1P/9/9/RHEAKAE1R r", "i9-i7"],
      ["rh1akaeh1/9/e6cr/p5p1p/1Cp1p4/9/P1c1P1P1P/5C2E/3R5/RHEAKA1H1 b", "c4-c5"],
      ["1crak1e1r/9/5a3/p1p1p1p1p/9/P1P5P/4PcP2/H3E4/3R5/R2AKAEH1 r", "d8-f8"],
      ["rheak1ehr/4a4/1c4c2/p3p1p2/2p5p/4P4/P1P3P1P/5CC2/4K4/RHEA1AEHR r", "e8-e9"],
      ["1heakaehr/r8/9/p1p1p1p1p/1c7/P8/R1P1P1P1P/E4C1c1/1C7/4KAEHR r", "i9-i7"],
      ["1heakaehr/9/9/r1p1p1p1p/pC7/7c1/P1P1P1P1P/7C1/9/1REAKAEHR r", "b4-h4"],
      ["r3kaehc/9/h3ea1C1/p3p1p1p/2p6/9/P1P1P1P1c/H6R1/9/R1EAKAEH1 r", "h9-g7"],
      ["r1eakaehr/9/1c7/p1p1p1p1p/9/9/P1P1P1PcP/1C5C1/R8/1HEAKAEHR b", "h6-e6"],
      ["rheakaer1/9/1c7/p1p1p1p2/8p/9/P1P1P1P1P/1C6E/9/1REAKA1HR r", "b7-e7"],
      ["rcea1aehr/4k2C1/2h6/p1p3p1p/4p4/6P2/P1P5P/8E/2C1c4/R1EAKA1HR r", "f9-e8"],
      ["rheakaeC1/7c1/r8/pC2p1p1p/2p6/1c2P4/P1P3P1P/9/4A4/R1EAK1EHR r", "h9-g7"],
      ["rh1a2e2/4ak3/e5hc1/p1pC2p2/9/9/P1P1P1P1R/9/R3K4/2Ec1AEH1 b", "d9-g9"],
      ["rhea1Reh1/1C2k4/2c5r/p1pCp1p1p/9/9/P1P1P1P1P/R7H/9/2E1KcE2 b", "f9-f1"],
      ["rh3aeh1/2c1k4/e2a1c2r/pCp1p3p/3P2p2/P7P/2P3P2/E2C5/4A4/RH2KAEHR b", "e3-e4"],
      ["rheakaeh1/8r/9/p1p1p1p2/8p/P3P4/2P3P1P/1C3C3/8c/RcEAKAEHR r", "i9-i8"],
      ["1heakaer1/r6c1/1c4h2/p3p1p1p/2p2C3/9/P1P1P1P1P/R3C4/4K4/1HEA1AEHR b", "a1-f1"],
      ["r2akae1r/3h5/e7c/p1p1h1p1p/9/P2p2P2/2P1P3P/1cH1E4/C2CA4/R3KAEHR b", "a0-b0"],
      ["2eak1ehr/r3a4/h5cc1/2p1p1p2/p6Cp/5C3/P1P1P1P1P/3A4E/9/RHEAK2HR b", "h0-i2"],
      ["rh1aka1h1/9/e3e1cc1/p3p1p1p/2p6/9/P1P1PrP1P/C6CE/4AHR2/RHEAK4 b", "h0-i2"],
      ["r1eaka1hr/9/2h1c2ce/4p1p1p/p8/1Cp5P/P1P1P1P2/4E4/4A2CR/RH2KAEH1 r", "c6-c5"],
      ["2ea1a1h1/r3k4/1ch3c2/p1p1p1p1p/6er1/2P1P4/PC4P1P/2H5H/3C5/R1EAKAE1R r", "b6-c6"],
      ["rheakaehr/9/5c3/p3p1p1p/2p6/9/P1P1P1P1P/4C1C2/R3A4/1HEA1KEHR b", "b0-c2"],
      ["rheaka1h1/2r6/5c1ce/p1p1p3p/6p2/9/P1P1P1P1P/4CC2E/9/RHEAKA1HR b", "h0-g2"],
      ["1hea1aeh1/r3k4/4c1c1r/p1p1p1p1p/9/7C1/P1P1P1P1P/3C2H1R/4A4/RHE1KAE2 r", "i7-h7"],
      ["rheakaehr/7c1/9/pCp3p1p/4p4/9/P1P1P1P1P/2H4cC/5K3/R1EA1AEHR r", "h9-g7"],
      ["rh1akaeh1/9/2r1e4/p1pCp1p2/7cp/1C2P1P1P/P1P2c3/E1R1E3H/9/RH1AKA3 r", "i5-i4"],
      ["1h1akae2/4C4/e5h1r/p1p5p/4p4/6p1R/P1P1c1P1P/3r5/8C/2EAKAEHR b", "d0-e1"],
      ["r1eak2hr/4a4/3c4e/4p1p1p/p1p6/4P4/P1P3P1P/4C4/4K4/RHEA1AEcR r", "i9-h9"],
      ["r1eakaeCr/6c2/h8/2p1p1p2/p7p/9/P1P1P1P1c/8H/1C5R1/RHEAKAE2 r", "a9-a7"],
      ["r1eaka2r/9/h2h4e/p1p1p2Cp/6pc1/2P6/Pc2P1P1P/1C2R3E/4A4/RHE1KA1H1 r", "e7-h7"],
      ["1heak3r/4a2c1/4c4/p1p1p1C1p/3r5/2P5P/P3P1h2/R1C1E4/4A4/1HE1KA1HR r", "h9-i7"],
      ["r1eaka1hr/9/3Ce4/p1p1p1p1p/9/9/P1P1P1PcP/Hc5C1/9/R1EAKAEHR b", "a0-a2"],
      ["r1eaka1hr/9/1ch5e/p1p1p3p/6p2/7c1/PCP1P1P1P/C8/4K4/RHEA1AEHR r", "h9-g7"],
      ["1h1akaehr/2r6/e2c1c3/p1p1p1p1p/9/9/P1P1P1P1P/2C1EA3/1C7/RH2KAEHR b", "h0-g2"],
      ["rheakaehr/9/1c5Cc/2p1C1p1p/p8/9/P1P1P1P1P/E5H2/9/RH1AKAE1R b", "h0-g2"],
      ["rheaka2r/1c7/8h/pCp1p1pcp/2e6/6P1P/P1P1P4/R3E3C/3K4R/1H1A1AEH1 b", "b1-b9"],
      ["rheakaehr/9/7c1/2p1p1p2/p7p/6P2/P1P1P3P/E3C2C1/1c6R/RH1AKAEH1 r", "i8-b8"],
      ["r1eakae2/1c2h4/h6cr/p1p1p1p1p/9/C1P6/P3P1P1P/6C2/4K4/RHEA1AEHR r", "e8-e9"],
      ["rheakaeh1/r8/c8/p1p1p1p1p/9/2C5P/PCc1P1P2/4E4/R8/1HEAKA1HR b", "c3-c4"],
      ["rh1akaehr/9/4e4/pcp1p1p1C/9/7c1/P1P1P1P1P/C8/8R/RHEAKAEH1 r", "a7-i7"],
      ["rheakaer1/9/2c6/2p1p1pcp/p8/9/P1P1P1P1P/EC7/4A4/RH2KAEHR r", "h9-g7"],
      ["1hea5/4k4/r3e3r/p1p1p1p1p/9/1c7/P1P1P1P1P/1C5c1/4A3C/RHEAK1EHR r", "b7-b0"],
      ["rheCk1e2/7c1/6r2/p1p3p1p/9/4p4/P1P1P1P1P/1c4C2/R8/2EAKAEHR r", "d0-d7"],
      ["r1eakaehr/4c4/2h6/p1p1p1p1p/1C7/9/P1P1c1P1P/2H3C2/9/R1EAKAEHR b", "e6-e5"],
      ["1Ceakaehr/9/r1c6/p1p1p1p1p/9/1cP6/P3P1P1P/5C2H/9/RHEAKAE1R b", "b5-b1"],
      ["r1eakCe2/4c4/3c4r/p1p1p1p1p/1C7/9/P1P1P1P1P/9/9/RHEAKAEHR b", "e1-e6"],
      ["rh1akaer1/9/7c1/p1p1C1p2/2e6/9/P1P1c1P1P/H8/8R/R1EAKAEH1 b", "e6-e4"],
      ["rhe1kaehr/4a4/9/p1p1p1pc1/8p/2P2CP2/P3P3P/9/1C7/1REAKAE1R r", "i9-h9"],
      ["rheakaeh1/9/8r/p1pcp1p1p/9/P1P6/4P1P1P/2C3C1H/1c7/R1EAKAE1R r", "a9-b9"],
      ["1hea1aehr/4k4/rc3c3/p1p1p1p2/8p/9/P1P1P1P1P/2C1E4/3H5/R2AKAEHR b", "c0-e2"],
      ["rCeakaeh1/8r/7c1/p1p1p1p1p/9/1c7/P1P1P1P1P/6HC1/4A4/RHE1KAE1R r", "b0-d0"],
      ["rCeak4/4ah3/4e1r2/pcp1p1p1p/7c1/P1P1P3P/6P2/8C/5R3/RHEAKAEH1 b", "a0-b0"],
      ["1hea1aer1/4k4/rc6c/2p1p1p1p/P8/6P2/2P1P1C1P/R8/4A4/1HE1KAEHR b", "h0-h8"],
      ["rheakaeh1/8r/2c5c/p1p1p1pCp/9/9/P1P1P1P1P/1CH6/4K3R/R1EA1AEH1 r", "h3-e3"],
      ["rheakae1r/9/6h2/pcp1p3p/6p2/8P/P1P1P1Pc1/1C5CE/9/RHEAKA1HR b", "h6-i6"],
      ["r1eaka1hr/9/2h1e4/2p1p3p/p2c2p2/2P5P/Pc2P1P2/ECH5C/4KR3/R2A1AEH1 b", "h0-g2"],
      ["rheakaehr/9/9/p1p1p3p/1c4p2/9/P1P1P1P1P/E1C2C2H/c8/RH1AKAE1R b", "a8-a6"],
      ["1heaka1hr/5r3/c7e/pcp1p1p1p/9/9/P1P1P1P1P/C1H3C2/3R5/1HEAKAE1R b", "a2-e2"],
      ["r1ea1aehr/4k4/hc2c4/p1p1p3p/6p2/P8/2P1P1P1P/H3C4/9/R1EAKAEHR r", "e7-e3"],
      ["2eaka1hr/r3c4/h6ce/p1p1p1p2/8p/9/P1P1P1P1P/E2CC1H1E/4A4/RH2KA2R r", "i9-h9"],
      ["rheakaehr/9/9/p1p1p1p1p/1c7/9/P1P1P1P1P/1C3C2H/9/RHEAKAEcR b", "h9-h6"],
      ["rheakaehr/7c1/9/p1p1p1p1p/c8/9/P1P1P1P1P/H2C1C3/9/R1EAKAEHR r", "h9-g7"],
      ["rheakaehr/9/3c5/p1p1p1p1p/9/7c1/P1P1P1P1P/3C3C1/9/RHEAKAEHR r", "g6-g5"],
      ["1hea1a1hr/1c2k4/r4c2e/p1p1p1p1p/9/9/P1P1P1P1P/2H1C4/6C1R/R1EAKAEH1 r", "g8-b8"],
      ["r1eaka2r/9/2h4Ce/p1p1p1pcp/9/1c6P/P1P1P1P2/1C6R/9/RHEAKAEH1 r", "i7-h7"],
      ["rhea1a1hr/4k4/4eC3/p3p1p1p/2pC3c1/P5P2/1cP1P3P/H7H/9/R1EAKAE1R b", "b6-e6"],
      ["rh1akaehr/9/e1c4C1/p1p1p3p/6pc1/9/P1P1P1P1P/2C6/4A4/RHEAK1EHR b", "i0-i2"],
      ["1h1akaehr/9/rc2e4/p1pC4p/4p1p2/P5P2/2P1P3P/R1H3C2/6c2/2EAKAEHR b", "g8-g5"],
      ["rheakaeh1/4c4/1c6r/p1p3p1p/4p4/9/P1P1PCP1P/1C7/4A4/RHE1KAEHR r", "h9-i7"],
      ["1heakae2/2r6/6h1r/p1p1p1p1p/3c5/4P3P/P1P3P2/E2C3cC/9/RH1AKAEHR r", "h9-g7"],
      ["2eakaehr/2r6/hc4c2/p1p1p4/6p1p/4PC3/P1P3P1P/3C5/9/RHEAKAEHR r", "f9-e8"],
      ["rh1aka1hr/2c6/ec2e4/p1p1p1p1p/4C4/9/P1P1P1P1P/1CH3H2/9/R1EAKAE1R r", "e4-e5"],
      ["rheakaehr/7c1/2c6/p1p1p1p1p/9/9/P1P1P1P1P/5CHC1/4A3R/RHE1KAE2 b", "h1-g1"],
      ["rhe1kae1r/1c1C5/5a2h/p1p1p1p1p/7c1/9/P1P1P1P1P/2H1E1C2/7R1/R2AKAEH1 b", "i0-h0"],
      ["rheak1ehr/4a1C2/6c2/p1p3p2/4p3p/9/P1P1c1P1P/H4C3/9/1REAKAEHR r", "h9-g7"],
      ["rheakaehr/9/c8/p1p1p1p1p/2c6/9/P1P1PCP1P/3CE1R2/9/RH1AKAE2 r", "a9-a8"],
      ["r1eakaehr/9/h6c1/pcp1p1p2/8p/9/P1P1P1P1P/6C2/5C3/RHEAKAEHR r", "b9-c7"],
      ["rh1a1aeR1/4k4/e6cr/p3p1p1p/2p3c2/6P2/P1P1P3P/E3C2CE/R3A4/1H1AK2H1 r", "g5-g4"],
      ["rh2ka1h1/4a3r/e3c3e/pCp3p1p/4p4/9/P1P1P1P1P/H4A1C1/3R1c3/2E1KAEHR b", "e4-e5"],
      ["rheakaehr/9/7c1/p1p1p3p/6p2/P1P6/1c2P1P1P/C6C1/9/RHEAKAEHR b", "b0-c2"],
      ["rheakaehr/9/9/p1p1p1p1p/1c7/9/P1P1P1P1P/E1C3C2/7c1/RH1AKAEHR r", "i9-i8"],
      ["rheakaeh1/2c6/1c6r/p1p1p1p1p/9/6P1P/P1P1P4/3C3C1/9/RHEAKAEHR b", "a3-a4"],
      ["rheakaehr/9/1c5C1/p3p1p1p/2p6/9/PCP1P1P1P/3c5/8R/RHEAKAEH1 b", "h0-i2"],
      ["1heakaehr/1C7/r8/p1p1p1p2/8p/6P2/P1PCP3P/1c1cE4/9/R1EAKA1HR r", "b1-b6"],
      ["rheakaehr/2c6/c8/p1p1p1p1p/1C7/9/P1P1P1PCP/4E4/9/RH1AKAEHR b", "b0-c2"],
      ["rh1a1a1hr/4k4/ec2e2c1/p1p3pCp/4p4/9/P1P1P1P1P/9/2C2K3/RHEA1AEHR b", "b2-b8"],
      ["1heakaehr/r8/9/p3p3p/1cp3p2/P5P2/2P1c3P/E1C2C2E/9/RH1AKA1HR b", "c4-c5"],
      ["rhe1kaeh1/4a4/1c6r/p1pc2p2/4p3p/2P6/P3P1P1P/R1C3H1C/9/1HEAKAE1R b", "i2-f2"],
      ["rh1akaeh1/3r5/e2C5/p1p1p3p/6p2/P5P1P/2P1P1c2/1C4H1E/4Ac3/RHE1KA2R r", "d2-d9"],
      ["r1eakaeh1/9/2h5r/pcp1p1p1p/9/2E3P2/P1P1P1C1P/9/1C3c3/RHEAKA1HR b", "f8-f4"],
      ["r1eak1e1r/4a4/8h/p1p3pcp/1C2p4/9/P1P1P1P1P/R3K4/1c2A3C/1HEA2EHR b", "a0-b0"],
      ["1heakaeCr/r8/1c7/pC2p1p1p/2p6/7c1/P1P1P1P1P/9/9/RHEAKAEHR r", "h0-f0"],
      ["2eak1eh1/3ra4/hc3r3/p1p3p1p/6P2/4p4/PCP1P3P/2C3H1R/7c1/RHEAKAE2 b", "d1-d8"],
      ["r1e1kaeh1/4ac3/hr7/p3p1p1p/9/2p5P/P1P1P1P2/C3EC3/1c2R4/RHEAKA1H1 r", "a7-b7"],
      ["rheak2Cr/4a4/1c2e4/p1pcp1p1p/9/6P2/P1P1P3P/6C2/9/RHEAKAEHR r", "h0-h8"],
      ["1heakaeh1/8r/rc7/p1p6/4p1pCp/6P2/P1P1P3P/c1CA2H2/8R/RHE1KAE2 r", "h4-e4"],
      ["1heakaehr/7r1/9/p1p1p1p1p/1c7/9/PCP1P1PcP/R1HC5/9/2EAKAEHR r", "c9-e7"],
      ["rheakaehr/9/9/pCp1p1p1p/9/9/P1PcP1P1P/2C1E3R/5H3/RcEAKA3 b", "b9-b4"],
      ["rhea1aeh1/4k4/1c4c1r/p1p1p1p1p/6P2/2P6/P2CP3P/8C/4A4/RHEAK1EHR b", "g3-g4"],
      ["rhea1aeCr/4k4/5c3/pcp1p1p1p/2C6/9/P1P1P1P1P/4E3R/4K4/RHEA1A1H1 b", "i0-h0"],
      ["r1ea1aehr/4k4/2h3c2/pcp1p1p1p/9/9/P1P1P1P1P/2C5E/7C1/RHEAKA1HR b", "g2-e2"],
      ["rhe1kae1r/4aC3/2c4ch/p1p1p1C1p/9/4P4/P1P3P1P/2H6/9/R1EAKAEHR b", "h2-f2"],
      ["1he1kaehr/4a4/rc7/p1p1p1p1p/9/7C1/P1P1P1P1P/C8/4A4/RHE1KAEcR r", "h5-a5"],
      ["1Ceakaehr/9/r2c3c1/2p1p1p2/p6Cp/P8/2P1P1P1P/9/8R/RHEAKAEH1 r", "h4-d4"],
      ["rh1akaeh1/1C7/1c2e1c1r/p1p1p1p2/8p/6P2/P1P1P3P/H2C2H2/8R/R1EAKAE2 b", "g3-g4"],
      ["rh1akae1r/9/e5h2/p1p1p1p1p/9/P3c4/2PHPcP1P/ECHC5/4A3R/3AK1E1R b", "f6-d6"],
      ["rh1aka1hr/9/ec6e/p1p1p1pc1/9/8p/P1P1P1P1P/1C6H/R3A3R/1HEAKCE2 r", "i8-h8"],
      ["rhe1kaeh1/1c2a3r/8c/p1pC2p1p/4p4/9/P1P1P1P1P/6HC1/R3A3R/1HEAK1E2 r", "g6-g5"],
      ["2eaka1hr/4c2r1/C1c5e/p1p1p1p1p/9/2P3P1P/P3P4/H3C3R/9/R1EAKAEH1 b", "c0-a2"],
      ["rheakaehr/7c1/9/p5p1p/1Cp1p4/9/P1P1P1P1P/4E3c/1R2A4/1HE1KACHR b", "e4-e5"],
      ["rce1kaeh1/9/2h2ac2/p3p1p1r/2p5p/2E5P/PCP1P1P2/4EHC2/8R/R2AKA1H1 b", "i3-h3"],
      ["1ceaka1hr/rC7/4e4/h3p1pcp/p4C3/2p6/P1P1P1P1P/R8/9/1HEAKAEHR r", "b1-b3"],
      ["r1eakae1r/h3h4/cc7/p3p1p2/2p5p/2PC5/P3P1PCP/E7R/4K4/RH1A1AEH1 r", "c5-c4"],
      ["1he1kaehr/4a4/r6c1/p1p3p1p/4p2C1/4c1P2/P1P1P3P/H3E1C2/9/R2AKAEHR b", "e5-d5"],
      ["2rakaeh1/3h4r/1c2e2c1/pCp1p1p1p/9/2P3P2/P3P3P/6C2/4K4/RHEA1AEHR b", "i1-f1"],
      ["rheakaehr/9/7c1/p1p5p/6pC1/4p3P/PcP1P1P2/RC6E/4K4/1HEA1A1HR b", "e5-e6"],
      ["rheakaehr/9/5c3/p1p3p1p/4p4/7cP/P1P1P1P2/1C4C2/9/RHEAKAEHR r", "b7-e7"],
      ["r1eakaehr/4c4/hc7/p1p1p1p1p/6P2/9/P1P1P3P/C3C3R/R8/1HEAKAEH1 r", "g4-g3"],
      ["rheakaehr/9/1c7/p1p1p1p1p/3c5/9/P1P1P1P1P/HC4C2/R3K4/2EA1AEHR b", "b2-e2"],
      ["rheakaehr/9/9/p1p1p1p1p/9/C8/PCPcP1PcP/R8/4K4/1HEA1AEHR b", "b0-a2"],
      ["rh1a2ehr/4a4/ec2k4/p1pC2p1p/4p4/9/P1P1P1P1P/1C5c1/4A4/RHEAK1EHR b", "h0-g2"],
      ["1heakaehr/9/rc7/p1p1p1p1p/1C2c4/2P6/P3P1P1P/H6CE/R3A4/2E1KA1HR b", "b2-e2"],
      ["1hea1aehr/4k2r1/c8/p1p1p3p/6p2/P1C2c3/2P1P1P1P/7CE/R3H4/1HEAKA2R r", "h7-e7"],
      ["rheaka1h1/8r/1c5ce/p1p1p3p/3C2p2/7C1/P1P1P1P1P/9/9/RHEAKAEHR b", "h2-e2"],
      ["rh2ka1hr/4a4/e3c3e/p1p1p3p/6p2/2C3P1P/P1P1Pc3/H3RC3/4A4/2E1KAEHR b", "g4-g5"],
      ["1heakaehr/r3c4/7c1/p1p1p1pCp/9/P8/2P1PCP1P/9/4K4/RHEA1AEHR b", "e1-e6"],
      ["rh1a1ae1r/5k3/1c2e3h/4p1C1p/p1p6/4c4/P1P1P1P1P/4E4/4K2C1/RHEA1A1HR r", "e6-e5"],
      ["rh1akae2/8r/c3e1c1h/p1p3p1p/1C7/2P1p1P2/P7P/H2RE4/1C7/R1EAKA1H1 r", "a9-b9"],
      ["1he1kae1r/r3a4/1c4h2/p1pCp1p1p/7c1/9/P1P1P1P1P/4E2C1/9/RHEAKA1HR r", "d3-g3"],
      ["rh1akaeh1/8r/1c2e2c1/p1p1p1p2/8p/2P6/P3P1P1P/EC3C3/9/RH1AKAEHR r", "b9-c7"],
      ["rhek1a1hr/4a4/2c5e/pcp1p1pCp/9/2P6/P3P1P1P/R1C6/9/1HEAKAEHR r", "a7-b7"],
      ["rhe1kaehr/1c2a4/9/p1p3p1p/4p4/9/P1c1P1P1P/6C2/4AC3/RHEAK1EHR r", "b9-a7"],
      ["rheakaeh1/9/cC6r/p1p1p1p2/7cp/9/P1P1P1P1P/R2C4R/9/1HEAKAEH1 r", "a7-b7"],
      ["rh1aka1hr/9/e1c5e/pcp1p1p1p/2C6/9/P1P1P1P1P/2H3HC1/4K4/R1EA1AE1R b", "c3-c4"],
      ["1reakae1r/9/h5cRh/2p1p1p1p/p8/P8/4P1P1P/9/2c5C/1HEAKAEHR b", "g2-c2"],
      ["1hea1ae1r/3k5/r1c3h2/p1p1p1p1p/9/9/P1P1P1PcP/C3E1C1H/4A4/RHE1KA2R b", "c3-c4"],
      ["1heakaehr/9/r6c1/1c2p1p1p/p1p6/9/P1P1P1P1P/1CH3C2/3KA4/R1E2AEHR b", "a2-d2"],
      ["rCeakaehr/9/7c1/p1p1p1p1p/9/8P/PcP1P1P2/7C1/9/RHEAKAEHR r", "b0-d0"],
      ["1Ceakae1r/9/r5h2/p1p1p1p1p/9/Pc7/2P1P1P1P/9/7CR/RHEAKAEc1 r", "h8-h2"],
      ["1heakaeh1/r8/1Cc5r/p1p1p1p1p/9/6P2/P1P5P/8H/1CR1c4/RHEAKAE2 r", "d9-e8"],
      ["r1eakaehr/9/c1h6/p1p1p1p2/8p/6P2/P1P1c3P/8C/2H1K1C2/R1EA1AEHR r", "h9-g7"],
      ["rheakaehr/9/2c6/p1p1p1p1p/9/P3P1P2/2P4cP/3CE3C/3H5/R2AKAE1R r", "i9-h9"],
      ["rheak2hr/4a4/2c5e/p1p3p1P/4p4/9/P1P1PCP2/9/3C5/RHEAKAEcR b", "h0-g2"],
      ["1heakaehr/6r2/7c1/p1p1p1p2/3C4p/9/PcP1P1P1P/1C7/9/RHEAKAEHR r", "h9-g7"],
      ["r1e1kaeh1/4a4/1ch5r/pCp1p1p1p/9/7cP/P1P1P1P2/E5H1C/9/RH1AKAE1R b", "g3-g4"],
      ["rhe1kae1r/1c2a4/c5h2/p1p1p1p2/8p/8P/P1P1P1P2/R1C2C2E/9/1HEAKA1HR b", "b1-b6"],
      ["1heakaehr/r4c3/9/p1p3p1p/9/4p4/P1PC2PcP/E3EC3/3R5/1H1AKA1HR b", "h6-h2"],
      ["rh1a1aehr/4k4/1c2ec3/p1p3p1p/3Cp4/9/P1P1P1P1P/2H6/7C1/R1EAKAEHR r", "e6-e5"],
      ["r1eakaehr/9/1ch6/p3p1p1p/2p6/7c1/P3P1P1P/1CH3C2/9/R1EAKAEHR b", "c4-c5"],
      ["rheaka1hr/9/1c5ce/p1p1p1p1p/9/P8/2P1P1P1P/2H1C2C1/9/R1EAKAEHR r", "e7-e3"],
      ["rheakaeh1/8r/5c1c1/2p1p3p/p5p2/9/P1P1P1P1P/1CH4CH/1R2A4/2EAK1E1R b", "h0-g2"],
      ["rh1akaehr/6c2/4e4/p1p1p1p1p/4C4/1c3C2P/P1P1P1P2/H8/9/R1EAKAEHR r", "a9-b9"],
      ["rh1akaer1/9/e6ch/p1p1p1p1p/9/P1P3PC1/4P3P/Rc1CE4/4A4/1H1AK1EHR b", "h2-f2"],
      ["rheaka1hr/9/3c3ce/p1p1p1p1p/9/P8/2P1P1P1P/1C4HC1/4A4/RHEAK1E1R b", "b0-c2"],
      ["rheakaeCr/9/2c6/3Cp1pc1/8p/p3P4/P1P3P1P/H8/9/R1EAKAEHR r", "h0-f0"],
      ["1heakaehr/9/r6c1/p1p1p1p1p/1c7/9/P1P1P1P1P/EC1C5/4K4/RH1A1AEHR b", "a2-d2"],
      ["2ea1aehr/r3k4/h5cC1/6pCp/2p1p4/p8/2P1P1P1P/4E3R/4K4/1HEA1A1HR b", "i0-i2"],
      ["r1eakae1r/9/h4c1ch/p1p1p1p1p/9/P6C1/1CP1P1P1P/8H/4A4/RHEAK1E1R b", "a0-b0"],
      ["rheakaehr/7c1/2c6/pCp1p1p1p/8P/9/P1P1P1P2/3C4H/9/RHEAKAE1R b", "c3-c4"],
      ["rheak1e1r/4a4/2c5h/p1p1p2Cp/6p2/Pc7/2P1P1P1P/R2C5/9/1HEAKAEHR r", "a7-b7"],
      ["rCeaka2r/9/4e3h/p1p1p1p1p/Pc5c1/4P4/2P3P1P/H8/7C1/R1EAKAEHR b", "b4-g4"],
      ["r1eak1ehr/4a4/1ch6/p1p1p2cp/6p2/9/P1P1P1P1P/1CC5R/R3A4/1HE1KAEH1 r", "b9-a7"],
      ["1hea1aehr/9/4k2c1/p1p1p1p1p/1r1c5/6PCP/PCP1P4/2H1E4/4K4/R2A1AEHR r", "a9-b9"],
      ["r1eak1ehr/4a4/1C5c1/p1p1p1p1p/2P6/6P2/P7P/4c2C1/9/RHEAKAEHR b", "e7-e5"],
      ["rheakaeCr/9/1c2c4/p3p1p2/2p5p/9/P1P1P1P1P/1C7/9/RHEAKAEHR r", "h0-f0"],
      ["rheakaeh1/8r/7c1/pcp1p1p1p/9/9/P1P1P1P1P/1C2C3R/R8/1HEAKAEH1 b", "h2-e2"],
      ["rheakaehr/1C5c1/9/p1p1p1C1p/9/Pc7/2P1P1P1P/4E3H/9/RHEAKA2R b", "b5-b2"],
      ["rh1ak1ehr/4a4/1c2e2c1/C1p1p1p2/8p/9/P1P1P1P1P/5C3/9/RHEAKAEHR r", "f7-a7"],
      ["rh1ak1ehr/9/1c1ae2c1/p1p1p1p1p/9/5C3/P1P1P1P1P/4C4/4K4/RHEA1AEHR b", "d2-e1"],
      ["1heakaehr/9/6cCc/p1p1p1p1p/7R1/9/PrP1P1P1P/2H5E/4K4/RCEA1A1H1 r", "b9-b0"],
      ["1heakaehr/9/1c1c5/p1p1C1p2/8p/4P4/P1P3P1P/6Hr1/9/RHEAKAE1R r", "g7-e6"],
      ["2ea1aehr/3rk4/h3c2c1/p1p1p1p1p/6C2/9/P1P1P1PCP/8E/8R/RHEAKA1H1 r", "g4-g0"],
      ["2eakaehr/r8/1ch6/p1p1pC1Cp/9/6P2/P1P1P3P/9/4K4/RHEA1cEHR r", "e8-e9"],
      ["rhea1a2r/4k4/4e3h/pCp3p1p/4p4/P5P2/2P1P3P/2C6/9/RHEAKAEcc r", "c7-c3"],
      ["rh1aka1hr/9/ec2e2c1/p1p5p/4p1p2/2P4C1/P3P1P1P/9/4C4/RHEAKAEHR b", "h0-f1"],
      ["r3kae1r/3ha4/e6ch/p1p1p1p1p/7C1/P8/2P1P1P1P/R7C/3c5/1HEAKAEHR r", "a7-d7"],
      ["rheakaeh1/9/2c5r/p3p1p1p/8P/2p5R/P1P1P1P2/1C5C1/4K4/RHEA1AEc1 r", "e8-e9"],
      ["r1eakaehr/9/hc7/p1p1p1p1p/4P2c1/9/P1P3P1P/4E2CR/1C7/RH1AKAEH1 b", "h4-i4"],
      ["3aka1hr/r7c/2h1e2ce/p1p3p1p/4p4/9/P1P1P1P1P/3AC1C1R/2R6/1HEAK1EH1 r", "e7-e4"],
      ["r1eakaehr/9/h3c2c1/p1p1p1p1p/9/9/P1P1P1P1P/H6C1/1C7/R1EAKAEHR b", "e2-e6"],
      ["rhea1aeh1/2r1k4/9/p1p1p1p1p/7c1/2E6/P1P1PCPCP/1c7/9/RHEAKA1HR b", "h0-g2"],
      ["rheaka1h1/9/c3e3c/p1pCp1p2/5r2p/9/P1P1P1P1P/H3C4/R3A3R/2E1KAEH1 r", "d3-a3"],
      ["rh1akaehr/9/1c1ce4/p1p1p1p1p/9/7C1/P1P1P1P1P/3C5/9/RHEAKAEHR b", "h0-g2"],
      ["rheakCe2/1C7/c7r/p1p1p1p1p/9/6P2/P1c1P3P/E7H/9/RH1AKAE1R b", "a2-a6"],
      ["1hea1aer1/r2k5/6cc1/2p3p1p/4C4/P8/2P1P1P1P/4R4/9/1HEAKAEHR b", "h2-i2"],
      ["2eakaehr/9/rC1c5/p1p1p1p1p/9/2P5P/P3P1PC1/9/1c7/RHEAKAEHR r", "b2-b6"],
      ["rCeakaehr/9/c8/p1p1p1p1p/9/9/P1P1P1P1P/H6C1/9/R1EAKAEcR r", "a9-b9"],
      ["rhea1ae2/4k2r1/9/p1p1p4/6p1p/Pc2c1P2/2P5P/RC4H2/9/1HEAKAE1R r", "i9-h9"],
      ["r2aka1hr/9/1c6e/2p1p1pCp/p1e6/P8/2P1P1P1P/4E3E/7R1/RH1AKA3 r", "h3-e3"],
      ["rheakaeh1/5C2r/1c5C1/p1p1p1p1p/9/9/P1P1c1P1P/8E/9/RHEAKA1HR b", "b2-b4"],
      ["rheakae2/1c2r4/6h2/p1C1p1p1p/9/P8/2P1P1P1P/H7C/8R/R1EAKcE2 b", "f9-d9"],
      ["rCea1a1cr/4k4/4e1h2/p1p1p1pCp/9/P5P2/1cP1P3P/4E4/9/RH1AKAEHR r", "b0-b2"],
      ["1h1akaeh1/4r3r/4e4/pCp1p1p1p/5C3/9/P1P1P1P1P/9/R3K4/1cEA1AEcR r", "b3-e3"],
      ["rCeaka1hr/9/1c2ec3/p1p1p1p1p/9/9/P1P1P1P1P/7C1/4K4/RHEA1AEHR r", "h7-b7"],
      ["rheakaeh1/9/7cr/p1p1p1pCp/1c7/9/P1P1P1P1P/1C7/4K4/RHEA1AEHR r", "h3-e3"]
    ];

    for (const [fen, expected] of cases) {
      const result = await backend.chooseMove(parseFen(fen), {
        useBook: false,
        depth: 6,
        timeLimitMs: 1000
      });
      assert.equal(moveToNotation(result.bestMove), expected);
      assert.ok(result.nodes > 0);
    }
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

test("local C++ searchmoves scratch memory resets between probes", (t) => {
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
    "go depth 3 searchmoves b0c2",
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
  const rootTtHits = [...result.stdout.matchAll(/\broottt\s+(\d+)/g)].map((match) => Number(match[1]));
  const rootTtStores = [...result.stdout.matchAll(/\brootttstores\s+(\d+)/g)].map((match) => Number(match[1]));
  const bestMoves = [...result.stdout.matchAll(/\bbestmove\s+([a-i][0-9][a-i][0-9]|0000)\b/g)].map((match) => match[1]);

  assert.deepEqual(ages, [1, 1, 1], result.stdout);
  assert.deepEqual(rootTtHits, [0, 0, 0], result.stdout);
  assert.deepEqual(rootTtStores.slice(0, 2), [0, 0], result.stdout);
  assert.ok(rootTtStores[2] >= 1, result.stdout);
  assert.deepEqual(bestMoves, ["h2e2", "b0c2", "b2c2"], result.stdout);
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

test("local C++ engine uses the last protocol move for root recapture ordering", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position fen r2k5/9/9/9/9/9/9/9/PR7/4K4 b moves a9a1",
    "go depth 1",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\brecorder [1-9]\d*\b/);
  assert.match(result.stdout, /\bbestmove b1a1\b/);
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
    "go depth 7",
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
  assert.match(result.stdout, /\broothrboost [1-9]\d*\b/);
  const rootReductions = [...result.stdout.matchAll(/\brootred (\d+)\//g)].map((match) => Number(match[1]));
  const rootReductionPlies = [...result.stdout.matchAll(/\brootredply (\d+)/g)].map((match) => Number(match[1]));
  assert.ok(rootReductionPlies.at(-1) > rootReductions.at(-1), result.stdout);
  assert.match(result.stdout, /\bbestmove [a-i][0-9][a-i][0-9]\b/);
});

test("local C++ engine reduces late bad root captures conservatively", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "setoption name MultiPV value 5",
    "position fen 4k4/9/4r4/9/9/4p4/9/9/9/3KR4 r",
    "go depth 6",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\binfo multipv 5\b/);
  assert.match(result.stdout, /\brootsee [1-9]\d*\b/);
  assert.match(result.stdout, /\brootred [1-9]\d*\/\d+\b/);
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
    startupTimeoutMs: 3000,
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

test("local C++ engine recognizes discovered horse-leg checks from diagonal blockers", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position fen 9/2HP5/4k4/9/9/9/9/9/9/3K5 r",
    "go depth 3",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\bbestmove d8d9\b/);
  assert.match(result.stdout, /\bscore cp 9999[0-9]\b/);
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
  assert.match(result.stdout, /\bqsee [1-9]\d*\b/);
  assert.match(result.stdout, /\bqseepf [1-9]\d*\b/);
  assert.match(result.stdout, /\bsee3 [1-9]\d*\b/);
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
  assert.match(result.stdout, /\bqsee [1-9]\d*\b/);
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

test("local C++ engine avoids capture-risk probes for qsearch ordering", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position fen 4k4/9/9/9/4r4/9/4P4/9/9/R3K4 r",
    "go depth 1",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\bqnodes [1-9]\d*\b/);
  assert.match(result.stdout, /\bqcapstores [1-9]\d*\b/);
  assert.match(result.stdout, /\bcrisk 0\/0\b/);
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
  assert.match(result.stdout, /\bbestmove [a-i][0-9][a-i][0-9]\b/);
});

test("local C++ engine guards depth-four late-move pruning with history", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position startpos",
    "go depth 6",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\blmp4 [1-9]\d*\b/);
  assert.match(result.stdout, /\blmp [1-9]\d*\b/);
  assert.match(result.stdout, /\bbestmove [a-i][0-9][a-i][0-9]\b/);
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
  assert.match(result.stdout, /\bfch \d+\b/);
  assert.match(result.stdout, /\bfchstores \d+\b/);
  assert.match(result.stdout, /\bfchred \d+\b/);
  assert.match(result.stdout, /\bfchredm \d+\b/);
  assert.match(result.stdout, /\bqsee [1-9]\d*\b/);
  assert.match(result.stdout, /\bpv [^\n]*\be3e6\b/);
  assert.match(result.stdout, /\bbestmove [a-i][0-9][a-i][0-9]\b/);
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

test("local C++ engine seeds deep cut nodes with internal iterative deepening", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position fen 2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r",
    "go depth 8",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\biidcut [1-9]\d*\b/);
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

test("local C++ engine guards null-move pruning in pawn-and-guard endgames", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position fen 4k4/9/9/9/4P4/9/9/9/4A4/3AKAE2 r",
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

test("local C++ engine clears own blockers from passed pawn lanes", async (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const scores = forcedSearchScores(build.output, "4k4/9/2R6/9/2P6/9/9/9/9/3K5 r", [
    "c7d7",
    "c7c6"
  ]);

  assert.ok(scores[0] >= scores[1] + 30, JSON.stringify(scores));
});

test("local C++ engine rewards uncontested passed pawn lanes", async (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const scores = staticEvalScores(build.output, [
    "4k4/9/9/5p3/3P5/9/9/9/9/3K5 r",
    "4k4/9/9/5p3/5P3/9/9/9/9/3K5 r"
  ]);

  assert.ok(scores[0] >= scores[1] + 24, JSON.stringify(scores));
});

test("local C++ engine rewards passed pawns ready to enter the palace", async (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const scores = staticEvalScores(build.output, [
    "4k4/9/9/4P4/9/9/9/9/9/3K5 r",
    "4k4/9/9/9/4P4/9/9/9/9/3K5 r"
  ]);

  assert.ok(scores[0] >= scores[1] + 32, JSON.stringify(scores));
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

test("local C++ engine extends quiet king-line pressure at the root", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position fen 4k4/9/4a4/9/9/R8/9/9/9/4K4 r",
    "go depth 2 searchmoves a4e4",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\bbestmove a4e4\b/);
  assert.match(result.stdout, /\bklineext [1-9]\d*\b/);
  assert.match(result.stdout, /\bext [1-9]\d*\b/);
});

test("local C++ engine orders quiet king-line pressure before ordinary quiets", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const input = [
    "uci",
    "position fen 4k4/9/4a4/9/9/R8/9/9/9/4K4 r",
    "go depth 1",
    "quit"
  ].join("\n");
  const result = spawnSync(build.output, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\bklineord [1-9]\d*\b/);
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

  assert.ok(scores[0] - scores[1] >= 8, scores.join(", "));
});

test("local C++ engine penalizes enemy control of palace escape squares", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const scores = staticEvalScores(build.output, [
    "4k4/9/9/9/9/9/9/3r5/9/4K4 r",
    "4k4/9/9/9/r8/9/9/9/9/4K4 r"
  ]);

  assert.ok(scores[1] >= scores[0] + 40, JSON.stringify(scores));
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

test("local C++ engine rewards intact advisor-elephant fortress shape", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const scores = staticEvalScores(build.output, [
    "4k4/9/9/9/9/4P4/9/9/9/2BAKAB2 r",
    "4k4/9/9/9/9/4P4/3A5/2B6/4A4/2B1K4 r"
  ]);

  assert.ok(scores[0] >= scores[1] + 14, JSON.stringify(scores));
});

test("local C++ engine rewards pawn-defended valuable pieces", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const scores = staticEvalScores(build.output, [
    "4k4/9/9/4r4/9/4R4/P8/9/9/4K4 r",
    "4k4/9/9/4r4/9/4R4/4P4/9/9/4K4 r"
  ]);

  assert.ok(scores[1] >= scores[0] + 45, JSON.stringify(scores));
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

test("local C++ engine rewards building cannon screen platforms", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const scores = forcedSearchScores(build.output, "3k5/9/9/9/4P4/9/9/9/3C5/4K4 r", [
    "d1e1",
    "d1d2"
  ]);

  assert.ok(scores[0] - scores[1] >= 12, scores.join(", "));
});

test("local C++ engine rewards cannon platforms against palace guards", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const scores = staticEvalScores(build.output, [
    "4k4/9/5a3/9/9/5P3/9/9/5C3/4K4 r",
    "4k4/9/3a5/9/9/5P3/9/9/5C3/4K4 r",
    "4k4/9/5b3/9/9/5P3/9/9/5C3/4K4 r",
    "4k4/9/3b5/9/9/5P3/9/9/5C3/4K4 r"
  ]);

  assert.ok(scores[0] >= scores[1] + 50, JSON.stringify(scores));
  assert.ok(scores[2] >= scores[3] + 45, JSON.stringify(scores));
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

test("local C++ engine rewards pressure against palace guards", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const scores = staticEvalScores(build.output, [
    "4k4/4a4/9/9/9/4R4/9/9/9/4K4 r",
    "4k4/4a4/9/9/9/R8/9/9/9/4K4 r"
  ]);

  assert.ok(scores[0] >= scores[1] + 90, JSON.stringify(scores));
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

test("local C++ engine rewards pressure on loose valuable pieces", (t) => {
  const build = buildNativeEngine();
  if (build.skip) {
    t.skip(build.skip);
    return;
  }

  const scores = staticEvalScores(build.output, [
    "4k4/9/9/9/4P4/5c3/3N5/9/9/4K4 r",
    "4k4/9/9/9/4P4/7c1/3N5/9/9/4K4 r"
  ]);

  assert.ok(scores[0] - scores[1] >= 60, JSON.stringify(scores));
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

function staticEvalScores(enginePath, fens) {
  const input = [
    "uci",
    ...fens.flatMap((fen) => [
      `position fen ${fen}`,
      "eval"
    ]),
    "quit"
  ].join("\n");
  const result = spawnSync(enginePath, {
    input,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  const scores = [...result.stdout.matchAll(/eval cp (-?\d+)/g)].map((match) => Number(match[1]));
  assert.equal(scores.length, fens.length, result.stdout);
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
