import { createJavaScriptEngineBackend, describeEngineBackend } from "./backend.js";
import { createGame, gameStatus, chooseAndPlayGameMoveAsync } from "./game.js";
import { createInitialPosition, moveToNotation, parseFen, toFen } from "./board.js";
import { summarizeAlternativeEvidence, summarizeComparisonEvidence } from "./explanation-artifacts.js";
import { reviewGameWithBackend } from "./review.js";

const SIDES = Object.freeze(["red", "black"]);

export async function runSparringMatch(players = null, options = {}) {
  const entries = normalizeSparringPlayers(players);
  const referee = normalizeReferee(options.referee);
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

  const playElapsedMs = Math.round(performanceNow() - startedAt);
  const refereeReview = referee
    ? await runRefereeReview(referee, game.moves, initialPosition, options)
    : null;
  const moves = game.moves.map((move, index) => summarizeSparringMove(
    move,
    entries,
    refereeReview?.moves[index] ?? null
  ));
  const learningMoments = refereeReview
    ? summarizeLearningMoments(refereeReview.keyMoments, moves)
    : [];
  const elapsedMs = Math.round(performanceNow() - startedAt);

  return {
    initialFen: toFen(initialPosition),
    finalFen: toFen(game.position),
    status,
    stopReason,
    elapsedMs,
    playElapsedMs,
    reviewElapsedMs: refereeReview?.elapsedMs ?? 0,
    totalPlies: game.moves.length,
    players: {
      red: summarizePlayer(entries.red),
      black: summarizePlayer(entries.black)
    },
    referee: referee ? summarizePlayer(referee) : null,
    refereeReview: refereeReview ? summarizeRefereeReview(refereeReview, learningMoments) : null,
    learningMoments,
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
  const playerNativeOptions = formatPlayerNativeOptions([report.players.red, report.players.black]);
  if (playerNativeOptions) lines.push(`Native options: ${playerNativeOptions}`);
  if (report.refereeReview) {
    lines.push(`Referee: ${report.referee.name}, avg loss ${report.refereeReview.summary.averageCentipawnLoss} cp, ${report.learningMoments.length} learning moments`);
    if (report.referee.nativeOptions.length > 0) {
      lines.push(`Referee options: ${formatNativeOptions(report.referee.nativeOptions)}`);
    }
  }

  for (const move of report.moves.slice(0, maxMoves)) {
    const source = move.source ? `, ${move.source}` : "";
    const depth = `d${move.depth}`;
    const fallback = move.backendFallback ? ", fallback" : "";
    lines.push(`${move.ply}. ${capitalize(move.side)} ${move.notation} (${move.player.name}, ${depth}${source}${fallback})`);
    if (move.summary) lines.push(`  ${move.summary}`);
    if (move.comparison?.reason) lines.push(`  Compare: ${move.comparison.reason}`);
    for (const alternative of move.alternatives.slice(0, options.maxAlternatives ?? 2)) {
      lines.push(`  Alt ${alternative.rank}: ${formatAlternative(alternative)}`);
    }
  }

  const maxLearningMoments = options.maxLearningMoments ?? Math.min(3, report.learningMoments.length);
  if (maxLearningMoments > 0 && report.learningMoments.length > 0) {
    lines.push("Learning moments:");
    for (const moment of report.learningMoments.slice(0, maxLearningMoments)) {
      lines.push(`  Ply ${moment.ply} ${moment.notation}: ${moment.classification}, ${moment.centipawnLoss} cp loss`);
      if (moment.summary) lines.push(`    ${moment.summary}`);
    }
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

function normalizeReferee(entry) {
  if (!entry) return null;

  const engine = entry.engine ?? entry.backend ?? entry;
  for (const method of ["reviewMove", "openingBook", "play"]) {
    if (typeof engine?.[method] !== "function") {
      throw new Error(`Sparring referee is missing ${method}.`);
    }
  }

  return {
    side: "referee",
    id: entry.id ?? engine.id ?? "referee",
    name: entry.name ?? engine.name ?? "Referee",
    kind: entry.kind ?? engine.kind ?? "custom",
    features: [...(entry.features ?? engine.features ?? [])],
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
  const description = describeEngineBackend(entry.engine);

  return {
    id: entry.id,
    name: entry.name,
    side: entry.side,
    kind: entry.kind,
    features: [...entry.features],
    nativeOptions: description.nativeOptions,
    status: description.status
  };
}

function summarizeSparringMove(move, entries, reviewedMove = null) {
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
    scoreDetail: decision.scoreDetail ?? decision.explanation?.search?.scoreDetail ?? null,
    wdl: decision.wdl ?? decision.explanation?.search?.wdl ?? null,
    depth: decision.depth ?? 0,
    nodes: decision.nodes ?? 0,
    principalVariation: [...(decision.principalVariation ?? [])],
    summary: decision.explanation?.summary ?? "",
    reasons: [...(decision.explanation?.reasons ?? [])],
    comparison: summarizeComparisonEvidence(decision.explanation?.comparison),
    alternatives: summarizeAlternativeEvidence(decision.explanation?.alternatives),
    confidence: decision.explanation?.confidence ?? null,
    backendStatus: decision.backendStatus ?? null,
    backendFallback: decision.backendFallback ?? null,
    refereeReview: reviewedMove ? summarizeRefereeMove(reviewedMove) : null,
    review: move.review ?? null
  };
}

async function runRefereeReview(referee, moves, initialPosition, options) {
  const startedAt = performanceNow();
  const review = await reviewGameWithBackend(
    referee.engine,
    moves.map((move) => move.notation),
    {
      initialPosition,
      ...(options.refereeOptions ?? {})
    }
  );

  return {
    ...review,
    elapsedMs: Math.round(performanceNow() - startedAt)
  };
}

function summarizeRefereeMove(move) {
  const review = move.review;
  return {
    classification: review.classification,
    centipawnLoss: review.centipawnLoss,
    bestMove: notationFor(review.bestMove),
    bestScore: review.bestScore,
    playedScore: review.playedScore,
    playedScoreDetail: review.playedScoreDetail ?? null,
    playedWdl: review.playedWdl ?? null,
    bestScoreDetail: review.bestAnalysis?.scoreDetail ?? null,
    bestWdl: review.bestAnalysis?.wdl ?? null,
    depth: review.depth,
    nodes: review.nodes,
    mistakes: review.mistakes,
    summary: review.explanation?.summary ?? "",
    reasons: [...(review.explanation?.reasons ?? [])],
    bestComparison: summarizeComparisonEvidence(review.bestComparison ?? review.bestAnalysis?.explanation?.comparison),
    bestAlternatives: summarizeAlternativeEvidence(review.bestAlternatives ?? review.bestAnalysis?.explanation?.alternatives),
    book: move.book
  };
}

function notationFor(move) {
  if (!move) return null;
  return move.notation ?? moveToNotation(move);
}

function summarizeRefereeReview(review, learningMoments) {
  return {
    elapsedMs: review.elapsedMs,
    summary: review.summary,
    status: review.status,
    learningMoments,
    keyMoments: learningMoments
  };
}

function summarizeLearningMoments(keyMoments, moves) {
  return keyMoments.map((moment) => {
    const move = moves[moment.ply - 1] ?? null;
    return {
      ...moment,
      player: move?.player ?? null,
      source: move?.source ?? null,
      positionBefore: move?.positionBefore ?? null,
      positionAfter: move?.positionAfter ?? null
    };
  });
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

function formatPlayerNativeOptions(players) {
  return players
    .filter((player) => player.nativeOptions.length > 0)
    .map((player) => `${capitalize(player.side)} ${formatNativeOptions(player.nativeOptions)}`)
    .join("; ");
}

function formatNativeOptions(options) {
  return options.map((option) => {
    if (option.value === null) return option.name;
    return `${option.name}=${formatNativeOptionValue(option.value)}`;
  }).join(", ");
}

function formatAlternative(alternative) {
  const verdict = alternative.verdict ? `${alternative.verdict}, ` : "";
  const score = alternative.scoreText ?? formatCentipawns(alternative.score);
  const loss = Number.isFinite(alternative.centipawnLoss)
    ? `, loss ${alternative.centipawnLoss} cp`
    : "";
  const reply = alternative.expectedReply ? `, expects ${alternative.expectedReply}` : "";
  const wdl = alternative.wdl?.text ? `, WDL ${alternative.wdl.text}` : "";
  return `${alternative.move}: ${verdict}${score}${loss}${reply}${wdl}`;
}

function formatCentipawns(value) {
  const rounded = Math.round(value ?? 0);
  return `${rounded >= 0 ? "+" : ""}${rounded} cp`;
}

function formatNativeOptionValue(value) {
  if (Array.isArray(value)) return value.join(" ");
  return String(value);
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function performanceNow() {
  if (globalThis.performance?.now) return globalThis.performance.now();
  return Date.now();
}
