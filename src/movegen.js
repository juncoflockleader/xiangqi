import { PIECES, SIDES } from "./constants.js";
import {
  fileOf,
  forwardDelta,
  hasCrossedRiver,
  indexOf,
  indexToCoord,
  isInside,
  makeMove,
  moveToNotation,
  opponent,
  ownRiverSide,
  palaceContains,
  rankOf
} from "./board.js";

const ORTHOGONAL = Object.freeze([
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0]
]);

const DIAGONAL = Object.freeze([
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1]
]);

const HORSE_DELTAS = Object.freeze([
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2]
]);

export function generateLegalMoves(position, side = position.turn) {
  return generatePseudoMoves(position, side).filter((move) => {
    const next = makeMoveWithTurn(position, move, side);
    return !isInCheck(next, side);
  });
}

export function generateCaptures(position, side = position.turn) {
  return generateLegalMoves(position, side).filter((move) => move.captured);
}

export function generatePseudoMoves(position, side = position.turn) {
  const moves = [];

  for (let square = 0; square < position.board.length; square += 1) {
    const piece = position.board[square];
    if (!piece || piece.side !== side) continue;

    switch (piece.type) {
      case PIECES.KING:
        addKingMoves(position, square, piece, moves);
        break;
      case PIECES.ADVISOR:
        addAdvisorMoves(position, square, piece, moves);
        break;
      case PIECES.ELEPHANT:
        addElephantMoves(position, square, piece, moves);
        break;
      case PIECES.HORSE:
        addHorseMoves(position, square, piece, moves);
        break;
      case PIECES.ROOK:
        addRookMoves(position, square, piece, moves);
        break;
      case PIECES.CANNON:
        addCannonMoves(position, square, piece, moves);
        break;
      case PIECES.PAWN:
        addPawnMoves(position, square, piece, moves);
        break;
      default:
        throw new Error(`Unsupported piece type: ${piece.type}`);
    }
  }

  return moves;
}

export function isInCheck(position, side = position.turn) {
  const kingSquare = findKing(position, side);
  if (kingSquare === -1) return true;

  if (generalsFace(position)) return true;

  const enemy = opponent(side);
  return generatePseudoMoves(position, enemy).some((move) => move.to === kingSquare);
}

export function findKing(position, side) {
  return position.board.findIndex((piece) => piece?.side === side && piece.type === PIECES.KING);
}

export function generalsFace(position) {
  const redKing = findKing(position, SIDES.RED);
  const blackKing = findKing(position, SIDES.BLACK);

  if (redKing === -1 || blackKing === -1) return false;
  if (fileOf(redKing) !== fileOf(blackKing)) return false;

  const file = fileOf(redKing);
  const start = Math.min(rankOf(redKing), rankOf(blackKing)) + 1;
  const end = Math.max(rankOf(redKing), rankOf(blackKing));

  for (let rank = start; rank < end; rank += 1) {
    if (position.board[indexOf(file, rank)]) return false;
  }

  return true;
}

export function isLegalMove(position, move, side = position.turn) {
  return generateLegalMoves(position, side).some(
    (legalMove) => legalMove.from === move.from && legalMove.to === move.to
  );
}

export function applyLegalMove(position, move, side = position.turn) {
  const legalMove = generateLegalMoves(position, side).find(
    (candidate) => candidate.from === move.from && candidate.to === move.to
  );

  if (!legalMove) {
    throw new Error(`Illegal move: ${moveToNotation(move)}`);
  }

  return makeMoveWithTurn(position, legalMove, side);
}

export function annotateMove(position, move) {
  const moving = position.board[move.from] ?? move.piece;
  const captured = position.board[move.to] ?? move.captured ?? null;
  const annotated = {
    ...move,
    piece: moving,
    captured,
    notation: moveToNotation(move)
  };

  const next = makeMoveWithTurn(position, annotated, moving?.side ?? position.turn);
  annotated.givesCheck = isInCheck(next, opponent(moving?.side ?? position.turn));
  return annotated;
}

export function legalMovesWithNotation(position, side = position.turn) {
  return generateLegalMoves(position, side).map((move) => annotateMove(position, move));
}

function makeMoveWithTurn(position, move, side) {
  const originalTurn = position.turn;
  const next = makeMove({ ...position, turn: side }, move);
  return { ...next, turn: opponent(side), fullmove: originalTurn === SIDES.BLACK ? (position.fullmove ?? 1) + 1 : position.fullmove ?? 1 };
}

function addMove(position, moves, from, to, piece) {
  const captured = position.board[to];
  if (captured?.side === piece.side) return;

  moves.push({
    from,
    to,
    piece,
    captured,
    notation: `${indexToCoord(from)}-${indexToCoord(to)}`
  });
}

function addKingMoves(position, from, piece, moves) {
  const file = fileOf(from);
  const rank = rankOf(from);

  for (const [dx, dy] of ORTHOGONAL) {
    const targetFile = file + dx;
    const targetRank = rank + dy;
    if (!palaceContains(piece.side, targetFile, targetRank)) continue;
    addMove(position, moves, from, indexOf(targetFile, targetRank), piece);
  }
}

function addAdvisorMoves(position, from, piece, moves) {
  const file = fileOf(from);
  const rank = rankOf(from);

  for (const [dx, dy] of DIAGONAL) {
    const targetFile = file + dx;
    const targetRank = rank + dy;
    if (!palaceContains(piece.side, targetFile, targetRank)) continue;
    addMove(position, moves, from, indexOf(targetFile, targetRank), piece);
  }
}

function addElephantMoves(position, from, piece, moves) {
  const file = fileOf(from);
  const rank = rankOf(from);

  for (const [dx, dy] of DIAGONAL) {
    const targetFile = file + dx * 2;
    const targetRank = rank + dy * 2;
    const eyeFile = file + dx;
    const eyeRank = rank + dy;

    if (!isInside(targetFile, targetRank)) continue;
    if (!ownRiverSide(piece.side, targetRank)) continue;
    if (position.board[indexOf(eyeFile, eyeRank)]) continue;

    addMove(position, moves, from, indexOf(targetFile, targetRank), piece);
  }
}

function addHorseMoves(position, from, piece, moves) {
  const file = fileOf(from);
  const rank = rankOf(from);

  for (const [dx, dy] of HORSE_DELTAS) {
    const targetFile = file + dx;
    const targetRank = rank + dy;
    if (!isInside(targetFile, targetRank)) continue;

    const legFile = Math.abs(dx) === 2 ? file + Math.sign(dx) : file;
    const legRank = Math.abs(dy) === 2 ? rank + Math.sign(dy) : rank;
    if (position.board[indexOf(legFile, legRank)]) continue;

    addMove(position, moves, from, indexOf(targetFile, targetRank), piece);
  }
}

function addRookMoves(position, from, piece, moves) {
  addSlidingMoves(position, from, piece, moves, false);
}

function addCannonMoves(position, from, piece, moves) {
  addSlidingMoves(position, from, piece, moves, true);
}

function addSlidingMoves(position, from, piece, moves, isCannon) {
  const file = fileOf(from);
  const rank = rankOf(from);

  for (const [dx, dy] of ORTHOGONAL) {
    let targetFile = file + dx;
    let targetRank = rank + dy;
    let screenFound = false;

    while (isInside(targetFile, targetRank)) {
      const target = indexOf(targetFile, targetRank);
      const occupant = position.board[target];

      if (!isCannon) {
        if (!occupant) {
          addMove(position, moves, from, target, piece);
        } else {
          if (occupant.side !== piece.side) addMove(position, moves, from, target, piece);
          break;
        }
      } else if (!screenFound) {
        if (!occupant) {
          addMove(position, moves, from, target, piece);
        } else {
          screenFound = true;
        }
      } else if (occupant) {
        if (occupant.side !== piece.side) addMove(position, moves, from, target, piece);
        break;
      }

      targetFile += dx;
      targetRank += dy;
    }
  }
}

function addPawnMoves(position, from, piece, moves) {
  const file = fileOf(from);
  const rank = rankOf(from);
  const directions = [[0, forwardDelta(piece.side)]];

  if (hasCrossedRiver(piece.side, rank)) {
    directions.push([-1, 0], [1, 0]);
  }

  for (const [dx, dy] of directions) {
    const targetFile = file + dx;
    const targetRank = rank + dy;
    if (!isInside(targetFile, targetRank)) continue;
    addMove(position, moves, from, indexOf(targetFile, targetRank), piece);
  }
}
