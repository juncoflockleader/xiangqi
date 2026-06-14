import test from "node:test";
import assert from "node:assert/strict";
import {
  createJavaScriptEngineBackend,
  createLearningEngineBackend,
  formatSparringReport,
  runSparringMatch
} from "../src/index.js";

const MOCK_UCCI_PATH = new URL("../fixtures/mock-ucci.mjs", import.meta.url);

test("sparring match runs bounded engine self-play with reasoning logs", async () => {
  const red = createJavaScriptEngineBackend({ id: "red-test", name: "Red Test", depth: 1, timeLimitMs: 100 });
  const black = createJavaScriptEngineBackend({ id: "black-test", name: "Black Test", depth: 1, timeLimitMs: 100 });
  const report = await runSparringMatch({ red, black }, {
    maxPlies: 4,
    searchOptions: { useBook: false, depth: 1, timeLimitMs: 100 }
  });
  const text = formatSparringReport(report);

  assert.equal(report.totalPlies, 4);
  assert.equal(report.stopReason, "max-plies");
  assert.equal(report.status.state, "playing");
  assert.equal(report.players.red.name, "Red Test");
  assert.equal(report.players.black.name, "Black Test");
  assert.equal(report.players.red.status.state, "primary");
  assert.ok(report.aggregate.nodes > 0);
  assert.ok(report.aggregate.nodesPerSecond >= 0);
  assert.equal(report.aggregate.sides.red.moves, 2);
  assert.equal(report.aggregate.sides.black.moves, 2);
  assert.ok(report.moves.every((move) => move.summary.includes(move.notation)));
  assert.ok(report.moves.every((move) => move.backendStatus.state === "primary"));
  assert.ok(text.includes("Sparring: Red Test (Red) vs Black Test (Black)"));
  assert.ok(text.includes("after 4 plies"));
});

test("sparring match records native score details for learning reports", async () => {
  const red = createLearningEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    profile: "native-uci",
    fallbackOnNativeError: false,
    depth: 3,
    timeLimitMs: 100,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    engineOptions: {
      MockMateWdl: true
    }
  });
  const black = createJavaScriptEngineBackend({ id: "black-test", name: "Black Test", depth: 1, timeLimitMs: 100 });

  try {
    const report = await runSparringMatch({ red, black }, {
      maxPlies: 1,
      searchOptions: { useBook: false, depth: 3, timeLimitMs: 100 }
    });

    assert.equal(report.totalPlies, 1);
    assert.equal(report.moves[0].scoreDetail.kind, "mate");
    assert.equal(report.moves[0].scoreDetail.text, "mate in 2");
    assert.equal(report.moves[0].wdl.text, "98% win, 2% draw, 0% loss");
    assert.ok(report.moves[0].summary.includes("mate in 2"));
  } finally {
    await red.close();
  }
});

test("sparring match preserves native candidate comparisons", async () => {
  const red = createLearningEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    profile: "native-uci",
    fallbackOnNativeError: false,
    depth: 3,
    timeLimitMs: 100,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000
  });
  const black = createJavaScriptEngineBackend({ id: "black-test", name: "Black Test", depth: 1, timeLimitMs: 100 });

  try {
    const report = await runSparringMatch({ red, black }, {
      maxPlies: 1,
      searchOptions: { useBook: false, depth: 3, timeLimitMs: 100, lines: 2 }
    });
    const text = formatSparringReport(report);

    assert.equal(report.totalPlies, 1);
    assert.equal(report.moves[0].comparison.bestMove, "h9-g7");
    assert.equal(report.moves[0].comparison.nextMove, "h7-e7");
    assert.equal(report.moves[0].alternatives.length, 2);
    assert.equal(report.moves[0].alternatives[1].move, "h7-e7");
    assert.equal(report.moves[0].alternatives[1].verdict, "playable");
    assert.ok(text.includes("Compare: Native MultiPV rates h9-g7 30 centipawns above the next candidate h7-e7."));
    assert.ok(text.includes("Alt 2: h7-e7: playable, +0.12"));
  } finally {
    await red.close();
  }
});

test("sparring match stops immediately on terminal initial positions", async () => {
  const report = await runSparringMatch(null, {
    initialFen: "3rkr3/9/9/9/9/9/9/9/9/4K4 r",
    maxPlies: 10
  });

  assert.equal(report.totalPlies, 0);
  assert.equal(report.status.state, "checkmate");
  assert.equal(report.stopReason, "checkmate");
  assert.equal(report.aggregate.nodes, 0);
});

test("sparring match validates player backends", async () => {
  await assert.rejects(
    () => runSparringMatch({ red: { chooseMove() {} }, black: { chooseMove() {}, play() {} } }),
    /red player is missing play/
  );
});

test("sparring match can use a referee backend to surface learning moments", async () => {
  const redBase = createJavaScriptEngineBackend({ id: "scripted-red-base", depth: 1, timeLimitMs: 100 });
  const red = createScriptedBackend(redBase, "a9-a8");
  const black = createJavaScriptEngineBackend({ id: "black-test", name: "Black Test", depth: 1, timeLimitMs: 100 });
  const referee = createJavaScriptEngineBackend({ id: "referee-test", name: "Referee Test", depth: 2, timeLimitMs: 300 });

  const report = await runSparringMatch({ red, black }, {
    referee,
    maxPlies: 1,
    searchOptions: { useBook: false, depth: 1, timeLimitMs: 100 },
    refereeOptions: {
      reviewOptions: { depth: 2, timeLimitMs: 300 }
    }
  });
  const text = formatSparringReport(report);

  assert.equal(report.totalPlies, 1);
  assert.equal(report.referee.name, "Referee Test");
  assert.ok(report.reviewElapsedMs >= 0);
  assert.equal(report.moves[0].refereeReview.classification, "blunder");
  assert.ok(report.moves[0].refereeReview.centipawnLoss > 0);
  assert.ok(report.learningMoments.length >= 1);
  assert.equal(report.learningMoments[0].ply, 1);
  assert.equal(report.learningMoments[0].player.name, "Scripted Test");
  assert.ok(text.includes("Referee: Referee Test"));
  assert.ok(text.includes("Learning moments:"));
});

test("sparring match validates referee backends", async () => {
  await assert.rejects(
    () => runSparringMatch(null, { referee: { reviewMove() {}, play() {} } }),
    /referee is missing openingBook/
  );
});

test("sparring match records hybrid backend fallback provenance", async () => {
  const red = createLearningEngineBackend({
    command: "/path/that/should/not/start",
    profile: "native-ucci",
    depth: 1,
    timeLimitMs: 100,
    startupTimeoutMs: 50,
    commandTimeoutMs: 50,
    javascript: {
      profile: "fast",
      depth: 1,
      timeLimitMs: 100
    }
  });
  const black = createJavaScriptEngineBackend({ id: "black-test", name: "Black Test", depth: 1, timeLimitMs: 100 });

  try {
    const report = await runSparringMatch({ red, black }, {
      maxPlies: 1,
      searchOptions: { useBook: false, depth: 1, timeLimitMs: 100 }
    });

    assert.equal(report.totalPlies, 1);
    assert.equal(report.aggregate.fallbackCount, 1);
    assert.equal(report.aggregate.sides.red.fallbackCount, 1);
    assert.equal(report.moves[0].backendStatus.state, "fallback");
    assert.equal(report.moves[0].backendFallback.fallbackBackend, "javascript-reference");
  } finally {
    await red.close();
  }
});

function createScriptedBackend(base, notation) {
  return {
    id: "scripted-test",
    name: "Scripted Test",
    kind: "scripted",
    features: base.features,
    chooseMove(position) {
      const move = base.legalMoves(position).find((candidate) => candidate.notation === notation);
      if (!move) return base.chooseMove(position, { useBook: false, depth: 1, timeLimitMs: 100 });

      return {
        bestMove: move,
        source: "scripted",
        score: 0,
        depth: 0,
        nodes: 0,
        principalVariation: [move],
        explanation: {
          summary: `Scripted Test chooses ${notation}.`,
          reasons: [`Scripted Test forces ${notation} for referee validation.`]
        }
      };
    },
    analyzePosition: (...args) => base.analyzePosition(...args),
    reviewMove: (...args) => base.reviewMove(...args),
    reviewGame: (...args) => base.reviewGame(...args),
    coachMove: (...args) => base.coachMove(...args),
    lessonPlan: (...args) => base.lessonPlan(...args),
    openingBook: (...args) => base.openingBook(...args),
    play: (...args) => base.play(...args),
    legalMoves: (...args) => base.legalMoves(...args)
  };
}
