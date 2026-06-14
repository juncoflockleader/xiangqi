import test from "node:test";
import assert from "node:assert/strict";
import {
  createEngine,
  createInitialPosition,
  createLessonPlanFromReview,
  createLessonPlanWithEngine,
  parseFen
} from "../src/index.js";

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
