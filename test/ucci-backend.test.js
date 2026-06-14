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
