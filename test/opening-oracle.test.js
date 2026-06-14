import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialPosition,
  createOpeningBookFromRecords,
  createUcciEngineBackend,
  formatOracleOpeningBookReport,
  generateOracleOpeningBookRecords,
  lookupOpeningBook
} from "../src/index.js";

const MOCK_UCCI_PATH = new URL("../fixtures/mock-ucci.mjs", import.meta.url);

test("oracle opening generator emits importable opening records", async () => {
  const oracle = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    profile: "native-uci",
    depth: 2,
    timeLimitMs: 100,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000
  });

  try {
    const report = await generateOracleOpeningBookRecords(oracle, {
      plies: 2,
      lines: 2,
      source: "Mock Oracle",
      searchOptions: {
        depth: 2,
        timeLimitMs: 100
      }
    });
    const text = formatOracleOpeningBookReport(report);
    const imported = createOpeningBookFromRecords(report.records, {
      aggregateRecords: true
    });
    const root = lookupOpeningBook(createInitialPosition(), {
      book: imported,
      openingHeuristics: false
    });

    assert.equal(report.plies, 2);
    assert.deepEqual(report.primaryLine, ["h9-g7", "h0-g2"]);
    assert.ok(report.records.length >= 3);
    assert.equal(report.records[0].move, "h9-g7");
    assert.equal(report.records[0].weight, 100);
    assert.equal(report.records[0].source, "Mock Oracle");
    assert.ok(report.records[0].tags.includes("oracle"));
    assert.equal(root.move.notation, "h9-g7");
    assert.equal(root.entry.name, "Oracle best: h9-g7");
    assert.ok(text.includes("Oracle opening: h9-g7 h0-g2"));
    assert.ok(text.includes("Generated"));
  } finally {
    await oracle.close();
  }
});

test("oracle opening generator can omit the materialized book", async () => {
  const oracle = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    profile: "native-ucci",
    depth: 1,
    timeLimitMs: 100,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000
  });

  try {
    const report = await generateOracleOpeningBookRecords(oracle, {
      plies: 1,
      lines: 1,
      includeBook: false,
      searchOptions: {
        depth: 1,
        timeLimitMs: 100
      }
    });

    assert.equal(report.book, null);
    assert.equal(report.records.length, 1);
  } finally {
    await oracle.close();
  }
});

test("oracle opening generator validates backend contract", async () => {
  await assert.rejects(
    () => generateOracleOpeningBookRecords({ chooseMove() {} }),
    /requires analyzePosition/
  );
});
