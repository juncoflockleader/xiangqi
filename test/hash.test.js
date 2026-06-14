import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialPosition,
  hashPosition,
  makeMove,
  parseFen,
  parseMoveNotation
} from "../src/index.js";

test("Zobrist hash is stable for equivalent positions", () => {
  const a = createInitialPosition();
  const b = parseFen("rheakaehr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RHEAKAEHR r");

  assert.equal(hashPosition(a), hashPosition(b));
});

test("Zobrist hash changes after a move and with side to move", () => {
  const position = createInitialPosition();
  const moved = makeMove(position, parseMoveNotation("a9-a8"));
  const blackToMove = parseFen("rheakaehr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RHEAKAEHR b");

  assert.notEqual(hashPosition(position), hashPosition(moved));
  assert.notEqual(hashPosition(position), hashPosition(blackToMove));
});
