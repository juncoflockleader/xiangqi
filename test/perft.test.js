import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialPosition,
  generateLegalMoves,
  perft,
  perftDivide,
  parseFen
} from "../src/index.js";

test("perft depth zero and one match legal move generation", () => {
  const position = createInitialPosition();

  assert.equal(perft(position, 0), 1);
  assert.equal(perft(position, 1), generateLegalMoves(position).length);
});

test("perft divide sums to total nodes", () => {
  const position = createInitialPosition();
  const divide = perftDivide(position, 2);
  const total = divide.reduce((sum, entry) => sum + entry.nodes, 0);

  assert.equal(total, perft(position, 2));
  assert.ok(divide.every((entry) => entry.notation.includes("-")));
});

test("perft catches flying-general legality in a small palace position", () => {
  const position = parseFen("4k4/9/9/9/9/9/9/9/9/3K5 r");

  assert.equal(perft(position, 1), 1);
});

test("perft rejects invalid depth", () => {
  const position = createInitialPosition();

  assert.throws(() => perft(position, -1), /non-negative integer/);
});
