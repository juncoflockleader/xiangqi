import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialPosition,
  createJavaScriptEngineBackend,
  createEngine,
  createOpeningBookFromRecords,
  createOracleReviewEngineBackend,
  createUcciEngineBackend,
  formatPositionStudy,
  INITIAL_FEN,
  parseFen,
  studyPositionWithBackend
} from "../src/index.js";

const MOCK_UCCI_PATH = new URL("../fixtures/mock-ucci.mjs", import.meta.url);

test("engine position study bundles decision, hints, candidates, and pressure", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const study = engine.studyPosition(createInitialPosition(), {
    lines: 2,
    depth: 1,
    timeLimitMs: 500
  });
  const text = formatPositionStudy(study);

  assert.equal(study.type, "position-study");
  assert.equal(study.side, "red");
  assert.equal(study.bestMove, "h7-e7");
  assert.equal(study.decision.bestMove, "h7-e7");
  assert.equal(study.decision.source, "opening-book");
  assert.equal(study.candidateLines.length, 2);
  assert.equal(study.hints.at(-1).kind, "reveal");
  assert.ok(Array.isArray(study.pressure.threats));
  assert.ok(study.nextSteps.length > 0);
  assert.match(text, /Position study: Red to move, best h7-e7/);
});

test("position study exposes Chinese learning notation and formatted report", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const study = engine.studyPosition(createInitialPosition(), {
    lines: 2,
    depth: 1,
    timeLimitMs: 500
  });
  const text = formatPositionStudy(study, { locale: "zh" });

  assert.equal(study.zhBestMove, "炮二平五");
  assert.equal(study.decision.zhBestMove, "炮二平五");
  assert.deepEqual(study.decision.zhPrincipalVariation, ["炮二平五"]);
  assert.equal(study.decision.linePlan.zhFirstMove, "炮二平五");
  assert.ok(study.decision.linePlan.zhSummary.includes("炮二平五"));
  assert.ok(study.decision.zhReasons.some((reason) => reason.includes("開局庫優先推薦 炮二平五")));
  assert.equal(typeof study.candidateLines[0].zhMove, "string");
  assert.equal(study.coach.zhBestMove, "炮二平五");
  assert.ok(study.coach.zhLevels[0].text.includes("炮二平五"));
  assert.equal(study.openingCandidates[0].zhMove, "炮二平五");
  assert.equal(typeof study.pressure.threats[0].zhSummary, "string");
  assert.ok(study.zhSummary.includes("炮二平五"));
  assert.ok(study.zhNextSteps.some((step) => step.text.includes("炮二平五")));
  assert.match(text, /局面研習：紅方走棋，最佳 炮二平五/);
  assert.match(text, /理由：/);
  assert.match(text, /開局方向/);
  assert.match(text, /製造威脅/);
  assert.match(text, /開局候選：/);
  assert.match(text, /候選著法：/);
});

test("position study separates opening candidates from search candidates", () => {
  const book = createOpeningBookFromRecords([
    {
      fen: INITIAL_FEN,
      move: "h9-g7",
      weight: 160,
      name: "Oracle Horse",
      idea: "Generated oracle book wants the horse developed before tactical drifting.",
      tags: ["oracle", "generated"],
      source: "Fixture Oracle",
      engineScore: 42
    },
    {
      fen: INITIAL_FEN,
      move: "h7-e7",
      weight: 120,
      name: "Oracle Cannon",
      idea: "A close central-cannon alternative from the same generated book.",
      tags: ["oracle", "alternative"],
      source: "Fixture Oracle",
      engineScore: 31
    }
  ], { aggregateRecords: true });
  const engine = createEngine({ book, depth: 1, timeLimitMs: 100 });
  const study = engine.studyPosition(createInitialPosition(), {
    depth: 1,
    timeLimitMs: 100,
    lines: 2
  });
  const text = formatPositionStudy(study);

  assert.equal(study.bestMove, "h9-g7");
  assert.equal(study.decision.source, "opening-book");
  assert.equal(study.openingCandidates.length, 2);
  assert.equal(study.openingCandidates[0].move, "h9-g7");
  assert.equal(study.openingCandidates[0].name, "Oracle Horse");
  assert.equal(study.openingCandidates[0].database.source, "Fixture Oracle");
  assert.equal(study.searchDisagreement.openingMove, "h9-g7");
  assert.equal(study.searchDisagreement.searchMove, "b7-b0");
  assert.equal(study.nextSteps[0].kind, "opening-search-check");
  assert.match(text, /Opening candidates:/);
  assert.match(text, /Search check: b7-b0 is the top search candidate, while h9-g7 is the opening-book choice\./);
  assert.match(text, /Plan: Start with h9-g7; theme: creates threat, answers threat\./);
});

test("position study can include a played move review", () => {
  const position = parseFen("4k4/9/4r4/9/9/9/9/9/9/3KR4 r");
  const engine = createEngine({ depth: 2, timeLimitMs: 1000 });
  const study = engine.studyPosition(position, {
    useBook: false,
    depth: 2,
    timeLimitMs: 1000,
    lines: 2,
    playedMove: "e9-f9"
  });
  const text = formatPositionStudy(study);

  assert.equal(study.bestMove, "e9-e2");
  assert.equal(study.playedMoveReview.move, "e9-f9");
  assert.equal(study.playedMoveReview.bestMove, "e9-e2");
  assert.equal(study.playedMoveReview.classification, "blunder");
  assert.ok(study.playedMoveReview.centipawnLoss > 1000);
  assert.equal(study.playedMoveReview.playedLinePlan.firstMove, "e9-f9");
  assert.equal(study.playedMoveReview.planComparison.playedMove, "e9-f9");
  assert.equal(study.nextSteps[0].kind, "correction");
  assert.equal(study.nextSteps[1].kind, "practice");
  assert.equal(study.practiceFocus.category, "missed-material");
  assert.equal(study.practiceFocus.title, "Material tactics");
  assert.equal(study.practiceFocus.drill, "candidate-captures");
  assert.equal(study.practiceFocus.move, "e9-f9");
  assert.equal(study.practiceFocus.bestMove, "e9-e2");
  assert.match(text, /Practice: Material tactics/);
  assert.match(text, /Plan comparison: Your plan starts with e9-f9/);
  assert.ok(study.summary.includes("e9-f9 is blunder"));
});

test("backend position study preserves oracle review evidence", async () => {
  const candidate = createJavaScriptEngineBackend({ depth: 1, timeLimitMs: 100 });
  const oracle = createUcciEngineBackend({
    name: "Mock Oracle",
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    profile: "native-ucci",
    depth: 2,
    timeLimitMs: 100,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000
  });
  const backend = createOracleReviewEngineBackend(candidate, oracle);

  try {
    const study = await studyPositionWithBackend(backend, createInitialPosition(), {
      depth: 1,
      timeLimitMs: 100,
      lines: 2,
      playedMove: "h7-e7"
    });

    assert.equal(study.decision.bestMove, "h7-e7");
    assert.equal(study.decision.oracleReview.bestMove, "h9-g7");
    assert.equal(study.oracleReview.bestMove, "h9-g7");
    assert.equal(study.playedMoveReview.reviewBackend.name, "Mock Oracle");
    assert.equal(study.playedMoveReview.oracleReview.bestMove, "h9-g7");
    assert.ok(study.summary.includes("h7-e7 is good"));
  } finally {
    await backend.close();
  }
});

test("backend position study turns oracle disagreement into a learning step", async () => {
  const candidate = createJavaScriptEngineBackend({ depth: 1, timeLimitMs: 100 });
  const oracle = createUcciEngineBackend({
    name: "Mock Oracle",
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    profile: "native-ucci",
    depth: 2,
    timeLimitMs: 100,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000
  });
  const backend = createOracleReviewEngineBackend(candidate, oracle);

  try {
    const study = await studyPositionWithBackend(backend, createInitialPosition(), {
      depth: 1,
      timeLimitMs: 100,
      lines: 2
    });
    const text = formatPositionStudy(study);

    assert.equal(study.bestMove, "h7-e7");
    assert.equal(study.oracleDisagreement.kind, "oracle-disagreement");
    assert.equal(study.oracleDisagreement.move, "h7-e7");
    assert.equal(study.oracleDisagreement.bestMove, "h9-g7");
    assert.equal(study.oracleDisagreement.classification, "good");
    assert.equal(study.oracleDisagreement.centipawnLoss, 59);
    assert.equal(study.oracleDisagreement.backend.name, "Mock Oracle");
    assert.equal(study.nextSteps[0].kind, "oracle-disagreement");
    assert.match(study.nextSteps[0].text, /Mock Oracle prefers h9-g7 over h7-e7/);
    assert.match(study.summary, /oracle prefers h9-g7 by 59 cp/);
    assert.match(text, /Oracle correction: h7-e7 trails h9-g7 by 59 cp \(good\)/);
  } finally {
    await backend.close();
  }
});

test("backend position study preserves native score details", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    profile: "native-uci",
    depth: 3,
    timeLimitMs: 100,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    engineOptions: {
      MockMateWdl: true
    }
  });

  try {
    const study = await studyPositionWithBackend(backend, createInitialPosition(), {
      useBook: false,
      depth: 3,
      timeLimitMs: 100,
      lines: 2
    });

    assert.equal(study.bestMove, "h9-g7");
    assert.equal(study.decision.scoreDetail.kind, "mate");
    assert.equal(study.decision.scoreDetail.text, "mate in 2");
    assert.equal(study.decision.scoreText, "mate in 2");
    assert.equal(study.decision.wdl.text, "98% win, 2% draw, 0% loss");
    assert.ok(study.decision.summary.includes("mate in 2"));
    assert.equal(study.candidateLines[0].scoreDetail.text, "mate in 2");
    assert.equal(study.candidateLines[0].scoreText, "mate in 2");
    assert.equal(study.candidateLines[0].wdl.text, "98% win, 2% draw, 0% loss");
    assert.equal(study.coach.scoreDetail.text, "mate in 2");
    assert.equal(study.coach.wdl.text, "98% win, 2% draw, 0% loss");
    assert.equal(study.coach.alternatives[0].scoreDetail.text, "mate in 2");
  } finally {
    await backend.close();
  }
});

test("backend position study preserves structured decision alternatives", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    profile: "native-uci",
    depth: 2,
    timeLimitMs: 100,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000
  });

  try {
    const study = await studyPositionWithBackend(backend, createInitialPosition(), {
      useBook: false,
      depth: 2,
      timeLimitMs: 100,
      lines: 2
    });
    const text = formatPositionStudy(study);

    assert.equal(study.decision.comparison.bestMove, "h9-g7");
    assert.equal(study.decision.comparison.nextMove, "h7-e7");
    assert.equal(study.decision.comparison.scoreGap, 30);
    assert.ok(study.decision.comparison.reason.includes("Native MultiPV rates h9-g7"));
    assert.equal(study.decision.alternatives.length, 2);
    assert.equal(study.decision.alternatives[0].move, "h9-g7");
    assert.equal(study.decision.alternatives[0].verdict, "best");
    assert.equal(study.decision.alternatives[0].scoreText, "+0.42");
    assert.equal(study.decision.alternatives[1].move, "h7-e7");
    assert.equal(study.decision.alternatives[1].verdict, "playable");
    assert.equal(study.decision.alternatives[1].planComparison.bestMove, "h9-g7");
    assert.equal(study.decision.alternatives[1].planComparison.playedMove, "h7-e7");
    assert.equal(study.decision.alternatives[1].planComparison.centipawnLoss, 30);
    assert.ok(study.decision.alternatives[1].reasons[0].includes("top native line"));
    assert.match(text, /Comparison: Native MultiPV rates h9-g7 30 centipawns/);
    assert.match(text, /Decision alternatives:/);
    assert.match(text, /Why not: This native line starts with h7-e7; the top native line starts with h9-g7/);
  } finally {
    await backend.close();
  }
});

test("backend position study preserves native ponder replies", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    profile: "native-uci",
    depth: 2,
    timeLimitMs: 100,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    engineOptions: {
      MockShortPvPonder: true
    }
  });

  try {
    const study = await studyPositionWithBackend(backend, createInitialPosition(), {
      useBook: false,
      depth: 2,
      timeLimitMs: 100,
      lines: 1
    });
    const text = formatPositionStudy(study);

    assert.equal(study.bestMove, "h9-g7");
    assert.equal(study.decision.ponderMove, "h0-g2");
    assert.deepEqual(study.decision.principalVariation, ["h9-g7", "h0-g2"]);
    assert.equal(study.decision.linePlan.expectedReply, "h0-g2");
    assert.equal(study.candidateLines[0].linePlan.expectedReply, "h0-g2");
    assert.match(text, /Plan: Start with h9-g7; expect h0-g2; theme: creates threat, answers threat\./);
  } finally {
    await backend.close();
  }
});

test("backend position study preserves played-move review alternatives", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    profile: "native-ucci",
    depth: 2,
    timeLimitMs: 100,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000
  });

  try {
    const study = await studyPositionWithBackend(backend, createInitialPosition(), {
      useBook: false,
      depth: 2,
      timeLimitMs: 100,
      lines: 2,
      playedMove: "h7-e7",
      reviewOptions: {
        lines: 2
      }
    });

    assert.equal(study.playedMoveReview.bestMove, "h9-g7");
    assert.equal(study.playedMoveReview.bestComparison.bestMove, "h9-g7");
    assert.equal(study.playedMoveReview.bestComparison.nextMove, "h7-e7");
    assert.equal(study.playedMoveReview.bestAlternatives.length, 2);
    assert.equal(study.playedMoveReview.bestAlternatives[1].move, "h7-e7");
    assert.equal(study.playedMoveReview.bestAlternatives[1].verdict, "playable");
    assert.equal(study.playedMoveReview.playedScoreText, "-0.17");
    assert.equal(study.playedMoveReview.playedLinePlan.firstMove, "h7-e7");
    assert.equal(study.playedMoveReview.playedLinePlan.expectedReply, "h0-g2");
    assert.equal(study.playedMoveReview.bestLinePlan.firstMove, "h9-g7");
    assert.equal(study.playedMoveReview.bestLinePlan.expectedReply, "h0-g2");
    assert.equal(study.playedMoveReview.planComparison.summary, "Your plan starts with h7-e7; the engine prefers h9-g7, a good gap of 59 centipawns. Both lines expect h0-g2.");
  } finally {
    await backend.close();
  }
});
