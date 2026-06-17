import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createEngineBackend,
  createInitialPosition,
  createJavaScriptEngineBackend,
  createLearningEngineBackend,
  describeEngineBackend,
  describeEngineBackendStatus,
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
  assert.equal(result.bestMove.notation, "b7-e7");
  assert.equal(description.cacheCapacity, backend.cacheCapacity);
  assert.equal(description.status.state, "primary");
  assert.equal(description.status.native, false);
  assert.equal(description.status.fallback, false);
  assert.equal(description.settings.profile, null);
  assert.equal(description.settings.depth, 1);
  assert.equal(description.settings.timeLimitMs, 500);
  assert.equal(typeof backend.reviewGame, "function");
  assert.equal(typeof backend.coachMove, "function");
  assert.equal(typeof backend.lessonPlan, "function");

  const hint = backend.coachMove(position);
  assert.equal(hint.bestMove.notation, "b7-e7");
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
  assert.equal(result.bestMove.notation, "b7-e7");
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

test("learning backend factory can prefer an unresolved native preset without requiring it", () => {
  const config = resolveLearningEngineBackendConfig({
    nativePreset: "pikafish",
    autoDiscover: false,
    env: {},
    depth: 1,
    timeLimitMs: 100
  });
  const backend = createLearningEngineBackend({
    nativePreset: "pikafish",
    autoDiscover: false,
    env: {},
    depth: 1,
    timeLimitMs: 100
  });

  assert.equal(config.kind, "javascript");
  assert.equal(config.reason, "javascript-fallback");
  assert.equal(backend.kind, "javascript");
  assert.equal(isNativeEngineBackend(backend), false);
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
    commandTimeoutMs: 1000,
    engineOptions: {
      Threads: 2,
      Hash: 64
    }
  });

  try {
    const description = describeEngineBackend(backend);
    const result = await backend.chooseMove(createInitialPosition(), {
      useBook: false,
      lines: 2
    });

    assert.equal(description.kind, "hybrid");
    assert.equal(description.status.state, "primary");
    assert.equal(description.status.native, true);
    assert.equal(description.status.fallback, true);
    assert.equal(description.status.primaryBackend.kind, "native-ucci");
    assert.equal(description.status.fallbackBackend.kind, "javascript");
    assert.equal(description.settings.profile, "native-ucci");
    assert.equal(description.settings.protocol, "ucci");
    assert.equal(description.settings.depth, 2);
    assert.equal(description.status.primaryBackend.settings.depth, 2);
    assert.equal(description.status.fallbackBackend.settings.depth, 2);
    assert.deepEqual(description.nativeOptions, [
      { name: "Threads", value: 2 },
      { name: "Hash", value: 64 }
    ]);
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

test("learning backend factory selects a native preset when configured", async () => {
  const config = resolveLearningEngineBackendConfig({
    nativePreset: "pikafish",
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    engineOptions: {
      MockTie: true
    },
    env: {}
  });
  const backend = createLearningEngineBackend({
    nativePreset: "pikafish",
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    engineOptions: {
      MockTie: true
    },
    env: {}
  });

  try {
    const description = describeEngineBackend(backend);
    const result = await backend.chooseMove(createInitialPosition(), {
      useBook: false,
      lines: 2
    });

    assert.equal(config.kind, "native");
    assert.equal(config.reason, "native-preset");
    assert.equal(config.options.protocol, "uci");
    assert.equal(description.status.primaryBackend.name, "Pikafish");
    assert.equal(description.status.primaryBackend.kind, "native-uci");
    assert.deepEqual(description.nativeOptions, [
      { name: "UCI_ShowWDL", value: true },
      { name: "MockTie", value: true }
    ]);
    assert.equal(result.source, "native-uci");
    assert.equal(result.bestMove.notation, "h9-g7");
    assert.equal(result.explanation.comparison.verdict, "near-tie");
  } finally {
    await backend.close();
  }
});

test("learning backend factory applies play levels to native presets", async () => {
  const backend = createLearningEngineBackend({
    nativePreset: "pikafish",
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    playLevel: "casual",
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    env: {}
  });

  try {
    const description = describeEngineBackend(backend);
    const result = await backend.chooseMove(createInitialPosition(), {
      useBook: false
    });

    assert.deepEqual(description.nativeOptions, [
      { name: "UCI_LimitStrength", value: true },
      { name: "UCI_Elo", value: 1600 },
      { name: "UCI_ShowWDL", value: true }
    ]);
    assert.equal(description.settings.playLevel, "casual");
    assert.equal(description.settings.depth, 2);
    assert.equal(description.settings.timeLimitMs, 500);
    assert.equal(description.settings.lines, 2);
    assert.equal(result.source, "native-uci");
    assert.equal(result.depth, 2);
  } finally {
    await backend.close();
  }
});

test("learning backend factory resolves a discoverable native preset command", () => {
  const root = mkdtempSync(join(tmpdir(), "xiangqi-backend-preset-"));

  try {
    const bundle = createPikafishBundle(root, "Pikafish-2026-01-02");
    const config = resolveLearningEngineBackendConfig({
      nativePreset: "pikafish",
      installRoot: root,
      platform: "darwin",
      arch: "arm64",
      env: {}
    });

    assert.equal(config.kind, "native");
    assert.equal(config.reason, "native-preset");
    assert.equal(config.options.command, bundle.command);
    assert.equal(config.options.cwd, bundle.home);
    assert.equal(config.options.protocol, "uci");
    assert.equal(config.options.profile, "native-uci");
  } finally {
    rmSync(root, { recursive: true, force: true });
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
    const status = describeEngineBackendStatus(backend);

    assert.equal(status.state, "fallback");
    assert.equal(status.fallbackActive, true);
    assert.ok(status.fallbackReason.includes("JavaScript Reference Engine supplied this result"));
    assert.match(result.bestMove.notation, /^[a-i][0-9]-[a-i][0-9]$/);
    assert.equal(result.backendFallback.method, "chooseMove");
    assert.equal(result.backendFallback.fallbackBackend, "javascript-reference");
    assert.ok(result.backendFallback.message.length > 0);
    assert.ok(result.explanation.reasons[0].includes("JavaScript Reference Engine supplied this result"));
  } finally {
    await backend.close();
  }
});

test("learning backend retries native after a one-off fallback search failure", async () => {
  const backend = createLearningEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    profile: "native-ucci",
    depth: 2,
    timeLimitMs: 500,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    engineOptions: {
      MockIllegalFirstSearch: true
    },
    javascript: {
      profile: "fast",
      depth: 1,
      timeLimitMs: 100
    }
  });
  const position = createInitialPosition();

  try {
    const fallbackResult = await backend.chooseMove(position, {
      useBook: false,
      depth: 1,
      timeLimitMs: 100
    });

    assert.equal(backend.fallbackActive, true);
    assert.equal(fallbackResult.backendFallback.method, "chooseMove");
    assert.equal(fallbackResult.backendFallback.fallbackBackend, "javascript-reference");
    assert.ok(fallbackResult.backendFallback.message.includes("illegal move"));

    const recovered = await backend.chooseMove(position, {
      useBook: false,
      depth: 2,
      timeLimitMs: 500
    });

    assert.equal(backend.fallbackActive, false);
    assert.equal(recovered.source, "native-ucci");
    assert.equal(recovered.bestMove.notation, "h9-g7");
    assert.equal(recovered.backendFallback, undefined);
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

function createPikafishBundle(root, tag) {
  const home = join(root, tag);
  const command = join(home, "MacOS", "pikafish-apple-silicon");
  mkdirSync(join(home, "MacOS"), { recursive: true });
  writeFileSync(command, "#!/bin/sh\n", "utf8");
  chmodSync(command, 0o755);
  writeFileSync(join(home, "pikafish.nnue"), "nnue", "utf8");
  return { home, command };
}
