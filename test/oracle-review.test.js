import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  createInitialPosition,
  createJavaScriptEngineBackend,
  createOracleReviewEngineBackend,
  createUcciEngineBackend,
  chooseAndPlayGameMoveAsync,
  ENGINE_BACKEND_FEATURES
} from "../src/index.js";

const MOCK_UCCI_PATH = new URL("../fixtures/mock-ucci.mjs", import.meta.url);

test("oracle-reviewed backend annotates a chosen move with stronger review", async () => {
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
    const position = createInitialPosition();
    const result = await backend.chooseMove(position, {
      depth: 1,
      timeLimitMs: 100
    });

    assert.equal(backend.supports(ENGINE_BACKEND_FEATURES.ORACLE_REVIEW), true);
    assert.equal(result.bestMove.notation, "h7-e7");
    assert.equal(result.oracleReview.status, "reviewed");
    assert.equal(result.oracleReview.backend.name, "Mock Oracle");
    assert.equal(result.oracleReview.move, "h7-e7");
    assert.equal(result.oracleReview.bestMove, "h9-g7");
    assert.equal(result.oracleReview.classification, "good");
    assert.equal(result.oracleReview.centipawnLoss, 59);
    assert.equal(result.explanation.oracleReview.bestMove, "h9-g7");
    assert.ok(result.explanation.reasons[0].includes("Mock Oracle grades h7-e7 as good"));

    const game = await chooseAndPlayGameMoveAsync(createGame(position), backend, {
      searchOptions: { depth: 1, timeLimitMs: 100 },
      review: false
    });
    assert.equal(game.moves[0].decision.oracleReview.bestMove, "h9-g7");
    assert.equal(game.moves[0].decision.oracleReview.centipawnLoss, 59);
  } finally {
    await backend.close();
  }
});

test("oracle-reviewed backend can keep playing when oracle review is unavailable", async () => {
  const candidate = createJavaScriptEngineBackend({ depth: 1, timeLimitMs: 100 });
  const oracle = {
    id: "offline-oracle",
    name: "Offline Oracle",
    kind: "native-uci",
    features: [ENGINE_BACKEND_FEATURES.NATIVE_READY],
    async reviewMove() {
      throw new Error("engine offline");
    }
  };
  const backend = createOracleReviewEngineBackend(candidate, oracle);
  const result = await backend.chooseMove(createInitialPosition(), {
    depth: 1,
    timeLimitMs: 100
  });

  assert.equal(result.bestMove.notation, "h7-e7");
  assert.equal(result.oracleReview.status, "unavailable");
  assert.equal(result.oracleReview.classification, "unreviewed");
  assert.equal(result.oracleReview.error, "engine offline");
  assert.ok(result.explanation.reasons[0].includes("Offline Oracle review was unavailable"));
});

test("oracle-reviewed backend uses the oracle for move and game reviews", async () => {
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
    const review = await backend.reviewMove(createInitialPosition(), "h7-e7", {
      depth: 1,
      timeLimitMs: 100
    });
    const gameReview = await backend.reviewGame(["h7-e7"], {
      reviewOptions: {
        depth: 1,
        timeLimitMs: 100
      }
    });
    const gameStudy = await backend.gameStudy(["h7-e7"], {
      maxPositionStudies: 0,
      reviewOptions: {
        depth: 1,
        timeLimitMs: 100
      },
      lessonOptions: {
        maxCards: 1
      }
    });

    assert.equal(review.reviewBackend.name, "Mock Oracle");
    assert.equal(review.source, "native-ucci");
    assert.equal(review.bestMove.notation, "h9-g7");
    assert.equal(review.centipawnLoss, 59);
    assert.equal(review.oracleReview.status, "reviewed");
    assert.equal(review.oracleReview.bestMove, "h9-g7");
    assert.equal(gameReview.moves[0].review.reviewBackend.name, "Mock Oracle");
    assert.equal(gameReview.moves[0].review.oracleReview.bestMove, "h9-g7");
    assert.equal(gameStudy.type, "game-study");
    assert.equal(gameStudy.review.moves[0].review.reviewBackend.name, "Mock Oracle");
    assert.equal(gameStudy.lessonPlan.cards[0].bestMove, "h9-g7");
  } finally {
    await backend.close();
  }
});

test("oracle-reviewed backend falls back to candidate move review when the oracle is unavailable", async () => {
  const candidate = createJavaScriptEngineBackend({ depth: 1, timeLimitMs: 100 });
  const oracle = {
    id: "offline-oracle",
    name: "Offline Oracle",
    kind: "native-uci",
    async reviewMove() {
      throw new Error("review offline");
    }
  };
  const backend = createOracleReviewEngineBackend(candidate, oracle);
  const review = await backend.reviewMove(createInitialPosition(), "h7-e7", {
    depth: 1,
    timeLimitMs: 100
  });

  assert.equal(review.reviewBackend.name, "JavaScript Reference Engine");
  assert.equal(review.oracleReview.status, "unavailable");
  assert.equal(review.oracleReview.error, "review offline");
  assert.ok(review.explanation.reasons[0].includes("Offline Oracle review was unavailable"));
});

test("oracle-reviewed backend forwards explicit oracle review options", async () => {
  const candidate = createJavaScriptEngineBackend({ depth: 1, timeLimitMs: 100 });
  let receivedOptions = null;
  const oracle = {
    id: "option-oracle",
    name: "Option Oracle",
    kind: "oracle",
    async reviewMove(_position, move, options) {
      receivedOptions = options;
      return {
        move,
        bestMove: move,
        isBestMove: true,
        classification: "best",
        centipawnLoss: 0,
        playedScore: 25,
        bestScore: 25,
        depth: options.depth,
        nodes: 10,
        principalVariation: [move],
        explanation: {
          summary: "The oracle agrees.",
          reasons: ["The forwarded review options were used."]
        }
      };
    }
  };
  const backend = createOracleReviewEngineBackend(candidate, oracle, {
    oracleReviewOptions: { depth: 4, timeLimitMs: 1000 },
    reviewOptions: { timeLimitMs: 1500 }
  });

  const result = await backend.chooseMove(createInitialPosition(), {
    depth: 1,
    timeLimitMs: 100,
    oracleReviewOptions: { depth: 6 }
  });

  assert.equal(receivedOptions.useBook, false);
  assert.equal(receivedOptions.depth, 6);
  assert.equal(receivedOptions.timeLimitMs, 1500);
  assert.equal(result.oracleReview.isBestMove, true);
  assert.ok(result.oracleReview.verdict.includes("Option Oracle agrees"));
});
