import test from "node:test";
import assert from "node:assert/strict";
import {
  createEngine,
  generateLegalMoves,
  makeMove,
  parseFen,
  searchBestMove
} from "../src/index.js";

test("search reports tactical extensions in checking lines", () => {
  const position = parseFen("4k4/9/4r4/9/9/9/9/9/9/3KR4 r");
  const engine = createEngine({ depth: 2, timeLimitMs: 1000 });
  const result = engine.chooseMove(position);

  assert.equal(result.bestMove.notation, "e9-e2");
  assert.ok(result.stats.extensions > 0);
  assert.ok(result.stats.nodes >= result.nodes);
});

test("search treats repeated child positions as draw candidates", () => {
  const position = parseFen("4k4/9/9/9/9/9/9/9/9/3KR4 r");
  const move = generateLegalMoves(position).find((candidate) => candidate.notation === "e9-e8");
  const repeatedChild = makeMove(position, move);
  const result = searchBestMove(position, {
    depth: 1,
    timeLimitMs: 1000,
    history: [repeatedChild, repeatedChild],
    candidateLimit: Number.POSITIVE_INFINITY
  });
  const repeatedCandidate = result.candidates.find((candidate) => candidate.move.notation === "e9-e8");

  assert.ok(result.stats.repetitions >= 1);
  assert.equal(repeatedCandidate.score, 0);
});
