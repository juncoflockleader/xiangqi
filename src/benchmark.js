import { INITIAL_FEN } from "./constants.js";
import { createEngine } from "./engine.js";
import { moveToNotation, parseFen } from "./board.js";

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
  })
]);

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

  return {
    total: results.length,
    solved,
    failed: results.length - solved,
    sourceMatched,
    elapsedMs,
    results
  };
}

export function formatBenchmarkReport(report) {
  const lines = [
    `Benchmarks: ${report.solved}/${report.total} solved in ${report.elapsedMs}ms`
  ];

  for (const result of report.results) {
    const status = result.solved ? "PASS" : "FAIL";
    const expected = result.expectedMoves.join(", ");
    const detail = result.sourceExpected
      ? `${result.actualMove ?? "none"} from ${result.source ?? "unknown"}`
      : result.actualMove ?? "none";
    lines.push(`${status} ${result.id}: expected ${expected}, got ${detail}`);
    if (result.summary) lines.push(`  ${result.summary}`);
  }

  return lines.join("\n");
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
  const expectedMoves = [...benchmark.expectedMoves];
  const sourceExpected = benchmark.expectedSource ?? null;
  const sourceMatched = sourceExpected ? result.source === sourceExpected : true;
  const moveMatched = actualMove ? expectedMoves.includes(actualMove) : false;
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
    summary: result.explanation?.summary ?? "",
    reasons: result.explanation?.reasons ?? [],
    principalVariation: (result.principalVariation ?? []).map((move) => move.notation ?? moveToNotation(move)),
    timeBudget: result.timeBudget ?? result.explanation?.search?.timeBudget ?? null
  };
}

function normalizeEngine(engineOrOptions, options) {
  if (engineOrOptions?.chooseMove) return engineOrOptions;
  return createEngine({
    ...(engineOrOptions ?? {}),
    ...(options.engineOptions ?? {})
  });
}

function filterBenchmarks(benchmarks, options) {
  const tag = options.tag ?? null;
  if (!tag) return [...benchmarks];
  return benchmarks.filter((benchmark) => benchmark.tags?.includes(tag));
}

function performanceNow() {
  if (globalThis.performance?.now) return globalThis.performance.now();
  return Date.now();
}
