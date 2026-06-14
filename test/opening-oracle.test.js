import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialPosition,
  createOpeningBookFromOracleArtifact,
  createOpeningBookFromRecords,
  createOracleOpeningBookArtifact,
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

test("oracle opening artifacts round-trip into reusable books", async () => {
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
    const artifact = createOracleOpeningBookArtifact(report, {
      generatedAt: "2026-06-14T00:00:00.000Z",
      parameters: {
        depth: 2,
        timeLimitMs: 100
      }
    });
    const book = createOpeningBookFromOracleArtifact(JSON.stringify(artifact));
    const root = lookupOpeningBook(createInitialPosition(), {
      book,
      openingHeuristics: false
    });

    assert.equal(artifact.schema, "xiangqi.oracle-opening-book");
    assert.equal(artifact.version, 1);
    assert.equal(artifact.generatedAt, "2026-06-14T00:00:00.000Z");
    assert.equal(artifact.candidateLines, 2);
    assert.equal(artifact.parameters.depth, 2);
    assert.equal(root.move.notation, "h9-g7");
    assert.equal(root.entry.source, undefined);
    assert.equal(root.entry.database.source, "Mock Oracle");
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

test("oracle opening artifact loader validates schema and version", () => {
  assert.throws(
    () => createOpeningBookFromOracleArtifact({ schema: "wrong", version: 1, records: [] }),
    /Unsupported oracle opening artifact schema/
  );
  assert.throws(
    () => createOpeningBookFromOracleArtifact({ schema: "xiangqi.oracle-opening-book", version: 99, records: [] }),
    /Unsupported oracle opening artifact version/
  );
  assert.throws(
    () => createOpeningBookFromOracleArtifact({ schema: "xiangqi.oracle-opening-book", version: 1 }),
    /requires a records array/
  );
});
