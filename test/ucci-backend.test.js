import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialPosition,
  createUcciEngineBackend,
  describeEngineBackend,
  ENGINE_BACKEND_FEATURES
} from "../src/index.js";

const MOCK_UCCI_PATH = new URL("../fixtures/mock-ucci.mjs", import.meta.url);

test("UCCI backend uses the explainable opening book before native search", async () => {
  const backend = createUcciEngineBackend({
    command: "/path/that/should/not/start",
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 100,
    commandTimeoutMs: 100
  });

  const result = await backend.chooseMove(createInitialPosition());

  assert.equal(result.source, "opening-book");
  assert.equal(result.bestMove.notation, "h7-e7");
  assert.equal(result.depth, 0);
  assert.equal(result.native.skipped, true);
  assert.ok(result.explanation.reasons.some((reason) => reason.includes("Opening book")));
  await backend.close();
});

test("UCCI backend validates and rejects unsafe opening heuristics with native search", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    engineOptions: {
      MockRejectHeuristic: true
    }
  });
  let position = createInitialPosition();
  for (const move of ["h7-e7", "h0-g2", "h9-g7", "g3-g4", "b9-c7", "i0-h0"]) {
    position = backend.play(position, move);
  }

  try {
    const raw = await backend.chooseMove(position, { validateOpeningHeuristics: false });
    const result = await backend.chooseMove(position, { lines: 2 });

    assert.equal(raw.source, "opening-heuristic");
    assert.equal(raw.bestMove.notation, "e7-e3");
    assert.equal(result.source, "native-ucci");
    assert.equal(result.bestMove.notation, "b7-b3");
    assert.equal(result.openingHeuristicValidation.status, "rejected");
    assert.equal(result.openingHeuristicValidation.source, "native-ucci");
    assert.equal(result.openingHeuristicValidation.heuristicMove, "e7-e3");
    assert.equal(result.openingHeuristicValidation.searchBestMove, "b7-b3");
    assert.ok(result.openingHeuristicValidation.centipawnLoss > result.openingHeuristicValidation.maxCentipawnLoss);
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("Rejected opening heuristic e7-e3")));
    assert.equal(result.explanation.search.openingHeuristicValidation.status, "rejected");
  } finally {
    await backend.close();
  }
});

test("UCCI backend searches through an external process", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000
  });

  try {
    const result = await backend.chooseMove(createInitialPosition(), { useBook: false });
    const description = describeEngineBackend(backend);

    assert.equal(backend.supports(ENGINE_BACKEND_FEATURES.NATIVE_READY), true);
    assert.equal(backend.supports(ENGINE_BACKEND_FEATURES.ASYNC_SEARCH), true);
    assert.equal(backend.supports(ENGINE_BACKEND_FEATURES.REVIEW), true);
    assert.equal(backend.supports(ENGINE_BACKEND_FEATURES.EXPLANATION), true);
    assert.equal(description.kind, "native-ucci");
    assert.equal(result.source, "native-ucci");
    assert.equal(result.bestMove.notation, "h9-g7");
    assert.equal(result.depth, 2);
    assert.equal(result.nodes, 123);
    assert.equal(result.principalVariation.map((move) => move.notation).join(" "), "h9-g7 h0-g2");
    assert.ok(result.explanation.summary.includes("Native UCCI Engine"));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("UCCI search")));
    assert.ok(result.explanation.confidence.score >= 0);
    assert.ok(result.explanation.confidence.factors.some((factor) => factor.kind === "depth"));
    assert.equal(result.explanation.linePlan.firstMove, "h9-g7");
    assert.equal(result.explanation.linePlan.expectedReply, "h0-g2");
  } finally {
    await backend.close();
  }
});

test("UCCI backend close resolves when native process already exited", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    closeTimeoutMs: 25,
    engineOptions: {
      MockExitAfterBestmove: true
    }
  });

  const result = await backend.chooseMove(createInitialPosition(), { useBook: false });
  await new Promise((resolve) => setTimeout(resolve, 25));

  assert.equal(result.bestMove.notation, "h9-g7");
  await backend.close();
});

test("UCCI backend close terminates native process that ignores quit", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    closeTimeoutMs: 25,
    engineOptions: {
      MockIgnoreQuit: true
    }
  });

  const result = await backend.chooseMove(createInitialPosition(), { useBook: false });

  assert.equal(result.bestMove.notation, "h9-g7");
  await backend.close();
});

test("UCCI backend applies native engine options before search", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    engineOptions: {
      Threads: 2,
      Hash: 64,
      UCI_ShowWDL: true
    }
  });

  try {
    const result = await backend.chooseMove(createInitialPosition(), { useBook: false });
    const description = describeEngineBackend(backend);

    assert.deepEqual(description.nativeOptions, [
      { name: "Threads", value: 2 },
      { name: "Hash", value: 64 },
      { name: "UCI_ShowWDL", value: true }
    ]);
    assert.ok(result.raw.some((line) => line.includes("setoption name Threads value 2")));
    assert.ok(result.raw.some((line) => line.includes("setoption name Hash value 64")));
    assert.ok(result.raw.some((line) => line.includes("setoption name UCI_ShowWDL value true")));
  } finally {
    await backend.close();
  }
});

test("UCCI backend accepts array and button-style native options", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    engineOptions: [
      ["Hash", 128],
      { name: "EvalFile", value: "pikafish.nnue" },
      { name: "Clear Hash" }
    ]
  });

  try {
    const result = await backend.chooseMove(createInitialPosition(), { useBook: false });
    const description = describeEngineBackend(backend);

    assert.deepEqual(description.nativeOptions, [
      { name: "Hash", value: 128 },
      { name: "EvalFile", value: "pikafish.nnue" },
      { name: "Clear Hash", value: null }
    ]);
    assert.ok(result.raw.some((line) => line.includes("setoption name Hash value 128")));
    assert.ok(result.raw.some((line) => line.includes("setoption name EvalFile value pikafish.nnue")));
    assert.ok(result.raw.some((line) => line.includes("setoption name Clear Hash")));
  } finally {
    await backend.close();
  }
});

test("UCCI backend parses MultiPV analysis lines", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000
  });

  try {
    const result = await backend.analyzePosition(createInitialPosition(), { lines: 2 });

    assert.equal(result.lines.length, 2);
    assert.equal(result.lines[0].move.notation, "h9-g7");
    assert.equal(result.lines[0].score, 42);
    assert.equal(result.lines[1].move.notation, "h7-e7");
    assert.equal(result.lines[1].centipawnLoss, 30);
    assert.equal(result.candidates[1].native.multipv, 2);
  } finally {
    await backend.close();
  }
});

test("UCCI backend chooseMove can include native MultiPV alternatives", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000
  });

  try {
    const result = await backend.chooseMove(createInitialPosition(), {
      useBook: false,
      lines: 2
    });

    assert.equal(result.bestMove.notation, "h9-g7");
    assert.equal(result.candidates.length, 2);
    assert.equal(result.candidates[0].move.notation, "h9-g7");
    assert.equal(result.candidates[1].move.notation, "h7-e7");
    assert.equal(result.explanation.alternatives.length, 2);
    assert.equal(result.explanation.comparison.bestMove, "h9-g7");
    assert.equal(result.explanation.comparison.nextMove, "h7-e7");
    assert.equal(result.explanation.comparison.scoreGap, 30);
    assert.equal(result.explanation.comparison.verdict, "playable");
    assert.ok(result.explanation.comparison.reason.includes("30 centipawns"));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("Native MultiPV rates h9-g7 30 centipawns above")));
    assert.equal(result.explanation.alternatives[0].verdict, "best");
    assert.equal(result.explanation.alternatives[0].centipawnLoss, 0);
    assert.equal(result.explanation.alternatives[0].expectedReply, "h0-g2");
    assert.equal(result.explanation.alternatives[0].linePlanSummary, result.explanation.linePlan.summary);
    assert.ok(Array.isArray(result.explanation.alternatives[0].motifs));
    assert.equal(result.explanation.alternatives[1].move, "h7-e7");
    assert.equal(result.explanation.alternatives[1].centipawnLoss, 30);
    assert.equal(result.explanation.alternatives[1].verdict, "playable");
    assert.ok(result.explanation.alternatives[1].reasons[0].includes("top native line"));
    assert.ok(result.explanation.alternatives[1].principalVariationText.includes("h7-e7"));
    assert.ok(result.explanation.alternatives[1].note.includes("native UCCI line 2"));
    assert.ok(result.raw.some((line) => line.includes("multipv 2")));
  } finally {
    await backend.close();
  }
});

test("UCCI backend explains near-tied native alternatives", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    engineOptions: {
      MockTie: true
    }
  });

  try {
    const result = await backend.chooseMove(createInitialPosition(), {
      useBook: false,
      lines: 2
    });

    assert.equal(result.bestMove.notation, "h9-g7");
    assert.equal(result.explanation.comparison.bestMove, "h9-g7");
    assert.equal(result.explanation.comparison.nextMove, "h7-e7");
    assert.equal(result.explanation.comparison.scoreGap, 4);
    assert.equal(result.explanation.comparison.verdict, "near-tie");
    assert.ok(result.explanation.comparison.reason.includes("nearly tied"));
  } finally {
    await backend.close();
  }
});

test("native backend can use a UCI handshake for top-engine compatibility", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    profile: "native-uci",
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000
  });

  try {
    const result = await backend.chooseMove(createInitialPosition(), { useBook: false });
    const description = describeEngineBackend(backend);

    assert.equal(backend.supports(ENGINE_BACKEND_FEATURES.UCI_COMPATIBLE), true);
    assert.equal(description.kind, "native-uci");
    assert.equal(result.source, "native-uci");
    assert.equal(result.bestMove.notation, "h9-g7");
    assert.ok(result.raw.some((line) => line.includes("position fen rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1")));
    assert.ok(result.raw.some((line) => line === "bestmove h0g2"));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("UCI search")));

    const analysis = await backend.analyzePosition(createInitialPosition(), {
      useBook: false,
      lines: 2
    });

    assert.equal(analysis.lines.length, 2);
    assert.equal(analysis.lines[0].move.notation, "h9-g7");
    assert.equal(analysis.lines[1].move.notation, "h7-e7");
  } finally {
    await backend.close();
  }
});

test("native backend preserves mate and WDL score details", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    profile: "native-uci",
    depth: 3,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    engineOptions: {
      MockMateWdl: true
    }
  });

  try {
    const result = await backend.chooseMove(createInitialPosition(), {
      useBook: false,
      lines: 2
    });

    assert.equal(result.bestMove.notation, "h9-g7");
    assert.equal(result.scoreDetail.kind, "mate");
    assert.equal(result.scoreDetail.value, 2);
    assert.equal(result.scoreDetail.text, "mate in 2");
    assert.equal(result.wdl.win, 980);
    assert.equal(result.wdl.draw, 20);
    assert.equal(result.wdl.loss, 0);
    assert.equal(result.wdl.text, "98% win, 2% draw, 0% loss");
    assert.equal(result.candidates[0].scoreDetail.text, "mate in 2");
    assert.equal(result.candidates[0].wdl.text, "98% win, 2% draw, 0% loss");
    assert.ok(result.explanation.summary.includes("mate in 2"));
    assert.ok(result.explanation.reasons.some((reason) => reason.includes("Native WDL expectation: 98% win")));
    assert.equal(result.explanation.search.scoreDetail.text, "mate in 2");
    assert.equal(result.explanation.search.wdl.text, "98% win, 2% draw, 0% loss");
    assert.equal(result.explanation.alternatives[0].scoreDetail.text, "mate in 2");
    assert.equal(result.explanation.alternatives[0].wdl.text, "98% win, 2% draw, 0% loss");
  } finally {
    await backend.close();
  }
});

test("UCCI backend provides async native coach hints", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000
  });

  try {
    const hint = await backend.coachMove(createInitialPosition(), {
      useBook: false,
      lines: 2
    });

    assert.equal(hint.source, "native-ucci");
    assert.equal(hint.bestMove.notation, "h9-g7");
    assert.equal(hint.levels.length, 4);
    assert.equal(hint.levels.at(-1).kind, "reveal");
    assert.ok(hint.levels.at(-1).text.includes("h9-g7"));
    assert.equal(hint.alternatives.length, 2);
    assert.equal(hint.alternatives[1].notation, "h7-e7");
  } finally {
    await backend.close();
  }
});

test("UCCI backend forwards clock controls to native engines", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000
  });

  try {
    const result = await backend.chooseMove(createInitialPosition(), {
      useBook: false,
      wtime: 60000,
      btime: 20000,
      winc: 1000,
      binc: 500,
      movestogo: 20
    });

    assert.equal(result.source, "native-ucci");
    assert.equal(result.score, 55);
    assert.equal(result.nodes, 321);
    assert.ok(result.raw.some((line) => line.includes("command go depth 2 wtime 60000 btime 20000 winc 1000 binc 500 movestogo 20")));
  } finally {
    await backend.close();
  }
});

test("UCCI backend reviews moves with native search scores", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000
  });

  try {
    const review = await backend.reviewMove(createInitialPosition(), "h7-e7", {
      depth: 2,
      timeLimitMs: 500
    });

    assert.equal(review.source, "native-ucci");
    assert.equal(review.bestMove.notation, "h9-g7");
    assert.equal(review.bestScore, 42);
    assert.equal(review.playedScore, -17);
    assert.equal(review.centipawnLoss, 59);
    assert.equal(review.classification, "good");
    assert.equal(review.mistakes.primary, "none");
    assert.deepEqual(review.principalVariation, ["h7-e7", "h0-g2"]);
    assert.ok(review.bestExplanation.summary.includes("Native UCCI Engine"));
    assert.ok(review.explanation.reasons.some((reason) => reason.includes("h9-g7")));
  } finally {
    await backend.close();
  }
});

test("UCCI backend reviews games with native move reviews", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000
  });

  try {
    const review = await backend.reviewGame(["h7-e7"], {
      reviewOptions: { depth: 2, timeLimitMs: 500 }
    });

    assert.equal(review.moves.length, 1);
    assert.equal(review.summary.totalMoves, 1);
    assert.equal(review.summary.bookMoves, 1);
    assert.equal(review.moves[0].review.source, "native-ucci");
    assert.equal(review.moves[0].review.bestMove.notation, "h9-g7");
    assert.equal(review.keyMoments[0].notation, "h7-e7");
    assert.equal(review.status.state, "playing");
  } finally {
    await backend.close();
  }
});

test("UCCI backend creates lesson plans from native reviews", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000
  });

  try {
    const plan = await backend.lessonPlan(["h7-e7"], {
      reviewOptions: { depth: 2, timeLimitMs: 500 },
      lessonOptions: { maxCards: 1 }
    });

    assert.equal(plan.cards.length, 1);
    assert.equal(plan.cards[0].type, "opening");
    assert.equal(plan.cards[0].bestMove, "h9-g7");
    assert.equal(plan.cards[0].answer.move, "h7-e7");
    assert.equal(plan.cards[0].answer.principalVariation[0], "h7-e7");
  } finally {
    await backend.close();
  }
});

test("UCCI backend creates full game studies from native reviews", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000
  });

  try {
    const study = await backend.gameStudy(["h7-e7"], {
      maxPositionStudies: 0,
      reviewOptions: { depth: 2, timeLimitMs: 500 },
      lessonOptions: { maxCards: 1 }
    });

    assert.equal(study.type, "game-study");
    assert.equal(study.summary.totalMoves, 1);
    assert.equal(study.review.moves[0].review.source, "native-ucci");
    assert.equal(study.lessonPlan.cards[0].bestMove, "h9-g7");
    assert.equal(study.positionStudies.length, 0);
  } finally {
    await backend.close();
  }
});
