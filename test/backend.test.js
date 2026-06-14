import test from "node:test";
import assert from "node:assert/strict";
import {
  createEngineBackend,
  createInitialPosition,
  createJavaScriptEngineBackend,
  createLearningEngineBackend,
  describeEngineBackend,
  ENGINE_BACKEND_FEATURES,
  isNativeEngineBackend,
  resolveLearningEngineBackendConfig
} from "../src/index.js";

const MOCK_UCCI_PATH = new URL("../fixtures/mock-ucci.mjs", import.meta.url);

test("javascript backend exposes the engine contract", () => {
  const backend = createJavaScriptEngineBackend({ depth: 1, timeLimitMs: 500 });
  const position = createInitialPosition();
  const result = backend.chooseMove(position);
  const description = describeEngineBackend(backend);

  assert.equal(backend.id, "javascript-reference");
  assert.equal(backend.kind, "javascript");
  assert.equal(backend.supports(ENGINE_BACKEND_FEATURES.EXPLANATION), true);
  assert.equal(result.source, "opening-book");
  assert.equal(result.bestMove.notation, "h7-e7");
  assert.equal(description.cacheCapacity, backend.cacheCapacity);
  assert.equal(typeof backend.reviewGame, "function");
  assert.equal(typeof backend.coachMove, "function");
  assert.equal(typeof backend.lessonPlan, "function");

  const hint = backend.coachMove(position);
  assert.equal(hint.bestMove.notation, "h7-e7");
  assert.equal(hint.levels.at(-1).kind, "reveal");

  const lesson = backend.lessonPlan(["h7-e7"], {
    reviewOptions: { depth: 1, timeLimitMs: 500 },
    lessonOptions: { maxCards: 1 }
  });
  assert.equal(lesson.cards.length, 1);
  assert.equal(lesson.cards[0].type, "opening");

  const review = backend.reviewGame(["h7-e7"], {
    reviewOptions: { depth: 1, timeLimitMs: 500 }
  });
  assert.equal(review.moves.length, 1);
  assert.equal(review.summary.bookMoves, 1);
});

test("custom backend contract validates required methods", () => {
  assert.throws(
    () => createEngineBackend({ chooseMove() {} }),
    /missing required method: analyzePosition/
  );
});

test("custom backend can advertise native-ready capabilities", () => {
  const backend = createEngineBackend({
    id: "native-ucci-placeholder",
    name: "Native UCCI Placeholder",
    kind: "native-ucci",
    features: [ENGINE_BACKEND_FEATURES.UCCI_COMPATIBLE, ENGINE_BACKEND_FEATURES.NATIVE_READY],
    chooseMove() {
      return null;
    },
    analyzePosition() {
      return null;
    },
    reviewMove() {
      return null;
    },
    openingBook() {
      return null;
    },
    play(position) {
      return position;
    },
    legalMoves() {
      return [];
    }
  });

  assert.equal(backend.supports(ENGINE_BACKEND_FEATURES.NATIVE_READY), true);
  assert.equal(describeEngineBackend(backend).kind, "native-ucci");
});

test("learning backend factory falls back to the JavaScript engine", () => {
  const config = resolveLearningEngineBackendConfig({
    depth: 1,
    timeLimitMs: 100,
    native: false
  });
  const backend = createLearningEngineBackend({
    depth: 1,
    timeLimitMs: 100,
    native: false
  });
  const result = backend.chooseMove(createInitialPosition());

  assert.equal(config.kind, "javascript");
  assert.equal(config.reason, "native-disabled");
  assert.equal(backend.kind, "javascript");
  assert.equal(backend.supports(ENGINE_BACKEND_FEATURES.LOCAL_SEARCH), true);
  assert.equal(isNativeEngineBackend(backend), false);
  assert.equal(result.bestMove.notation, "h7-e7");
});

test("learning backend factory can prefer a native profile without requiring it", () => {
  const backend = createLearningEngineBackend({
    command: "",
    profile: "native-uci",
    depth: 1,
    timeLimitMs: 100,
    javascript: { profile: "fast" }
  });

  assert.equal(backend.kind, "javascript");
  assert.equal(backend.supports(ENGINE_BACKEND_FEATURES.LOCAL_SEARCH), true);
});

test("learning backend factory can disable native selection despite a command", () => {
  const backend = createLearningEngineBackend({
    command: process.execPath,
    preferNative: false,
    depth: 1,
    timeLimitMs: 100
  });

  assert.equal(backend.kind, "javascript");
  assert.equal(isNativeEngineBackend(backend), false);
});

test("learning backend factory selects a native engine when configured", async () => {
  const backend = createLearningEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    profile: "native-ucci",
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000
  });

  try {
    const description = describeEngineBackend(backend);
    const result = await backend.chooseMove(createInitialPosition(), {
      useBook: false,
      lines: 2
    });

    assert.equal(description.kind, "hybrid");
    assert.equal(isNativeEngineBackend(backend), true);
    assert.equal(backend.supports(ENGINE_BACKEND_FEATURES.FALLBACK), true);
    assert.equal(result.source, "native-ucci");
    assert.equal(result.bestMove.notation, "h9-g7");
    assert.equal(result.explanation.alternatives.length, 2);
    assert.equal(result.backendFallback, undefined);
  } finally {
    await backend.close();
  }
});

test("learning backend factory falls back when native search is unavailable", async () => {
  const backend = createLearningEngineBackend({
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

  try {
    const result = await backend.chooseMove(createInitialPosition(), {
      useBook: false,
      depth: 1,
      timeLimitMs: 100
    });

    assert.equal(backend.kind, "hybrid");
    assert.equal(backend.fallbackActive, true);
    assert.match(result.bestMove.notation, /^[a-i][0-9]-[a-i][0-9]$/);
    assert.equal(result.backendFallback.method, "chooseMove");
    assert.equal(result.backendFallback.fallbackBackend, "javascript-reference");
    assert.ok(result.backendFallback.message.length > 0);
    assert.ok(result.explanation.reasons[0].includes("JavaScript Reference Engine supplied this result"));
  } finally {
    await backend.close();
  }
});

test("learning backend factory can expose strict native behavior", async () => {
  const backend = createLearningEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    profile: "native-ucci",
    fallbackOnNativeError: false,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000
  });

  assert.equal(backend.kind, "native-ucci");
  assert.equal(backend.supports(ENGINE_BACKEND_FEATURES.FALLBACK), false);
  await backend.close();
});

test("learning backend factory reports explicit native misconfiguration", () => {
  assert.throws(
    () => resolveLearningEngineBackendConfig({ kind: "native-uci" }),
    /native backend requires a command/
  );
});
