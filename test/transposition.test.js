import test from "node:test";
import assert from "node:assert/strict";
import { createEngine, createTranspositionTable, parseFen, searchBestMove } from "../src/index.js";

test("bounded transposition table prefers deeper fresh entries", () => {
  const table = createTranspositionTable({ maxEntries: 2, replacementSample: 2 });
  table.nextGeneration();
  table.set("deep", { depth: 5, flag: "exact", score: 500 });
  table.set("shallow", { depth: 1, flag: "upper", score: 100 });

  table.nextGeneration();
  table.get("deep");
  const result = table.set("new", { depth: 2, flag: "lower", score: 200 });

  assert.equal(result.evicted, true);
  assert.equal(table.size, 2);
  assert.ok(table.get("deep"));
  assert.ok(table.get("new"));
  assert.equal(table.get("shallow"), undefined);
});

test("bounded transposition table keeps deeper exact entries", () => {
  const table = createTranspositionTable({ maxEntries: 2 });
  table.set("line", { depth: 5, flag: "exact", score: 500 });
  const result = table.set("line", { depth: 2, flag: "upper", score: 100 });

  assert.equal(result.stored, false);
  assert.equal(table.get("line").depth, 5);
  assert.equal(table.get("line").score, 500);
});

test("search reports transposition table storage pressure", () => {
  const position = parseFen("2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r");
  const result = searchBestMove(position, {
    depth: 3,
    timeLimitMs: 1000,
    maxTranspositionEntries: 8
  });

  assert.equal(result.tableSize, 8);
  assert.ok(result.stats.ttStores > 0);
  assert.ok(result.stats.ttEvictions > 0);
});

test("search still accepts a plain Map transposition table", () => {
  const position = parseFen("4k4/9/4r4/9/9/9/9/9/9/3KR4 r");
  const table = new Map();
  const result = searchBestMove(position, {
    depth: 2,
    timeLimitMs: 1000,
    transpositionTable: table
  });

  assert.ok(table.size > 0);
  assert.ok(result.stats.ttStores > 0);
  assert.equal(result.stats.ttSkips, 0);
});

test("engine exposes bounded cache capacity", () => {
  const position = parseFen("2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r");
  const engine = createEngine({
    depth: 3,
    timeLimitMs: 1000,
    maxTranspositionEntries: 8
  });
  const result = engine.chooseMove(position, { useBook: false });

  assert.equal(engine.cacheCapacity, 8);
  assert.equal(engine.cacheSize, 8);
  assert.ok(result.stats.ttEvictions > 0);
});
