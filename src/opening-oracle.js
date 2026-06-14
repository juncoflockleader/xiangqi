import { createInitialPosition, moveToNotation, parseFen, toFen } from "./board.js";
import { createOpeningBookFromRecords } from "./book.js";

export const ORACLE_OPENING_BOOK_ARTIFACT_SCHEMA = "xiangqi.oracle-opening-book";
export const ORACLE_OPENING_BOOK_ARTIFACT_VERSION = 1;

export async function generateOracleOpeningBookRecords(oracle, options = {}) {
  validateOracleBackend(oracle);

  let position = resolveInitialPosition(options);
  const maxPlies = normalizePositiveInteger(options.plies ?? options.maxPlies ?? 12, "plies");
  const lineCount = normalizePositiveInteger(options.lines ?? 3, "lines");
  const source = options.source ?? oracle.name ?? oracle.id ?? "oracle";
  const records = [];
  const positions = [];
  const primaryLine = [];
  let stopReason = "max-plies";

  for (let ply = 1; ply <= maxPlies; ply += 1) {
    const fen = toFen(position);
    const analysis = await oracle.analyzePosition(position, {
      useBook: false,
      lines: lineCount,
      ...(options.searchOptions ?? {})
    });
    const candidates = normalizeOracleCandidates(analysis, lineCount);

    if (candidates.length === 0) {
      stopReason = "no-candidates";
      break;
    }

    positions.push({
      ply,
      fen,
      side: position.turn,
      bestMove: candidates[0].move,
      candidateCount: candidates.length,
      depth: analysis.depth ?? candidates[0].depth ?? 0,
      nodes: analysis.nodes ?? 0,
      score: Math.round(analysis.score ?? candidates[0].score ?? 0)
    });

    for (const candidate of candidates) {
      records.push(createOracleOpeningRecord({
        fen,
        side: position.turn,
        source,
        ply,
        analysis,
        candidate
      }));
    }

    const nextMove = candidates[0].move;
    primaryLine.push(nextMove);
    position = oracle.play(position, nextMove);
  }

  return {
    source,
    initialFen: toFen(resolveInitialPosition(options)),
    finalFen: toFen(position),
    plies: primaryLine.length,
    requestedPlies: maxPlies,
    candidateLines: lineCount,
    lines: lineCount,
    stopReason,
    primaryLine,
    positions,
    records,
    book: options.includeBook === false ? null : createOpeningBookFromRecords(records, {
      aggregateRecords: true
    })
  };
}

export function createOracleOpeningBookArtifact(report, options = {}) {
  validateOracleOpeningReport(report);

  return cloneJson({
    schema: ORACLE_OPENING_BOOK_ARTIFACT_SCHEMA,
    version: ORACLE_OPENING_BOOK_ARTIFACT_VERSION,
    source: report.source ?? options.source ?? "oracle",
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    initialFen: report.initialFen,
    finalFen: report.finalFen,
    plies: report.plies ?? report.primaryLine?.length ?? 0,
    requestedPlies: report.requestedPlies,
    candidateLines: report.candidateLines ?? report.lines,
    stopReason: report.stopReason,
    primaryLine: report.primaryLine ?? [],
    positions: report.positions ?? [],
    records: report.records,
    parameters: {
      ...(options.parameters ?? {}),
      ...(options.searchOptions ? { searchOptions: options.searchOptions } : {})
    }
  });
}

export function createOpeningBookFromOracleArtifact(input, options = {}) {
  const artifact = parseOracleOpeningBookArtifact(input);

  return createOpeningBookFromRecords(artifact.records, {
    initialFen: options.initialFen ?? artifact.initialFen,
    aggregateRecords: true,
    ...options
  });
}

export function parseOracleOpeningBookArtifact(input) {
  const artifact = typeof input === "string" ? JSON.parse(input) : input;

  if (Array.isArray(artifact)) {
    return {
      schema: ORACLE_OPENING_BOOK_ARTIFACT_SCHEMA,
      version: ORACLE_OPENING_BOOK_ARTIFACT_VERSION,
      records: artifact
    };
  }

  if (!artifact || typeof artifact !== "object") {
    throw new Error("Oracle opening artifact must be an object or records array.");
  }
  if (artifact.schema && artifact.schema !== ORACLE_OPENING_BOOK_ARTIFACT_SCHEMA) {
    throw new Error(`Unsupported oracle opening artifact schema: ${artifact.schema}`);
  }
  if (artifact.version && artifact.version !== ORACLE_OPENING_BOOK_ARTIFACT_VERSION) {
    throw new Error(`Unsupported oracle opening artifact version: ${artifact.version}`);
  }
  if (!Array.isArray(artifact.records)) {
    throw new Error("Oracle opening artifact requires a records array.");
  }

  return artifact;
}

export function formatOracleOpeningBookReport(report, options = {}) {
  const maxRecords = options.maxRecords ?? Math.min(12, report.records.length);
  const lines = [
    `Oracle opening: ${report.primaryLine.join(" ") || "no line"}`,
    `Generated ${report.records.length} records from ${report.plies}/${report.requestedPlies} plies; stop=${report.stopReason}; source=${report.source}`
  ];

  for (const position of report.positions) {
    lines.push(`${position.ply}. ${capitalize(position.side)} ${position.bestMove} (${position.candidateCount} candidate${position.candidateCount === 1 ? "" : "s"}, d${position.depth}, ${formatCentipawns(position.score)})`);
  }

  if (report.records.length > 0) {
    lines.push("Records:");
    for (const record of report.records.slice(0, maxRecords)) {
      lines.push(`  ply ${record.ply} #${record.rank} ${record.move}: ${record.name}, weight ${record.weight}, loss ${record.centipawnLoss} cp`);
    }
    if (report.records.length > maxRecords) {
      lines.push(`  ... ${report.records.length - maxRecords} more records`);
    }
  }

  return lines.join("\n");
}

function createOracleOpeningRecord({ fen, side, source, ply, analysis, candidate }) {
  const score = Math.round(candidate.score ?? 0);
  const centipawnLoss = Math.max(0, Math.round(candidate.centipawnLoss ?? 0));
  const depth = candidate.depth ?? analysis.depth ?? 0;
  const pv = candidate.principalVariation ?? [];
  const moveLabel = candidate.rank === 1 ? "best" : `candidate ${candidate.rank}`;

  return {
    fen,
    move: candidate.move,
    weight: oracleRecordWeight(candidate.rank, centipawnLoss),
    name: `Oracle ${moveLabel}: ${candidate.move}`,
    idea: oracleRecordIdea({ source, candidate, depth, score, centipawnLoss, pv }),
    tags: ["oracle", "generated", "opening", candidate.rank === 1 ? "best" : "alternative"],
    source,
    side,
    ply,
    rank: candidate.rank,
    engineScore: score,
    centipawnLoss,
    depth,
    principalVariation: pv.join(" ")
  };
}

function oracleRecordIdea({ source, candidate, depth, score, centipawnLoss, pv }) {
  const scoreText = formatCentipawns(score);
  const lossText = candidate.rank === 1
    ? "top oracle line"
    : `${centipawnLoss} centipawns behind the top oracle line`;
  const pvText = pv.length > 1 ? ` Principal variation: ${pv.slice(0, 5).join(" ")}.` : "";
  return `${source} ranks ${candidate.move} as ${lossText} at depth ${depth}, score ${scoreText}.${pvText}`;
}

function oracleRecordWeight(rank, centipawnLoss) {
  if (rank === 1) return 100;
  return Math.max(1, 95 - centipawnLoss);
}

function normalizeOracleCandidates(analysis, lineCount) {
  const lines = analysis.lines?.length > 0
    ? analysis.lines
    : (analysis.candidates ?? []).map((candidate, index) => ({
        rank: index + 1,
        move: candidate.move,
        score: candidate.score,
        centipawnLoss: Math.max(0, Math.round((analysis.score ?? candidate.score ?? 0) - (candidate.score ?? 0))),
        principalVariation: candidate.principalVariation
      }));

  return lines.slice(0, lineCount)
    .map((line, index) => {
      const move = notationFor(line.move);
      if (!move) return null;
      return {
        rank: line.rank ?? index + 1,
        move,
        score: Math.round(line.score ?? 0),
        centipawnLoss: Math.max(0, Math.round(line.centipawnLoss ?? 0)),
        depth: line.native?.depth ?? analysis.depth ?? 0,
        principalVariation: normalizePrincipalVariation(line.principalVariation, move)
      };
    })
    .filter(Boolean);
}

function normalizePrincipalVariation(line, firstMove) {
  const moves = (line ?? [])
    .map(notationFor)
    .filter(Boolean);
  return moves.length > 0 ? moves : [firstMove];
}

function notationFor(move) {
  if (!move) return null;
  if (typeof move === "string") return move.includes("-") ? move : `${move.slice(0, 2)}-${move.slice(2, 4)}`;
  return move.notation ?? moveToNotation(move);
}

function resolveInitialPosition(options) {
  if (options.initialPosition) return options.initialPosition;
  if (options.initialFen) return parseFen(options.initialFen);
  return createInitialPosition();
}

function validateOracleBackend(oracle) {
  if (!oracle?.analyzePosition) throw new Error("Oracle opening generation requires analyzePosition.");
  if (typeof oracle.play !== "function") throw new Error("Oracle opening generation requires play.");
}

function validateOracleOpeningReport(report) {
  if (!report || typeof report !== "object") {
    throw new Error("Oracle opening artifact requires a report object.");
  }
  if (!Array.isArray(report.records)) {
    throw new Error("Oracle opening artifact requires report.records.");
  }
}

function normalizeGeneratedAt(value) {
  if (value === undefined) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizePositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function formatCentipawns(value) {
  const rounded = Math.round(value ?? 0);
  return `${rounded >= 0 ? "+" : ""}${rounded} cp`;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
