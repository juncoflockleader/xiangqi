import test from "node:test";
import assert from "node:assert/strict";
import {
  coachMoveWithEngine,
  createEngine,
  createInitialPosition,
  parseFen
} from "../src/index.js";

test("coach move gives progressive opening hints without needing search", () => {
  const engine = createEngine({ depth: 2, timeLimitMs: 500 });
  const hint = engine.coachMove(createInitialPosition());

  assert.equal(hint.source, "opening-book");
  assert.equal(hint.bestMove.notation, "b7-e7");
  assert.equal(hint.depth, 0);
  assert.equal(hint.levels.length, 4);
  assert.equal(hint.levels[0].kind, "concept");
  assert.equal(hint.levels.at(-1).kind, "reveal");
  assert.ok(hint.levels.at(-1).text.includes("b7-e7"));
  assert.ok(hint.alternatives.length >= 3);
});

test("coach move can use pure search for tactical positions", () => {
  const position = parseFen("4k4/9/4r4/9/9/9/9/9/9/3KR4 r");
  const engine = createEngine({ depth: 2, timeLimitMs: 1000 });
  const hint = coachMoveWithEngine(engine, position, {
    useBook: false,
    depth: 2,
    timeLimitMs: 1000,
    lines: 3
  });

  assert.equal(hint.source, "search");
  assert.equal(hint.bestMove.notation, "e9-e2");
  assert.ok(hint.depth >= 1);
  assert.equal(hint.levels[2].kind, "candidate");
  assert.ok(hint.levels[2].text.includes("Red rook"));
  assert.ok(hint.principalVariationText.includes("e9-e2"));
  assert.ok(hint.explanation.summary.includes("e9-e2"));
});

test("coach move validates heuristic openings before teaching them", () => {
  const engine = createEngine({ book: {}, depth: 3, timeLimitMs: 4000 });
  let position = createInitialPosition();
  for (const move of ["h7-e7", "h0-g2", "h9-g7", "g3-g4", "b9-c7", "i0-h0"]) {
    position = engine.play(position, move);
  }

  const raw = engine.coachMove(position, { validateOpeningHeuristics: false });
  const hint = engine.coachMove(position, {
    openingHeuristicValidationDepth: 2,
    openingHeuristicValidationTimeMs: 4000
  });

  assert.equal(raw.source, "opening-heuristic");
  assert.equal(raw.bestMove.notation, "e7-e3");
  assert.equal(hint.source, "search");
  assert.notEqual(hint.bestMove.notation, "e7-e3");
  assert.equal(hint.search.openingHeuristicValidation.status, "rejected");
});

test("coach move handles positions with no legal move", () => {
  const position = parseFen("3rkr3/9/9/9/9/9/9/9/9/4K4 r");
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const hint = engine.coachMove(position, { useBook: false });

  assert.equal(hint.bestMove, null);
  assert.equal(hint.levels[0].kind, "status");
  assert.equal(hint.alternatives.length, 0);
});

test("coach move explains no-legal-move stalemate as losing in Xiangqi", () => {
  const position = parseFen("3rkr3/9/9/9/9/9/9/4p4/9/4K4 r");
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const hint = engine.coachMove(position, { useBook: false });

  assert.equal(hint.bestMove, null);
  assert.ok(hint.explanation.reasons.some((reason) => reason.includes("having no legal move loses")));
});
