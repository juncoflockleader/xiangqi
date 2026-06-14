import test from "node:test";
import assert from "node:assert/strict";
import { resolveSearchBudget, SIDES } from "../src/index.js";

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
