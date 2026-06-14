import { PIECE_NAMES } from "./constants.js";
import { makeMove, moveToNotation, sameMove } from "./board.js";
import { analyzeThreats, topThreat } from "./pressure.js";
import { analyzeCapture } from "./tactics.js";
import { isInCheck } from "./movegen.js";

const MATERIAL_SWING_THRESHOLD = 120;
const TACTICAL_THREAT_THRESHOLD = 400;
const THREAT_GAP_THRESHOLD = 180;

export function analyzeReviewMistakes(position, review) {
  if (!review || review.isBestMove || review.centipawnLoss <= 15 || !review.bestMove) {
    return emptyMistakeProfile();
  }

  const playedMove = review.move;
  const bestMove = review.bestMove;
  const playedAfter = makeMove(position, playedMove);
  const bestAfter = makeMove(position, bestMove);
  const items = [];

  addMissedMaterial(items, position, playedMove, bestMove);
  addUnsafeCapture(items, position, playedMove);
  addMissedForcingMove(items, position, playedMove, bestMove);
  addAllowedThreat(items, playedAfter, bestAfter);

  if (items.length === 0 && review.centipawnLoss >= 60) {
    items.push({
      category: "positional-drift",
      severity: Math.min(70, Math.round(review.centipawnLoss / 8)),
      tag: "positional",
      summary: `${moveToNotation(playedMove)} gives up evaluation without a clear tactical reason.`,
      detail: "The engine's preferred line keeps more long-term coordination."
    });
  }

  const categories = items.sort((a, b) => b.severity - a.severity);
  return {
    primary: categories[0]?.category ?? "none",
    categories,
    tags: [...new Set(categories.map((item) => item.tag))],
    summary: categories[0]?.summary ?? "No clear mistake pattern was detected."
  };
}

function addMissedMaterial(items, position, playedMove, bestMove) {
  if (!bestMove.captured || sameMove(playedMove, bestMove)) return;

  const bestCapture = analyzeCapture(position, bestMove);
  const playedCapture = analyzeCapture(position, playedMove);
  const bestGain = bestCapture?.exchangeScore ?? 0;
  const playedGain = playedCapture?.exchangeScore ?? 0;
  const swing = bestGain - playedGain;

  if (bestGain < MATERIAL_SWING_THRESHOLD || swing < MATERIAL_SWING_THRESHOLD) return;

  items.push({
    category: "missed-material",
    severity: Math.min(100, Math.round(swing / 8)),
    tag: "material",
    summary: `${moveToNotation(playedMove)} missed ${moveToNotation(bestMove)}, which wins a ${PIECE_NAMES[bestMove.captured.type]}.`,
    detail: bestCapture.summary
  });
}

function addUnsafeCapture(items, position, playedMove) {
  if (!playedMove.captured) return;

  const capture = analyzeCapture(position, playedMove);
  if (!capture || capture.exchangeScore >= -50) return;

  items.push({
    category: "unsafe-capture",
    severity: Math.min(100, Math.round(Math.abs(capture.exchangeScore) / 8)),
    tag: "tactics",
    summary: `${moveToNotation(playedMove)} is tactically unsafe after recaptures.`,
    detail: capture.summary
  });
}

function addMissedForcingMove(items, position, playedMove, bestMove) {
  const playedAfter = makeMove(position, playedMove);
  const bestAfter = makeMove(position, bestMove);
  const bestChecks = isInCheck(bestAfter, bestAfter.turn);
  const playedChecks = isInCheck(playedAfter, playedAfter.turn);

  if (bestChecks && !playedChecks) {
    items.push({
      category: "missed-check",
      severity: 55,
      tag: "forcing",
      summary: `${moveToNotation(playedMove)} missed the forcing check ${moveToNotation(bestMove)}.`,
      detail: "Checking moves can seize tempo because the opponent must answer the general threat."
    });
  }

  const bestThreat = analyzeThreats(bestAfter, position.turn, { limit: 1 })[0] ?? null;
  const playedThreat = analyzeThreats(playedAfter, position.turn, { limit: 1 })[0] ?? null;
  if (bestThreat && bestThreat.score >= TACTICAL_THREAT_THRESHOLD && (!playedThreat || playedThreat.score + THREAT_GAP_THRESHOLD < bestThreat.score)) {
    items.push({
      category: "missed-threat",
      severity: Math.min(90, Math.round(bestThreat.score / 12)),
      tag: "initiative",
      summary: `${moveToNotation(playedMove)} missed a stronger threat from ${moveToNotation(bestMove)}.`,
      detail: bestThreat.summary
    });
  }
}

function addAllowedThreat(items, playedAfter, bestAfter) {
  const playedThreat = topThreat(playedAfter, playedAfter.turn);
  const bestThreat = topThreat(bestAfter, bestAfter.turn);

  if (!playedThreat || playedThreat.score < TACTICAL_THREAT_THRESHOLD) return;
  if (bestThreat && bestThreat.score + THREAT_GAP_THRESHOLD >= playedThreat.score) return;

  items.push({
    category: "allowed-threat",
    severity: Math.min(95, Math.round(playedThreat.score / 10)),
    tag: "defense",
    summary: `The move allows ${playedThreat.notation}, a strong reply for the opponent.`,
    detail: playedThreat.summary
  });
}

function emptyMistakeProfile() {
  return {
    primary: "none",
    categories: [],
    tags: [],
    summary: "No mistake pattern was detected."
  };
}
