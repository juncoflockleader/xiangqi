import { PIECE_NAMES, PIECE_VALUES } from "./constants.js";
import { makeMove, moveToNotation } from "./board.js";
import { generateLegalMoves } from "./movegen.js";

export function analyzeCapture(position, move) {
  if (!move.captured) return null;

  const capturedValue = PIECE_VALUES[move.captured.type];
  const attackerValue = PIECE_VALUES[move.piece.type];
  const after = makeMove(position, move);
  const recaptures = generateLegalMoves(after, after.turn)
    .filter((reply) => reply.to === move.to && reply.captured)
    .sort((a, b) => PIECE_VALUES[a.piece.type] - PIECE_VALUES[b.piece.type])
    .map((reply) => ({
      move: reply,
      notation: moveToNotation(reply),
      piece: reply.piece,
      pieceName: PIECE_NAMES[reply.piece.type],
      pieceValue: PIECE_VALUES[reply.piece.type]
    }));

  const cheapestRecapture = recaptures[0] ?? null;
  const exchangeScore = recaptures.length === 0
    ? capturedValue
    : capturedValue - attackerValue;

  return {
    capturedValue,
    attackerValue,
    grossGain: capturedValue,
    exchangeScore,
    isSafe: recaptures.length === 0 || exchangeScore >= 0,
    isWinning: exchangeScore > 0,
    recaptures,
    cheapestRecapture,
    summary: summarizeCapture(move, exchangeScore, cheapestRecapture)
  };
}

export function captureExchangeScore(position, move) {
  return analyzeCapture(position, move)?.exchangeScore ?? 0;
}

function summarizeCapture(move, exchangeScore, cheapestRecapture) {
  const victim = PIECE_NAMES[move.captured.type];
  const attacker = PIECE_NAMES[move.piece.type];

  if (!cheapestRecapture) {
    return `The ${attacker} wins a ${victim} without an immediate recapture.`;
  }

  if (exchangeScore >= 0) {
    return `The ${attacker} can be recaptured by a ${cheapestRecapture.pieceName}, but the exchange remains acceptable.`;
  }

  return `The ${attacker} captures a ${victim}, but ${cheapestRecapture.notation} can recapture it.`;
}
