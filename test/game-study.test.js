import test from "node:test";
import assert from "node:assert/strict";
import {
  createEngine,
  createJavaScriptEngineBackend,
  createGameStudyWithBackend,
  createGameStudyWithEngine,
  createUcciEngineBackend,
  formatGameStudy
} from "../src/index.js";

const SAMPLE_MOVES = ["h7-e7", "h0-g2", "h9-g7", "g3-g4"];
const MOCK_UCCI_PATH = new URL("../fixtures/mock-ucci.mjs", import.meta.url);

test("game study bundles review, lesson cards, and position studies", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 200 });
  const study = createGameStudyWithEngine(engine, SAMPLE_MOVES, {
    maxKeyMoments: 3,
    maxPositionStudies: 2,
    reviewOptions: { depth: 1, timeLimitMs: 200 },
    lessonOptions: { maxCards: 2 },
    studyOptions: {
      depth: 1,
      timeLimitMs: 200,
      lines: 2,
      includePressure: false
    }
  });

  assert.equal(study.type, "game-study");
  assert.equal(study.review.moves.length, SAMPLE_MOVES.length);
  assert.equal(study.summary.totalMoves, SAMPLE_MOVES.length);
  assert.equal(study.summary.keyMoments, study.keyMoments.length);
  assert.equal(study.summary.lessonCards, study.lessonPlan.cards.length);
  assert.equal(study.positionStudies.length, 2);
  assert.equal(study.summary.positionStudies, 2);
  assert.equal(study.positionStudies[0].type, "position-study");
  assert.equal(study.positionStudies[0].gameMoment.ply, study.keyMoments[0].ply);
  assert.ok(study.positionStudies[0].playedMoveReview);
  assert.ok(Array.isArray(study.positionStudies[0].candidateLines));
  assert.ok(study.finalFen);
  assert.ok(study.nextSteps.length > 0);
});

test("game study can target explicit plies without re-reviewing played moves", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 200 });
  const study = engine.gameStudy(SAMPLE_MOVES, {
    maxPositionStudies: 3,
    positionStudyPlies: [2],
    includePlayedMoveReview: false,
    reviewOptions: { depth: 1, timeLimitMs: 200 },
    lessonOptions: { maxCards: 1 },
    studyOptions: {
      depth: 1,
      timeLimitMs: 200,
      includeAnalysis: false,
      includeCoach: false,
      includePressure: false
    }
  });

  assert.equal(study.positionStudies.length, 1);
  assert.equal(study.positionStudies[0].gameMoment.ply, 2);
  assert.equal(study.positionStudies[0].playedMoveReview, null);
});

test("async backend game study mirrors the engine learning artifact", async () => {
  const backend = createJavaScriptEngineBackend({ depth: 1, timeLimitMs: 200 });
  const study = await createGameStudyWithBackend(backend, SAMPLE_MOVES, {
    maxPositionStudies: 1,
    reviewOptions: { depth: 1, timeLimitMs: 200 },
    lessonOptions: { maxCards: 1 },
    studyOptions: {
      depth: 1,
      timeLimitMs: 200,
      lines: 1,
      includePressure: false
    }
  });
  const methodStudy = await backend.gameStudy(SAMPLE_MOVES, {
    maxPositionStudies: 0,
    reviewOptions: { depth: 1, timeLimitMs: 200 },
    lessonOptions: { maxCards: 1 }
  });
  const formatted = formatGameStudy(study);

  assert.equal(study.type, "game-study");
  assert.equal(study.positionStudies.length, 1);
  assert.equal(methodStudy.type, "game-study");
  assert.equal(methodStudy.positionStudies.length, 0);
  assert.match(formatted, /Game study:/);
  assert.match(formatted, /Position studies:/);
});

test("game study preserves native score evidence across learning artifacts", async () => {
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
    const study = await createGameStudyWithBackend(backend, ["h7-e7"], {
      maxPositionStudies: 1,
      reviewOptions: { depth: 3, timeLimitMs: 100 },
      lessonOptions: { maxCards: 1 },
      studyOptions: {
        depth: 3,
        timeLimitMs: 100,
        lines: 1,
        includePressure: false
      }
    });

    assert.equal(study.keyMoments[0].bestScoreDetail.text, "mate in 2");
    assert.equal(study.lessonPlan.cards[0].bestScoreDetail.text, "mate in 2");
    assert.equal(study.positionStudies[0].gameMoment.bestScoreDetail.text, "mate in 2");
    assert.equal(study.positionStudies[0].gameMoment.bestWdl.text, "98% win, 2% draw, 0% loss");
  } finally {
    await backend.close();
  }
});
