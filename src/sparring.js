import { createJavaScriptEngineBackend, describeEngineBackendStatus } from "./backend.js";
import { createGame, gameStatus, chooseAndPlayGameMoveAsync } from "./game.js";
import { createInitialPosition, moveToNotation, parseFen, toFen } from "./board.js";

const SIDES = Object.freeze(["red", "black"]);

export async function runSparringMatch(players = null, options = {}) {
  const entries = normalizeSparringPlayers(players);
  const initialPosition = resolveInitialPosition(options);
  let game = createGame(initialPosition);
  const startedAt = performanceNow();
  let stopReason = "max-plies";
  let lastDecision = null;

  for (let plyIndex = 0; plyIndex < normalizeMaxPlies(options.maxPlies); plyIndex += 1) {
    const status = gameStatus(game);
    if (status.state !== "playing") {
      stopReason = status.state;
      break;
    }

    const side = game.position.turn;
    const entry = entries[side];
    const beforeCount = game.moves.length;
    game = await chooseAndPlayGameMoveAsync(game, entry.engine, {
      actor: entry.id,
      review: options.review ?? false,
      searchOptions: searchOptionsFor(entry, side, options),
      reviewOptions: reviewOptionsFor(entry, side, options)
    });

    if (game.moves.length === beforeCount) {
      lastDecision = game.lastDecision ?? null;
      stopReason = "no-move";
      break;
    }
  }

  const status = gameStatus(game);
  if (stopReason === "max-plies" && status.state !== "playing") {
    stopReason = status.state;
  }

  const elapsedMs = Math.round(performanceNow() - startedAt);
  const moves = game.moves.map((move) => summarizeSparringMove(move, entries));

  return {
    initialFen: toFen(initialPosition),
    finalFen: toFen(game.position),
    status,
    stopReason,
    elapsedMs,
    totalPlies: game.moves.length,
    players: {
      red: summarizePlayer(entries.red),
      black: summarizePlayer(entries.black)
    },
    aggregate: aggregateSparringMoves(moves, elapsedMs),
    moves,
    lastDecision,
    game
  };
}

export function formatSparringReport(report, options = {}) {
  const maxMoves = options.maxMoves ?? report.moves.length;
  const lines = [
    `Sparring: ${report.players.red.name} (Red) vs ${report.players.black.name} (Black)`,
    `Result: ${report.status.state} after ${report.totalPlies} plies in ${report.elapsedMs}ms; stop=${report.stopReason}; ${formatNodes(report.aggregate.nodes)} nodes`
  ];
  const fallbackText = report.aggregate.fallbackCount > 0
    ? `, fallbacks ${report.aggregate.fallbackCount}`
    : "";
  lines.push(`Search: avg depth ${report.aggregate.averageDepth}, ${formatNodes(report.aggregate.nodesPerSecond)}/s${fallbackText}`);

  for (const move of report.moves.slice(0, maxMoves)) {
    const source = move.source ? `, ${move.source}` : "";
    const depth = `d${move.depth}`;
    const fallback = move.backendFallback ? ", fallback" : "";
    lines.push(`${move.ply}. ${capitalize(move.side)} ${move.notation} (${move.player.name}, ${depth}${source}${fallback})`);
    if (move.summary) lines.push(`  ${move.summary}`);
  }

  if (report.moves.length > maxMoves) {
    lines.push(`... ${report.moves.length - maxMoves} more plies`);
  }

  return lines.join("\n");
}

function normalizeSparringPlayers(players) {
  if (!players) {
    return {
      red: normalizePlayerEntry(createJavaScriptEngineBackend({ id: "red-js" }), "red"),
      black: normalizePlayerEntry(createJavaScriptEngineBackend({ id: "black-js" }), "black")
    };
  }

  if (Array.isArray(players)) {
    if (players.length !== 2) {
      throw new Error("Sparring player array must contain red and black entries.");
    }

    return {
      red: normalizePlayerEntry(players[0], "red"),
      black: normalizePlayerEntry(players[1], "black")
    };
  }

  return {
    red: normalizePlayerEntry(players.red, "red"),
    black: normalizePlayerEntry(players.black, "black")
  };
}

function normalizePlayerEntry(entry, side) {
  const engine = entry?.engine ?? entry?.backend ?? entry;
  if (!engine?.chooseMove) {
    throw new Error(`Sparring ${side} player is missing chooseMove.`);
  }
  if (typeof engine.play !== "function") {
    throw new Error(`Sparring ${side} player is missing play.`);
  }

  return {
    side,
    id: entry.id ?? engine.id ?? side,
    name: entry.name ?? engine.name ?? capitalize(side),
    kind: entry.kind ?? engine.kind ?? "custom",
    features: [...(entry.features ?? engine.features ?? [])],
    searchOptions: entry.searchOptions ?? {},
    reviewOptions: entry.reviewOptions ?? {},
    engine
  };
}

function resolveInitialPosition(options) {
  if (options.initialPosition) return options.initialPosition;
  if (options.initialFen) return parseFen(options.initialFen);
  return createInitialPosition();
}

function normalizeMaxPlies(value) {
  const maxPlies = value ?? 120;
  if (!Number.isInteger(maxPlies) || maxPlies < 0) {
    throw new Error("maxPlies must be a non-negative integer.");
  }
  return maxPlies;
}

function searchOptionsFor(entry, side, options) {
  return {
    ...(options.searchOptions ?? {}),
    ...(side === "red" ? options.redSearchOptions ?? {} : options.blackSearchOptions ?? {}),
    ...(entry.searchOptions ?? {})
  };
}

function reviewOptionsFor(entry, side, options) {
  return {
    ...(options.reviewOptions ?? {}),
    ...(side === "red" ? options.redReviewOptions ?? {} : options.blackReviewOptions ?? {}),
    ...(entry.reviewOptions ?? {})
  };
}

function summarizePlayer(entry) {
  return {
    id: entry.id,
    name: entry.name,
    side: entry.side,
    kind: entry.kind,
    features: [...entry.features],
    status: describeEngineBackendStatus(entry.engine)
  };
}

function summarizeSparringMove(move, entries) {
  const sideEntry = entries[move.side];
  const decision = move.decision ?? {};

  return {
    ply: move.ply,
    moveNumber: move.moveNumber,
    side: move.side,
    player: {
      id: sideEntry.id,
      name: sideEntry.name,
      kind: sideEntry.kind
    },
    notation: move.notation,
    move: move.move ? moveToNotation(move.move) : move.notation,
    positionBefore: move.positionBefore,
    positionAfter: move.positionAfter,
    source: decision.source ?? null,
    score: decision.score ?? null,
    depth: decision.depth ?? 0,
    nodes: decision.nodes ?? 0,
    principalVariation: [...(decision.principalVariation ?? [])],
    summary: decision.explanation?.summary ?? "",
    reasons: [...(decision.explanation?.reasons ?? [])],
    confidence: decision.explanation?.confidence ?? null,
    backendStatus: decision.backendStatus ?? null,
    backendFallback: decision.backendFallback ?? null,
    review: move.review ?? null
  };
}

function aggregateSparringMoves(moves, elapsedMs) {
  const nodes = sum(moves, (move) => move.nodes ?? 0);
  const fallbackCount = moves.filter((move) => move.backendFallback).length;
  const nodesPerSecond = elapsedMs > 0 ? Math.round(nodes * 1000 / elapsedMs) : nodes;

  return {
    nodes,
    nodesPerSecond,
    averageDepth: moves.length === 0
      ? 0
      : Number((sum(moves, (move) => move.depth ?? 0) / moves.length).toFixed(2)),
    fallbackCount,
    sources: countBy(moves, (move) => move.source ?? "unknown"),
    sides: Object.fromEntries(SIDES.map((side) => [
      side,
      {
        moves: moves.filter((move) => move.side === side).length,
        nodes: sum(moves.filter((move) => move.side === side), (move) => move.nodes ?? 0),
        fallbackCount: moves.filter((move) => move.side === side && move.backendFallback).length
      }
    ]))
  };
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function sum(items, valueFn) {
  return items.reduce((total, item) => total + valueFn(item), 0);
}

function formatNodes(value) {
  const count = Math.round(value ?? 0);
  return count.toLocaleString("en-US");
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function performanceNow() {
  if (globalThis.performance?.now) return globalThis.performance.now();
  return Date.now();
}
