import test from "node:test";
import assert from "node:assert/strict";
import {
  createEngineBackend,
  createInitialPosition,
  createJavaScriptEngineBackend,
  describeEngineBackend,
  ENGINE_BACKEND_FEATURES
} from "../src/index.js";

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

  const hint = backend.coachMove(position);
  assert.equal(hint.bestMove.notation, "h7-e7");
  assert.equal(hint.levels.at(-1).kind, "reveal");

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
