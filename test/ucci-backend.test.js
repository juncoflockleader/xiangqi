import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialPosition,
  createUcciEngineBackend,
  describeEngineBackend,
  ENGINE_BACKEND_FEATURES
} from "../src/index.js";

const MOCK_UCCI_PATH = new URL("../fixtures/mock-ucci.mjs", import.meta.url);

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
    const result = await backend.chooseMove(createInitialPosition());
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
