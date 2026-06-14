import { makeMove, moveToNotation } from "./board.js";
import { generateLegalMoves } from "./movegen.js";

export function perft(position, depth) {
  validateDepth(depth);
  if (depth === 0) return 1;

  const moves = generateLegalMoves(position, position.turn);
  if (depth === 1) return moves.length;

  let nodes = 0;
  for (const move of moves) {
    nodes += perft(makeMove(position, move), depth - 1);
  }

  return nodes;
}

export function perftDivide(position, depth) {
  validateDepth(depth);
  if (depth === 0) return [];

  return generateLegalMoves(position, position.turn)
    .map((move) => ({
      move,
      notation: moveToNotation(move),
      nodes: perft(makeMove(position, move), depth - 1)
    }))
    .sort((a, b) => a.notation.localeCompare(b.notation));
}

function validateDepth(depth) {
  if (!Number.isInteger(depth) || depth < 0) {
    throw new Error(`Perft depth must be a non-negative integer, got ${depth}.`);
  }
}
