import test from "node:test";
import assert from "node:assert/strict";
import {
  PIECES,
  SIDES,
  applyLegalMove,
  classifyMoveLoss,
  coordToIndex,
  createEngine,
  createInitialPosition,
  generateCaptures,
  generateLegalMoves,
  indexOf,
  isInCheck,
  parseFen,
  toFen
} from "../src/index.js";

test("initial position parses and serializes", () => {
  const position = createInitialPosition();
  assert.equal(position.turn, SIDES.RED);
  assert.equal(position.board[coordToIndex("e9")].type, PIECES.KING);
  assert.equal(position.board[coordToIndex("e0")].type, PIECES.KING);
  assert.equal(toFen(position), "rheakaehr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RHEAKAEHR r");
});

test("initial position has legal red moves", () => {
  const position = createInitialPosition();
  const moves = generateLegalMoves(position);
  assert.ok(moves.length > 30);
  assert.ok(moves.every((move) => move.piece.side === SIDES.RED));
});

test("flying general check is detected and legal moves must resolve it", () => {
  const position = parseFen("4k4/9/9/9/9/9/9/9/9/4K4 r");
  assert.equal(isInCheck(position, SIDES.RED), true);

  const moves = generateLegalMoves(position);
  assert.deepEqual(
    moves.map((move) => move.notation).sort(),
    ["e9-d9", "e9-f9"]
  );
});

test("check detection covers direct Xiangqi attackers", () => {
  assert.equal(isInCheck(parseFen("4k4/9/9/9/4r4/9/9/9/9/4K4 r"), SIDES.RED), true);
  assert.equal(isInCheck(parseFen("4k4/9/9/9/4c4/9/9/4P4/9/4K4 r"), SIDES.RED), true);
  assert.equal(isInCheck(parseFen("4k4/9/9/9/4c4/9/9/9/9/4K4 r"), SIDES.RED), false);
  assert.equal(isInCheck(parseFen("4k4/9/9/9/9/4P4/9/3h5/9/4K4 r"), SIDES.RED), true);
  assert.equal(isInCheck(parseFen("4k4/9/9/9/9/4P4/9/3h5/3P5/4K4 r"), SIDES.RED), false);
  assert.equal(isInCheck(parseFen("4k4/9/9/9/9/9/9/9/4p4/4K4 r"), SIDES.RED), true);
  assert.equal(isInCheck(parseFen("4k4/9/9/9/9/4P4/9/9/9/3pK4 r"), SIDES.RED), true);
  assert.equal(isInCheck(parseFen("2eakae2/9/4c4/4C4/9/4P4/9/9/9/2EAKAE2 b"), SIDES.BLACK), true);
});

test("legal moves do not include literal king captures", () => {
  const position = parseFen("4k4/9/9/9/9/9/9/9/9/3KR4 r");
  const moves = generateLegalMoves(position).map((move) => move.notation);

  assert.equal(moves.includes("e9-e0"), false);
  assert.ok(moves.includes("e9-e8"));
});

test("horse leg blocking is enforced", () => {
  const position = parseFen("4k4/9/9/9/9/9/4P4/9/9/4H4 r");
  const moves = generateLegalMoves(position);
  const horseMoves = moves
    .filter((move) => move.from === coordToIndex("e9"))
    .map((move) => move.notation)
    .sort();

  assert.equal(horseMoves.includes("e9-d7"), false);
  assert.equal(horseMoves.includes("e9-f7"), false);
});

test("cannon captures only with exactly one screen", () => {
  const position = parseFen("4k4/9/9/4r4/9/4P4/9/9/9/3KC4 r");
  const cannonMoves = generateLegalMoves(position)
    .filter((move) => move.from === coordToIndex("e9"))
    .map((move) => move.notation);

  assert.ok(cannonMoves.includes("e9-e3"));
});

test("capture generation matches legal capture subset", () => {
  const positions = [
    createInitialPosition(),
    parseFen("4k4/9/9/4r4/9/4P4/9/9/9/3KC4 r"),
    parseFen("2eakae2/9/4c4/4C4/9/4P4/9/9/9/2EAKAE2 b"),
    parseFen("4k4/9/4r4/9/9/9/9/9/9/3KR4 r")
  ];

  for (const position of positions) {
    for (const side of [SIDES.RED, SIDES.BLACK]) {
      const legalCaptures = generateLegalMoves(position, side)
        .filter((move) => move.captured)
        .map((move) => move.notation)
        .sort();
      const directCaptures = generateCaptures(position, side)
        .map((move) => move.notation)
        .sort();

      assert.deepEqual(directCaptures, legalCaptures);
    }
  }
});

test("applying a legal move updates the board and turn", () => {
  const position = createInitialPosition();
  const next = applyLegalMove(position, { from: coordToIndex("a9"), to: coordToIndex("a8") });

  assert.equal(next.turn, SIDES.BLACK);
  assert.equal(next.board[coordToIndex("a8")].type, PIECES.ROOK);
  assert.equal(next.board[coordToIndex("a9")], null);
});

test("engine returns a legal move and explanation", () => {
  const position = createInitialPosition();
  const engine = createEngine({ depth: 2, timeLimitMs: 1000 });
  const result = engine.chooseMove(position, { useBook: false });
  const legalKeys = new Set(generateLegalMoves(position).map((move) => `${move.from}:${move.to}`));

  assert.ok(result.bestMove);
  assert.ok(legalKeys.has(`${result.bestMove.from}:${result.bestMove.to}`));
  assert.ok(result.explanation.summary.includes(result.bestMove.notation));
  assert.ok(result.explanation.reasons.length > 0);
  assert.ok(result.depth >= 1);
  assert.ok(result.explanation.search.stats.nodes > 0);
  assert.equal(result.explanation.search.iterations.length, result.depth);
  assert.ok(result.explanation.search.iterations.at(-1).principalVariation.length > 0);
  assert.ok(result.explanation.confidence.score >= 0);
  assert.ok(["low", "medium", "high", "very-high"].includes(result.explanation.confidence.level));
  assert.ok(result.explanation.confidence.factors.some((factor) => factor.kind === "depth"));
  assert.equal(result.explanation.linePlan.firstMove, result.bestMove.notation);
  assert.equal(result.explanation.linePlan.moves[0].role, "engine-choice");
});

test("engine sees a simple winning capture", () => {
  const position = parseFen("4k4/9/4r4/9/9/9/9/9/9/3KR4 r");
  const engine = createEngine({ depth: 2, timeLimitMs: 1000 });
  const result = engine.chooseMove(position);

  assert.equal(result.bestMove.notation, "e9-e2");
  assert.equal(result.bestMove.captured.type, PIECES.ROOK);
});

test("engine reviews a player move against the best line", () => {
  const position = parseFen("4k4/9/4r4/9/9/9/9/9/9/3KR4 r");
  const engine = createEngine({ depth: 2, timeLimitMs: 1000 });
  const review = engine.reviewMove(position, "e9-f9");

  assert.equal(review.move.notation, "e9-f9");
  assert.equal(review.bestMove.notation, "e9-e2");
  assert.ok(review.centipawnLoss > 0);
  assert.notEqual(review.classification, "best");
  assert.ok(review.explanation.summary.includes(review.classification));
  assert.equal(review.explanation.summary.includes("a excellent"), false);
  assert.ok(review.explanation.reasons.some((reason) => reason.includes("e9-e2")));
  assert.equal(review.practiceFocus.category, "missed-material");
  assert.equal(review.practiceFocus.title, "Material tactics");
  assert.equal(review.practiceFocus.drill, "candidate-captures");
});

test("engine review recognizes the best move", () => {
  const position = parseFen("4k4/9/4r4/9/9/9/9/9/9/3KR4 r");
  const engine = createEngine({ depth: 2, timeLimitMs: 1000 });
  const review = engine.reviewMove(position, "e9-e2");

  assert.equal(review.classification, "best");
  assert.equal(review.centipawnLoss, 0);
  assert.equal(review.isBestMove, true);
});

test("move-loss labels escalate with centipawn loss", () => {
  assert.equal(classifyMoveLoss(0), "best");
  assert.equal(classifyMoveLoss(41), "good");
  assert.equal(classifyMoveLoss(161), "mistake");
  assert.equal(classifyMoveLoss(321), "blunder");
});
