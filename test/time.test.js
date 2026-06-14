import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialPosition,
  parseFen,
  resolveSearchBudget,
  SIDES
} from "../src/index.js";

test("search budget honors explicit movetime", () => {
  const budget = resolveSearchBudget({ movetime: 750, wtime: 30000 }, SIDES.RED);

  assert.equal(budget.source, "movetime");
  assert.equal(budget.timeLimitMs, 750);
  assert.equal(budget.remainingMs, null);
});

test("search budget derives a safe move time from clock controls", () => {
  const budget = resolveSearchBudget({
    wtime: 60000,
    btime: 20000,
    winc: 1000,
    movestogo: 20
  }, SIDES.RED);

  assert.equal(budget.source, "clock");
  assert.equal(budget.remainingMs, 60000);
  assert.equal(budget.incrementMs, 1000);
  assert.equal(budget.movesToGo, 20);
  assert.equal(budget.estimatedMovesToGo, false);
  assert.equal(budget.phase, "explicit");
  assert.equal(budget.timeLimitMs, 3750);
});

test("search budget uses the side-to-move clock", () => {
  const budget = resolveSearchBudget({
    wtime: 60000,
    btime: 12000,
    binc: 500,
    movestogo: 10
  }, SIDES.BLACK);

  assert.equal(budget.source, "clock");
  assert.equal(budget.remainingMs, 12000);
  assert.equal(budget.incrementMs, 500);
  assert.equal(budget.timeLimitMs, 1575);
});

test("search budget estimates moves to go from game phase when omitted", () => {
  const opening = resolveSearchBudget({
    wtime: 60000,
    btime: 60000
  }, SIDES.RED, {}, { position: createInitialPosition() });
  const endgame = resolveSearchBudget({
    wtime: 60000,
    btime: 60000
  }, SIDES.RED, {}, {
    position: parseFen("4k4/9/9/9/9/9/9/9/9/3KR4 r")
  });

  assert.equal(opening.phase, "opening");
  assert.equal(opening.estimatedMovesToGo, true);
  assert.equal(opening.movesToGo, 36);
  assert.equal(opening.timeLimitMs, 1666);
  assert.equal(endgame.phase, "endgame");
  assert.equal(endgame.movesToGo, 18);
  assert.equal(endgame.timeLimitMs, 3333);
});

test("search budget caps spending under low clock pressure", () => {
  const budget = resolveSearchBudget({
    wtime: 10000,
    btime: 10000,
    movestogo: 1
  }, SIDES.RED);

  assert.equal(budget.clockPressure, "low");
  assert.equal(budget.maxByFraction, 2400);
  assert.equal(budget.timeLimitMs, 2400);
});

test("search budget accounts for configured move overhead", () => {
  const budget = resolveSearchBudget({
    wtime: 60000,
    btime: 60000,
    winc: 1000,
    movestogo: 20,
    moveOverheadMs: 25
  }, SIDES.RED);

  assert.equal(budget.moveOverheadMs, 25);
  assert.equal(budget.timeLimitMs, 3725);
});
