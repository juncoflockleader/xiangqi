import { INITIAL_FEN } from "./constants.js";
import { createEngine } from "./engine.js";
import { moveToNotation, parseFen } from "./board.js";
import { describeEngineBackendStatus } from "./backend.js";
import {
  summarizeAlternativeEvidence,
  summarizeComparisonEvidence,
  summarizeLinePlanEvidence
} from "./explanation-artifacts.js";
import { summarizePlanComparisonEvidence } from "./plan-comparison.js";

export const ENGINE_BENCHMARKS = Object.freeze([
  Object.freeze({
    id: "book-central-cannon",
    name: "Opening: Central Cannon",
    fen: INITIAL_FEN,
    expectedMoves: Object.freeze(["h7-e7"]),
    expectedSource: "opening-book",
    tags: Object.freeze(["opening", "book", "learning"]),
    options: Object.freeze({
      depth: 2,
      timeLimitMs: 500
    }),
    lesson: "The opening layer should prefer the central cannon from the initial position."
  }),
  Object.freeze({
    id: "rook-wins-central-rook",
    name: "Tactic: Win the Central Rook",
    fen: "4k4/9/4r4/9/9/9/9/9/9/3KR4 r",
    expectedMoves: Object.freeze(["e9-e2"]),
    tags: Object.freeze(["tactic", "capture", "search"]),
    options: Object.freeze({
      depth: 2,
      timeLimitMs: 1000,
      useBook: false
    }),
    lesson: "The search should find the direct rook capture and explain the material win."
  }),
  Object.freeze({
    id: "rook-delivers-face-capture",
    name: "Tactic: Capture the Exposed General",
    fen: "4k4/9/9/9/9/9/9/9/9/3KR4 r",
    expectedMoves: Object.freeze(["e9-e0"]),
    tags: Object.freeze(["mate", "forcing", "search"]),
    options: Object.freeze({
      depth: 2,
      timeLimitMs: 1000,
      useBook: false
    }),
    lesson: "The engine should recognize an immediate winning general capture."
  }),
  Object.freeze({
    id: "hu-central-cannon-trap",
    name: "Opening Trap: Validate the Central Cannon Heuristic",
    fen: "rheakaer1/9/1c4hc1/p1p1p3p/6p2/9/P1P1P1P1P/1CH1C1H2/9/R1EAKAE1R r",
    expectedMoves: Object.freeze(["b7-b3"]),
    tags: Object.freeze(["trap", "learning", "search"]),
    options: Object.freeze({
      depth: 3,
      timeLimitMs: 3000,
      openingHeuristicValidationDepth: 2,
      openingHeuristicValidationTimeMs: 4000
    }),
    lesson: "Heuristic opening moves must be rejected when search shows a tactical refutation."
  })
]);

export function createBenchmarkSuite(data = {}, options = {}) {
  const spec = normalizeBenchmarkSpec(data);
  const defaults = {
    ...(options.defaults ?? {}),
    ...(spec.defaults ?? {})
  };
  const records = spec.benchmarks ?? spec.records ?? spec.positions ?? [];

  return Object.freeze(records.map((record, index) => normalizeBenchmarkRecord(record, {
    defaults,
    index,
    requireExpectedMoves: options.requireExpectedMoves ?? spec.requireExpectedMoves ?? true
  })));
}

export async function runBenchmarkSuite(engineOrOptions = null, options = {}) {
  const engine = normalizeEngine(engineOrOptions, options);
  const benchmarks = filterBenchmarks(options.benchmarks ?? ENGINE_BENCHMARKS, options);
  const startedAt = performanceNow();
  const results = [];

  for (const benchmark of benchmarks) {
    results.push(await runBenchmark(engine, benchmark, options));
  }

  const elapsedMs = Math.round(performanceNow() - startedAt);
  const solved = results.filter((result) => result.solved).length;
  const sourceMatched = results.filter((result) => result.sourceMatched).length;
  const aggregate = aggregateBenchmarkResults(results, elapsedMs);

  return {
    total: results.length,
    solved,
    failed: results.length - solved,
    sourceMatched,
    elapsedMs,
    aggregate,
    results
  };
}

export async function compareEngineBackends(backends, options = {}) {
  const entries = normalizeBackendEntries(backends);
  const startedAt = performanceNow();
  const reports = [];

  for (const entry of entries) {
    const report = await runBenchmarkSuite(entry.engine, {
      ...options,
      searchOptions: {
        ...(options.searchOptions ?? {}),
        ...(entry.searchOptions ?? {})
      }
    });
    reports.push({
      id: entry.id,
      name: entry.name,
      kind: entry.kind,
      features: entry.features,
      status: describeEngineBackendStatus(entry.engine),
      solved: report.solved,
      failed: report.failed,
      total: report.total,
      sourceMatched: report.sourceMatched,
      fallbackCount: report.results.filter((result) => result.backendFallback).length,
      elapsedMs: report.elapsedMs,
      aggregate: report.aggregate,
      failures: report.results
        .filter((result) => !result.solved)
        .map((result) => ({
          id: result.id,
          expectedMoves: result.expectedMoves,
          actualMove: result.actualMove,
          source: result.source,
          sourceExpected: result.sourceExpected
        })),
      report
    });
  }

  return {
    totalBackends: reports.length,
    benchmarkTotal: reports[0]?.total ?? 0,
    elapsedMs: Math.round(performanceNow() - startedAt),
    backends: reports
  };
}

export async function compareEngineToOracle(candidate, oracle, options = {}) {
  const candidateEntry = normalizeOracleEntry(candidate, "candidate");
  const oracleEntry = normalizeOracleEntry(oracle, "oracle");
  const benchmarks = filterBenchmarks(options.benchmarks ?? ENGINE_BENCHMARKS, options);
  const acceptableLossCp = options.acceptableLossCp ?? 60;
  const startedAt = performanceNow();
  const results = [];

  for (const benchmark of benchmarks) {
    results.push(await compareBenchmarkToOracle(candidateEntry, oracleEntry, benchmark, {
      ...options,
      acceptableLossCp
    }));
  }

  const elapsedMs = Math.round(performanceNow() - startedAt);
  const exactMatches = results.filter((result) => result.exactMatch).length;
  const acceptable = results.filter((result) => result.acceptable).length;
  const reviewed = results.filter((result) => result.oracleReview).length;
  const aggregate = aggregateOracleResults(results, elapsedMs);

  return {
    candidate: summarizeComparisonEntry(candidateEntry),
    oracle: summarizeComparisonEntry(oracleEntry),
    total: results.length,
    exactMatches,
    acceptable,
    reviewed,
    failed: results.length - acceptable,
    acceptableLossCp,
    elapsedMs,
    aggregate,
    results
  };
}

export function formatBenchmarkReport(report) {
  const lines = [
    `Benchmarks: ${report.solved}/${report.total} solved in ${report.elapsedMs}ms (${formatNodes(report.aggregate?.nodes)} nodes, ${formatNodes(report.aggregate?.nodesPerSecond)}/s)`
  ];

  for (const result of report.results) {
    const status = result.solved ? "PASS" : "FAIL";
    const expected = result.expectedMoves.join(", ");
    const detail = result.sourceExpected
      ? `${result.actualMove ?? "none"} from ${result.source ?? "unknown"}`
      : result.actualMove ?? "none";
    lines.push(`${status} ${result.id}: expected ${expected}, got ${detail}`);
    const stats = `depth ${result.depth}, ${formatNodes(result.nodes)} nodes, ${result.elapsedMs}ms`;
    lines.push(`  ${stats}`);
    if (result.summary) lines.push(`  ${result.summary}`);
  }

  return lines.join("\n");
}

export function formatOracleComparisonReport(report) {
  const averageLoss = report.aggregate.averageCentipawnLoss === null
    ? "n/a"
    : `${report.aggregate.averageCentipawnLoss} cp`;
  const lines = [
    `Oracle comparison: ${report.candidate.name} vs ${report.oracle.name}`,
    `${report.acceptable}/${report.total} within ${report.acceptableLossCp} cp, ${report.exactMatches}/${report.total} exact, avg loss ${averageLoss} in ${report.elapsedMs}ms`
  ];

  for (const result of report.results) {
    const status = result.acceptable ? "PASS" : "REVIEW";
    const loss = result.oracleReview ? `${result.oracleReview.centipawnLoss} cp` : "unreviewed";
    const classification = result.oracleReview?.classification ? `, ${result.oracleReview.classification}` : "";
    lines.push(`${status} ${result.id}: candidate ${result.candidateMove ?? "none"} vs oracle ${result.oracleMove ?? "none"} (${loss}${classification})`);
    if (result.candidateSummary) lines.push(`  Candidate: ${result.candidateSummary}`);
    if (result.oracleSummary) lines.push(`  Oracle: ${result.oracleSummary}`);
    if (result.oracleReview?.summary) lines.push(`  Review: ${result.oracleReview.summary}`);
    if (result.oracleReview?.planComparison?.summary) {
      lines.push(`  Plan: ${result.oracleReview.planComparison.summary}`);
    }
    if (result.oracleReview?.practiceFocus?.title) {
      lines.push(`  Focus: ${result.oracleReview.practiceFocus.title} - ${result.oracleReview.practiceFocus.text}`);
    }
  }

  return lines.join("\n");
}

export function formatEngineComparisonReport(comparison) {
  const lines = [
    `Engine comparison: ${comparison.totalBackends} backends on ${comparison.benchmarkTotal} benchmarks in ${comparison.elapsedMs}ms`
  ];

  for (const backend of comparison.backends) {
    const label = backend.kind ? `${backend.name} (${backend.kind})` : backend.name;
    const status = backend.status?.state ? `, status ${backend.status.state}` : "";
    const fallback = backend.fallbackCount > 0 ? `, ${backend.fallbackCount} fallback` : "";
    lines.push(`${label}: ${backend.solved}/${backend.total} solved, ${backend.sourceMatched}/${backend.total} source matches, ${backend.elapsedMs}ms, ${formatNodes(backend.aggregate?.nodes)} nodes${status}${fallback}`);
    if (backend.failures.length > 0) {
      const failed = backend.failures.map((failure) => `${failure.id}:${failure.actualMove ?? "none"}`).join(", ");
      lines.push(`  Failed: ${failed}`);
    }
  }

  return lines.join("\n");
}

async function compareBenchmarkToOracle(candidateEntry, oracleEntry, benchmark, options) {
  const position = parseFen(benchmark.fen);
  const candidateOptions = {
    ...(benchmark.options ?? {}),
    ...(options.searchOptions ?? {}),
    ...(candidateEntry.searchOptions ?? {})
  };
  const oracleOptions = {
    ...(benchmark.options ?? {}),
    useBook: false,
    ...(options.oracleSearchOptions ?? {}),
    ...(oracleEntry.searchOptions ?? {})
  };
  const reviewOptions = {
    ...(oracleOptions ?? {}),
    ...(options.oracleReviewOptions ?? {})
  };
  const startedAt = performanceNow();
  const candidateDecision = await candidateEntry.engine.chooseMove(position, candidateOptions);
  const oracleDecision = await oracleEntry.engine.chooseMove(position, oracleOptions);
  const candidateMove = notationFor(candidateDecision.bestMove);
  const oracleMove = notationFor(oracleDecision.bestMove);
  const exactMatch = Boolean(candidateMove && oracleMove && candidateMove === oracleMove);
  const rawOracleReview = candidateMove
    ? await oracleEntry.engine.reviewMove(position, candidateMove, reviewOptions)
    : null;
  const oracleReview = exactMatch
    ? normalizeExactOracleReview(rawOracleReview, candidateMove)
    : rawOracleReview;
  const centipawnLoss = oracleReview?.centipawnLoss ?? null;
  const acceptable = exactMatch || (typeof centipawnLoss === "number" && centipawnLoss <= options.acceptableLossCp);
  const elapsedMs = Math.round(performanceNow() - startedAt);

  return {
    id: benchmark.id,
    name: benchmark.name,
    fen: benchmark.fen,
    tags: [...(benchmark.tags ?? [])],
    lesson: benchmark.lesson,
    candidateMove,
    oracleMove,
    exactMatch,
    acceptable,
    acceptableLossCp: options.acceptableLossCp,
    centipawnLoss,
    elapsedMs,
    candidate: summarizeOracleDecision(candidateDecision),
    oracle: summarizeOracleDecision(oracleDecision),
    candidateSummary: candidateDecision.explanation?.summary ?? "",
    oracleSummary: oracleDecision.explanation?.summary ?? "",
    candidateReasons: [...(candidateDecision.explanation?.reasons ?? [])],
    oracleReasons: [...(oracleDecision.explanation?.reasons ?? [])],
    oracleReview: oracleReview ? summarizeOracleReview(oracleReview) : null
  };
}

function normalizeExactOracleReview(review, candidateMove) {
  if (!review) return review;
  return {
    ...review,
    playedScore: review.bestScore ?? review.playedScore,
    centipawnLoss: 0,
    classification: "best",
    isBestMove: true,
    explanation: {
      ...(review.explanation ?? {}),
      summary: `${candidateMove} matches the oracle's selected move.`
    }
  };
}

async function runBenchmark(engine, benchmark, options) {
  const position = parseFen(benchmark.fen);
  const searchOptions = {
    ...(benchmark.options ?? {}),
    ...(options.searchOptions ?? {})
  };
  const startedAt = performanceNow();
  const result = await engine.chooseMove(position, searchOptions);
  const elapsedMs = Math.round(performanceNow() - startedAt);
  const actualMove = result.bestMove ? moveToNotation(result.bestMove) : null;
  const expectedMoves = [...(benchmark.expectedMoves ?? [])];
  const sourceExpected = benchmark.expectedSource ?? null;
  const sourceMatched = sourceExpected ? result.source === sourceExpected : true;
  const moveMatched = expectedMoves.length === 0
    ? Boolean(actualMove)
    : actualMove ? expectedMoves.includes(actualMove) : false;
  const solved = moveMatched && sourceMatched;

  return {
    id: benchmark.id,
    name: benchmark.name,
    fen: benchmark.fen,
    tags: [...(benchmark.tags ?? [])],
    lesson: benchmark.lesson,
    expectedMoves,
    actualMove,
    source: result.source ?? "search",
    sourceExpected,
    sourceMatched,
    moveMatched,
    solved,
    score: Math.round(result.score ?? 0),
    depth: result.depth ?? 0,
    nodes: result.nodes ?? 0,
    elapsedMs,
    timedOut: result.timedOut === true,
    stats: result.stats ? { ...result.stats } : null,
    summary: result.explanation?.summary ?? "",
    reasons: result.explanation?.reasons ?? [],
    principalVariation: (result.principalVariation ?? []).map((move) => move.notation ?? moveToNotation(move)),
    backendFallback: result.backendFallback ?? null,
    timeBudget: result.timeBudget ?? result.explanation?.search?.timeBudget ?? null
  };
}

function normalizeOracleEntry(entry, role) {
  const engine = entry?.engine ?? entry?.backend ?? entry;
  if (!engine?.chooseMove) {
    throw new Error(`${capitalize(role)} engine is missing chooseMove.`);
  }
  if (role === "oracle" && typeof engine.reviewMove !== "function") {
    throw new Error("Oracle engine is missing reviewMove.");
  }

  return {
    id: entry.id ?? engine.id ?? role,
    name: entry.name ?? engine.name ?? capitalize(role),
    kind: entry.kind ?? engine.kind ?? "custom",
    features: [...(entry.features ?? engine.features ?? [])],
    searchOptions: entry.searchOptions ?? {},
    engine
  };
}

function summarizeComparisonEntry(entry) {
  return {
    id: entry.id,
    name: entry.name,
    kind: entry.kind,
    features: [...entry.features],
    status: entry.engine ? describeEngineBackendStatus(entry.engine) : null
  };
}

function summarizeOracleDecision(decision) {
  return {
    move: notationFor(decision.bestMove),
    source: decision.source ?? "search",
    score: Math.round(decision.score ?? 0),
    depth: decision.depth ?? 0,
    nodes: decision.nodes ?? 0,
    principalVariation: (decision.principalVariation ?? []).map(notationFor),
    summary: decision.explanation?.summary ?? "",
    reasons: [...(decision.explanation?.reasons ?? [])],
    backendFallback: decision.backendFallback ?? null
  };
}

function summarizeOracleReview(review) {
  return {
    move: notationFor(review.move),
    bestMove: notationFor(review.bestMove),
    classification: review.classification,
    centipawnLoss: review.centipawnLoss,
    playedScore: review.playedScore,
    bestScore: review.bestScore,
    playedScoreDetail: review.playedScoreDetail ?? null,
    bestScoreDetail: review.bestAnalysis?.scoreDetail ?? null,
    playedWdl: review.playedWdl ?? null,
    bestWdl: review.bestAnalysis?.wdl ?? null,
    depth: review.depth,
    nodes: review.nodes,
    mistakes: review.mistakes ?? null,
    practiceFocus: review.practiceFocus ?? null,
    playedLinePlan: summarizeLinePlanEvidence(review.playedLinePlan),
    bestLinePlan: summarizeLinePlanEvidence(review.bestLinePlan),
    planComparison: summarizePlanComparisonEvidence(review.planComparison),
    bestComparison: summarizeComparisonEvidence(review.bestComparison ?? review.bestAnalysis?.explanation?.comparison),
    bestAlternatives: summarizeAlternativeEvidence(review.bestAlternatives ?? review.bestAnalysis?.explanation?.alternatives),
    summary: review.explanation?.summary ?? "",
    reasons: [...(review.explanation?.reasons ?? [])]
  };
}

function normalizeEngine(engineOrOptions, options) {
  if (engineOrOptions?.chooseMove) return engineOrOptions;
  return createEngine({
    ...(engineOrOptions ?? {}),
    ...(options.engineOptions ?? {})
  });
}

function normalizeBackendEntries(backends) {
  const entries = Array.isArray(backends)
    ? backends
    : Object.entries(backends ?? {}).map(([id, engine]) => ({ id, engine }));

  return entries.map((entry, index) => {
    const engine = entry.engine ?? entry.backend ?? entry;
    if (!engine?.chooseMove) {
      throw new Error(`Engine comparison entry ${index + 1} is missing chooseMove.`);
    }

    return {
      id: entry.id ?? engine.id ?? `engine-${index + 1}`,
      name: entry.name ?? engine.name ?? entry.id ?? engine.id ?? `Engine ${index + 1}`,
      kind: entry.kind ?? engine.kind ?? "custom",
      features: [...(entry.features ?? engine.features ?? [])],
      searchOptions: entry.searchOptions ?? {},
      engine
    };
  });
}

function filterBenchmarks(benchmarks, options) {
  const tag = options.tag ?? null;
  if (!tag) return [...benchmarks];
  return benchmarks.filter((benchmark) => benchmark.tags?.includes(tag));
}

function normalizeBenchmarkSpec(data) {
  if (typeof data === "string") {
    try {
      return normalizeBenchmarkSpec(JSON.parse(data));
    } catch (error) {
      throw new Error(`Benchmark suite JSON could not be parsed: ${error.message}`);
    }
  }
  if (Array.isArray(data)) return { benchmarks: data };
  if (data && typeof data === "object") return data;
  throw new Error("Benchmark suite must be an array, object, or JSON string.");
}

function normalizeBenchmarkRecord(record, context) {
  if (!record || typeof record !== "object") {
    throw new Error(`Benchmark record ${context.index + 1} must be an object.`);
  }

  const fen = requiredText(record.fen ?? record.position, `Benchmark record ${context.index + 1} requires fen.`);
  parseFen(fen);
  const expectedMoves = normalizeExpectedMoves(record);
  if (context.requireExpectedMoves && expectedMoves.length === 0) {
    throw new Error(`Benchmark record ${context.index + 1} requires expectedMoves, expectedMove, move, or bestMove.`);
  }

  return Object.freeze({
    id: requiredText(record.id ?? `custom-${context.index + 1}`, `Benchmark record ${context.index + 1} requires id.`),
    name: String(record.name ?? record.title ?? record.id ?? `Custom Benchmark ${context.index + 1}`),
    fen,
    expectedMoves: Object.freeze(expectedMoves),
    ...(record.expectedSource ? { expectedSource: String(record.expectedSource) } : {}),
    tags: Object.freeze(normalizeTags(record.tags ?? context.defaults.tags)),
    options: Object.freeze({
      ...(context.defaults.options ?? {}),
      ...(record.options ?? {}),
      ...pickSearchOptions(record)
    }),
    lesson: String(record.lesson ?? record.note ?? context.defaults.lesson ?? "")
  });
}

function normalizeExpectedMoves(record) {
  const raw = record.expectedMoves ?? record.expectedMove ?? record.expected ?? record.move ?? record.bestMove;
  if (raw === undefined || raw === null || raw === "") return [];
  const values = Array.isArray(raw) ? raw : String(raw).split(/[,\s]+/);
  return Object.freeze(values.map((value) => String(value).trim()).filter(Boolean));
}

function normalizeTags(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.map((tag) => String(tag).trim()).filter(Boolean);
  return String(value).split(/[,\s]+/).map((tag) => tag.trim()).filter(Boolean);
}

function pickSearchOptions(record) {
  const options = {};
  for (const key of [
    "depth",
    "timeLimitMs",
    "useBook",
    "openingHeuristicValidationDepth",
    "openingHeuristicValidationTimeMs",
    "openingHeuristicMaxCentipawnLoss"
  ]) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      options[key] = record[key];
    }
  }
  return options;
}

function requiredText(value, message) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(message);
  return text;
}

function aggregateOracleResults(results, elapsedMs) {
  const reviewed = results.filter((result) => typeof result.centipawnLoss === "number");
  const totalLoss = sum(reviewed, (result) => result.centipawnLoss);
  const nodes = sum(results, (result) => (result.candidate.nodes ?? 0) + (result.oracle.nodes ?? 0) + (result.oracleReview?.nodes ?? 0));
  const nodesPerSecond = elapsedMs > 0 ? Math.round(nodes * 1000 / elapsedMs) : nodes;

  return {
    nodes,
    nodesPerSecond,
    averageCentipawnLoss: reviewed.length === 0 ? null : Number((totalLoss / reviewed.length).toFixed(2)),
    maxCentipawnLoss: reviewed.length === 0 ? null : Math.max(...reviewed.map((result) => result.centipawnLoss)),
    reviewed: reviewed.length
  };
}

function aggregateBenchmarkResults(results, elapsedMs) {
  const nodes = sum(results, (result) => result.nodes);
  const qnodes = sum(results, (result) => result.stats?.qnodes ?? 0);
  const depthCompleted = sum(results, (result) => result.depth);
  const timedOut = results.filter((result) => result.timedOut).length;
  const nodesPerSecond = elapsedMs > 0 ? Math.round(nodes * 1000 / elapsedMs) : nodes;

  return {
    nodes,
    qnodes,
    nodesPerSecond,
    averageDepth: results.length === 0 ? 0 : Number((depthCompleted / results.length).toFixed(2)),
    timedOut,
    stats: aggregateStats(results)
  };
}

function aggregateStats(results) {
  const totals = {};
  for (const result of results) {
    for (const [key, value] of Object.entries(result.stats ?? {})) {
      if (typeof value !== "number") continue;
      totals[key] = (totals[key] ?? 0) + value;
    }
  }
  return totals;
}

function notationFor(move) {
  if (!move) return null;
  return move.notation ?? moveToNotation(move);
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function sum(items, valueFn) {
  return items.reduce((total, item) => total + valueFn(item), 0);
}

function formatNodes(value) {
  const count = Math.round(value ?? 0);
  return count.toLocaleString("en-US");
}

function performanceNow() {
  if (globalThis.performance?.now) return globalThis.performance.now();
  return Date.now();
}
