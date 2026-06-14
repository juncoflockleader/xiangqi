import {
  BOARD_FILES,
  BOARD_RANKS,
  PIECE_NAMES,
  PIECE_VALUES,
  PIECES,
  SIDES
} from "./constants.js";
import {
  fileOf,
  forwardDelta,
  hasCrossedRiver,
  indexOf,
  isInside,
  opponent,
  rankOf
} from "./board.js";
import { generatePseudoMoves, isInCheck } from "./movegen.js";

const MOBILITY_WEIGHTS = Object.freeze({
  [PIECES.KING]: 1,
  [PIECES.ADVISOR]: 1,
  [PIECES.ELEPHANT]: 1,
  [PIECES.HORSE]: 7,
  [PIECES.ROOK]: 5,
  [PIECES.CANNON]: 4,
  [PIECES.PAWN]: 2
});

export function evaluatePosition(position, perspective = position.turn, options = {}) {
  const terms = {
    [SIDES.RED]: createTerms(),
    [SIDES.BLACK]: createTerms()
  };

  for (let square = 0; square < position.board.length; square += 1) {
    const piece = position.board[square];
    if (!piece) continue;

    terms[piece.side].material += materialValue(piece, square);
    terms[piece.side].placement += placementValue(piece, square);
    terms[piece.side].pawnStructure += pawnValue(piece, square);
    terms[piece.side].kingSafety += localDefenseValue(position, piece, square);
    terms[piece.side].coordination += coordinationValue(position, piece, square);
  }

  for (const side of [SIDES.RED, SIDES.BLACK]) {
    const pseudoMoves = generatePseudoMoves(position, side);
    terms[side].mobility += mobilityValue(pseudoMoves);
    terms[side].threats += threatValue(pseudoMoves);
    terms[side].kingSafety += globalKingSafety(position, side);

    if (isInCheck(position, opponent(side))) {
      terms[side].threats += 45;
    }
  }

  const red = totalTerms(terms[SIDES.RED]);
  const black = totalTerms(terms[SIDES.BLACK]);
  const signed = red - black;
  const score = perspective === SIDES.RED ? signed : -signed;

  if (!options.detailed) {
    return { score };
  }

  return {
    score,
    sideScores: {
      [SIDES.RED]: red,
      [SIDES.BLACK]: black
    },
    terms,
    difference: diffTerms(terms, perspective)
  };
}

export function evaluateMoveDelta(before, after, perspective) {
  const beforeEval = evaluatePosition(before, perspective, { detailed: true });
  const afterEval = evaluatePosition(after, perspective, { detailed: true });
  const delta = {};

  for (const key of Object.keys(beforeEval.difference)) {
    delta[key] = afterEval.difference[key] - beforeEval.difference[key];
  }

  return {
    before: beforeEval.score,
    after: afterEval.score,
    deltaScore: afterEval.score - beforeEval.score,
    delta
  };
}

export function describeEvaluationTerms(delta) {
  return Object.entries(delta)
    .filter(([, value]) => Math.abs(value) >= 8)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 4)
    .map(([term, value]) => ({
      term,
      value,
      text: `${value >= 0 ? "improves" : "concedes"} ${readableTerm(term)} by ${Math.abs(Math.round(value))}`
    }));
}

function createTerms() {
  return {
    material: 0,
    placement: 0,
    mobility: 0,
    threats: 0,
    pawnStructure: 0,
    kingSafety: 0,
    coordination: 0
  };
}

function totalTerms(terms) {
  return Object.values(terms).reduce((sum, value) => sum + value, 0);
}

function diffTerms(terms, perspective) {
  const enemy = opponent(perspective);
  const diff = {};

  for (const key of Object.keys(terms[perspective])) {
    diff[key] = terms[perspective][key] - terms[enemy][key];
  }

  return diff;
}

function materialValue(piece, square) {
  if (piece.type !== PIECES.PAWN) return PIECE_VALUES[piece.type];

  const rank = rankOf(square);
  const progress = piece.side === SIDES.RED ? BOARD_RANKS - 1 - rank : rank;
  return PIECE_VALUES[piece.type] + progress * 9 + (hasCrossedRiver(piece.side, rank) ? 45 : 0);
}

function placementValue(piece, square) {
  const file = fileOf(square);
  const rank = rankOf(square);
  const centerFileBonus = 4 - Math.abs(file - 4);
  const sideProgress = piece.side === SIDES.RED ? BOARD_RANKS - 1 - rank : rank;
  const palaceDistance = Math.abs(file - 4) + Math.abs(rank - (piece.side === SIDES.RED ? 8 : 1));

  switch (piece.type) {
    case PIECES.KING:
      return 25 - palaceDistance * 6;
    case PIECES.ADVISOR:
      return 12 - palaceDistance * 2;
    case PIECES.ELEPHANT:
      return 14 + centerFileBonus * 4;
    case PIECES.HORSE:
      return centerFileBonus * 12 + sideProgress * 4;
    case PIECES.ROOK:
      return centerFileBonus * 7 + sideProgress * 3;
    case PIECES.CANNON:
      return centerFileBonus * 9 + (hasCrossedRiver(piece.side, rank) ? 12 : 0);
    case PIECES.PAWN:
      return centerFileBonus * 6 + sideProgress * 7;
    default:
      return 0;
  }
}

function pawnValue(piece, square) {
  if (piece.type !== PIECES.PAWN) return 0;

  const rank = rankOf(square);
  const file = fileOf(square);
  const riverBonus = hasCrossedRiver(piece.side, rank) ? 35 : 0;
  const centralPassedBonus = Math.max(0, 3 - Math.abs(file - 4)) * 8;
  const lastRankPenalty = (piece.side === SIDES.RED ? rank === 0 : rank === BOARD_RANKS - 1) ? -18 : 0;
  return riverBonus + centralPassedBonus + lastRankPenalty;
}

function coordinationValue(position, piece, square) {
  if (piece.type === PIECES.HORSE) {
    return horseLegCoordination(position, piece, square);
  }

  return 0;
}

function horseLegCoordination(position, piece, square) {
  const file = fileOf(square);
  const rank = rankOf(square);
  const legSquares = [
    [file, rank - 1],
    [file + 1, rank],
    [file, rank + 1],
    [file - 1, rank]
  ];
  let blockedLegs = 0;
  let score = 0;

  for (const [legFile, legRank] of legSquares) {
    if (!isInside(legFile, legRank)) continue;
    const blocker = position.board[indexOf(legFile, legRank)];
    if (!blocker) continue;

    blockedLegs += 1;
    score -= blocker.side === piece.side ? 18 : 10;
  }

  return blockedLegs === 0 ? score + 18 : score;
}

function localDefenseValue(position, piece, square) {
  if (piece.type !== PIECES.ADVISOR && piece.type !== PIECES.ELEPHANT) return 0;

  const ownKingSquare = position.board.findIndex(
    (candidate) => candidate?.side === piece.side && candidate.type === PIECES.KING
  );
  if (ownKingSquare === -1) return 0;

  const distance = Math.abs(fileOf(square) - fileOf(ownKingSquare)) + Math.abs(rankOf(square) - rankOf(ownKingSquare));
  return Math.max(0, 28 - distance * 6);
}

function mobilityValue(moves) {
  return moves.reduce((sum, move) => sum + (MOBILITY_WEIGHTS[move.piece.type] ?? 1), 0);
}

function threatValue(moves) {
  let score = 0;

  for (const move of moves) {
    if (!move.captured) continue;
    const victim = PIECE_VALUES[move.captured.type];
    const attacker = PIECE_VALUES[move.piece.type];
    score += Math.max(4, victim * 0.08 - attacker * 0.01);
  }

  return score;
}

function globalKingSafety(position, side) {
  const kingSquare = position.board.findIndex((piece) => piece?.side === side && piece.type === PIECES.KING);
  if (kingSquare === -1) return -20000;

  let score = 0;
  const file = fileOf(kingSquare);
  const rank = rankOf(kingSquare);
  const enemy = opponent(side);

  const guardCount = countGuards(position, side);
  score += Math.min(4, guardCount) * 18;

  if (isOpenFileTowardEnemyKing(position, kingSquare, side)) {
    score -= 80;
  }

  for (let direction of [-1, 1]) {
    const neighborFile = file + direction;
    if (neighborFile < 0 || neighborFile >= BOARD_FILES) continue;
    const neighbor = position.board[indexOf(neighborFile, rank)];
    if (!neighbor || neighbor.side !== side) score -= 6;
  }

  const enemyForwardRank = rank - forwardDelta(enemy);
  if (enemyForwardRank >= 0 && enemyForwardRank < BOARD_RANKS) {
    const frontal = position.board[indexOf(file, enemyForwardRank)];
    if (frontal?.side === enemy && frontal.type === PIECES.PAWN) score -= 45;
  }

  return score;
}

function countGuards(position, side) {
  return position.board.filter(
    (piece) => piece?.side === side && (piece.type === PIECES.ADVISOR || piece.type === PIECES.ELEPHANT)
  ).length;
}

function isOpenFileTowardEnemyKing(position, kingSquare, side) {
  const file = fileOf(kingSquare);
  const rank = rankOf(kingSquare);
  const step = side === SIDES.RED ? -1 : 1;

  for (let targetRank = rank + step; targetRank >= 0 && targetRank < BOARD_RANKS; targetRank += step) {
    const piece = position.board[indexOf(file, targetRank)];
    if (!piece) continue;
    return piece.type === PIECES.KING && piece.side !== side;
  }

  return false;
}

function readableTerm(term) {
  const labels = {
    material: "material balance",
    placement: "piece placement",
    mobility: "mobility",
    threats: "tactical pressure",
    pawnStructure: "pawn progress",
    kingSafety: "king safety",
    coordination: "piece coordination"
  };

  return labels[term] ?? term;
}

export function describeCapture(move) {
  if (!move.captured) return null;
  return `wins a ${PIECE_NAMES[move.captured.type]} with the ${PIECE_NAMES[move.piece.type]}`;
}
