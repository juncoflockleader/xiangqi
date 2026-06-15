import { MATE_SCORE, PIECES, PIECE_NAMES, PIECE_VALUES } from "./constants.js";
import {
  makeMove,
  moveToNotation,
  opponent,
  pieceLabel
} from "./board.js";
import { generateLegalMoves, isInCheck } from "./movegen.js";
import { analyzeCapture, analyzeDiscoveredCheck, analyzeSkewer } from "./tactics.js";

export function analyzeThreats(position, side = position.turn, options = {}) {
  const limit = options.limit ?? 5;
  const threats = generateLegalMoves(position, side)
    .map((move) => describeThreat(position, move))
    .filter((threat) => threat.score > 0)
    .sort((a, b) => b.score - a.score || a.notation.localeCompare(b.notation));

  return threats.slice(0, limit);
}

export function analyzePressure(position, options = {}) {
  const side = options.side ?? position.turn;
  const enemy = opponent(side);

  return {
    side,
    inCheck: isInCheck(position, side),
    threats: analyzeThreats(position, side, { limit: options.limit ?? 5 }),
    opponentThreats: analyzeThreats(position, enemy, { limit: options.limit ?? 5 })
  };
}

export function topThreat(position, side = position.turn) {
  return analyzeThreats(position, side, { limit: 1 })[0] ?? null;
}

function describeThreat(position, move) {
  const after = makeMove(position, move);
  const givesCheck = isInCheck(after, after.turn);
  const replies = givesCheck ? generateLegalMoves(after, after.turn) : [];
  const isMate = givesCheck && replies.length === 0;
  const capture = analyzeCapture(position, move);
  const discoveredCheck = analyzeDiscoveredCheck(position, move);
  const skewer = analyzeSkewer(position, move);
  const score = scoreThreat({ move, capture, discoveredCheck, skewer, givesCheck, isMate });
  const motifs = [];

  if (isMate || move.captured?.type === PIECES.KING) motifs.push("decisive general threat");
  else if (givesCheck) motifs.push("check");
  if (discoveredCheck) motifs.push("discovered check");
  if (skewer) motifs.push("skewer");
  if (move.captured && move.captured.type !== PIECES.KING) motifs.push(`wins ${PIECE_NAMES[move.captured.type]}`);
  if (capture?.isSafe) motifs.push("safe capture");
  if (capture && capture.exchangeScore < 0) motifs.push("recapture risk");

  return {
    move,
    notation: moveToNotation(move),
    piece: move.piece,
    captured: move.captured,
    score,
    givesCheck,
    isMate,
    capture,
    discoveredCheck,
    skewer,
    motifs,
    summary: summarizeThreat(move, { capture, discoveredCheck, skewer, givesCheck, isMate })
  };
}

function scoreThreat({ move, capture, discoveredCheck, skewer, givesCheck, isMate }) {
  if (isMate) return MATE_SCORE;
  if (move.captured?.type === PIECES.KING) return MATE_SCORE - 1;

  let score = 0;
  if (givesCheck) score += 250;
  if (discoveredCheck) score += 140;
  if (skewer) score += 130;
  if (move.captured) {
    score += PIECE_VALUES[move.captured.type];
    score += Math.max(-200, Math.min(400, capture.exchangeScore));
    if (capture.isSafe) score += 80;
  }

  return score;
}

function summarizeThreat(move, { capture, discoveredCheck, skewer, givesCheck, isMate }) {
  const actor = pieceLabel(move.piece);
  const notation = moveToNotation(move);

  if (move.captured?.type === PIECES.KING) return `${actor} ${notation} threatens the opposing general.`;
  if (isMate) return `${actor} ${notation} threatens checkmate.`;
  if (discoveredCheck) return discoveredCheck.summary;
  if (skewer) return skewer.summary;
  if (capture?.isSafe) {
    return `${actor} ${notation} wins a ${PIECE_NAMES[move.captured.type]} cleanly.`;
  }
  if (move.captured) {
    return `${actor} ${notation} attacks a ${PIECE_NAMES[move.captured.type]}.`;
  }
  if (givesCheck) return `${actor} ${notation} gives check.`;

  return `${actor} ${notation} creates pressure.`;
}
