import test from "node:test";
import assert from "node:assert/strict";
import {
  createEngine,
  createInitialPosition,
  createLessonPlanFromReview,
  createLessonPlanWithBackend,
  createLessonPlanWithEngine,
  createUcciEngineBackend,
  parseFen
} from "../src/index.js";

const MOCK_UCCI_PATH = new URL("../fixtures/mock-ucci.mjs", import.meta.url);

test("lesson plan turns reviewed mistakes into correction cards", () => {
  const position = parseFen("4k4/9/4r4/9/9/9/9/9/9/3KR4 r");
  const engine = createEngine({ depth: 2, timeLimitMs: 1000 });
  const plan = engine.lessonPlan(["e9-f9"], {
    initialPosition: position,
    reviewOptions: { depth: 2, timeLimitMs: 1000 },
    lessonOptions: { maxCards: 1 }
  });

  assert.equal(plan.cards.length, 1);
  assert.equal(plan.cards[0].type, "correction");
  assert.equal(plan.cards[0].playedMove, "e9-f9");
  assert.equal(plan.cards[0].bestMove, "e9-e2");
  assert.ok(plan.cards[0].centipawnLoss > 0);
  assert.ok(plan.cards[0].prompt.includes("stronger move"));
  assert.ok(plan.cards[0].hints.at(-1).text.includes("e9-e2"));
  assert.equal(plan.cards[0].mistakes.primary, "missed-material");
  assert.ok(plan.cards[0].tags.includes("missed-material"));
  assert.ok(plan.cards[0].hints.some((hint) => hint.kind === "pattern"));
  assert.equal(plan.summary.byType.correction, 1);
});

test("lesson plan can be built from an existing game review", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const review = engine.reviewGame(["h7-e7", "h0-g2"], {
    reviewOptions: { depth: 1, timeLimitMs: 500 }
  });
  const plan = createLessonPlanFromReview(review, { maxCards: 2 });

  assert.equal(plan.cards.length, 2);
  assert.equal(plan.summary.byType.opening, 2);
  assert.ok(plan.cards.every((card) => card.type === "opening"));
  assert.ok(plan.cards[0].tags.includes("book"));
  assert.ok(plan.cards[0].hints[0].text.length > 0);
  assert.equal(plan.cards[0].answer.move, plan.cards[0].playedMove);
});

test("lesson cards preserve native best-line score evidence", async () => {
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
    const plan = await createLessonPlanWithBackend(backend, ["h7-e7"], {
      reviewOptions: { depth: 3, timeLimitMs: 100 },
      lessonOptions: { maxCards: 1 }
    });
    const card = plan.cards[0];

    assert.equal(card.bestScoreDetail.text, "mate in 2");
    assert.equal(card.bestScoreText, "mate in 2");
    assert.equal(card.bestWdl.text, "98% win, 2% draw, 0% loss");
    assert.equal(card.playedLinePlan.firstMove, "h7-e7");
    assert.equal(card.playedLinePlan.expectedReply, "h0-g2");
    assert.equal(card.bestLinePlan.firstMove, "h9-g7");
    assert.equal(card.bestLinePlan.expectedReply, "h0-g2");
    assert.equal(card.answer.bestScoreDetail.text, "mate in 2");
    assert.equal(card.answer.bestWdl.text, "98% win, 2% draw, 0% loss");
    assert.equal(card.answer.playedLinePlan.summary, card.playedLinePlan.summary);
    assert.equal(card.answer.bestLinePlan.summary, card.bestLinePlan.summary);
  } finally {
    await backend.close();
  }
});

test("book moves remain opening cards when shallow review scores are noisy", () => {
  const review = {
    summary: {
      totalMoves: 1,
      averageCentipawnLoss: 400
    },
    status: { state: "playing" },
    moves: [
      {
        ply: 1,
        moveNumber: 1,
        side: "red",
        notation: "h7-e7",
        positionBefore: "rheakaehr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RHEAKAEHR r",
        review: {
          classification: "blunder",
          centipawnLoss: 400,
          bestMove: { notation: "a9-a8" },
          explanation: {
            summary: "Shallow fallback preferred another move.",
            reasons: ["Search reached the time limit before completing depth 1."]
          },
          mistakes: {
            primary: "none",
            tags: []
          },
          principalVariation: ["h7-e7"]
        },
        book: {
          isBookMove: true,
          played: {
            idea: "Occupies the central file early.",
            tags: ["central-cannon"]
          }
        }
      }
    ]
  };
  const plan = createLessonPlanFromReview(review, { maxCards: 1 });

  assert.equal(plan.cards[0].type, "opening");
  assert.equal(plan.cards[0].answer.move, "h7-e7");
  assert.ok(plan.cards[0].tags.includes("book"));
});

test("standalone lesson helper mirrors engine lesson plans", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const plan = createLessonPlanWithEngine(engine, ["h7-e7"], {
    initialPosition: createInitialPosition(),
    reviewOptions: { depth: 1, timeLimitMs: 500 },
    lessonOptions: { maxCards: 1 }
  });

  assert.equal(plan.totalMoves, 1);
  assert.equal(plan.cards.length, 1);
  assert.equal(plan.cards[0].position.includes(" r"), true);
  assert.equal(plan.cards[0].answer.playedMove, "h7-e7");
});
