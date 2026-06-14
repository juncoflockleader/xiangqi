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
