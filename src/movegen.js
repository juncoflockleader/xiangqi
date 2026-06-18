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

const MOVE_FILTER_ALL = 0;
const MOVE_FILTER_CAPTURES = 1;
const MOVE_FILTER_QUIETS = 2;

export function generateLegalMoves(position, side = position.turn) {
  return retainLegalGeneratedMoves(position, generatePseudoMoves(position, side), side);
}

export function generateCaptures(position, side = position.turn) {
  return retainLegalGeneratedMoves(position, generatePseudoCaptures(position, side), side);
}

export function generateQuietMoves(position, side = position.turn) {
  return retainLegalGeneratedMoves(position, generatePseudoMovesByFilter(position, side, MOVE_FILTER_QUIETS), side);
}

export function generatePseudoMoves(position, side = position.turn) {
  return generatePseudoMovesByFilter(position, side, MOVE_FILTER_ALL);
}

function generatePseudoCaptures(position, side = position.turn) {
  return generatePseudoMovesByFilter(position, side, MOVE_FILTER_CAPTURES);
}

function generatePseudoMovesByFilter(position, side, moveFilter) {
  const moves = [];

  for (let square = 0; square < position.board.length; square += 1) {
    const piece = position.board[square];
    if (!piece || piece.side !== side) continue;

    switch (piece.type) {
      case PIECES.KING:
        addKingMoves(position, square, piece, moves, moveFilter);
        break;
      case PIECES.ADVISOR:
        addAdvisorMoves(position, square, piece, moves, moveFilter);
        break;
      case PIECES.ELEPHANT:
        addElephantMoves(position, square, piece, moves, moveFilter);
        break;
      case PIECES.HORSE:
        addHorseMoves(position, square, piece, moves, moveFilter);
        break;
      case PIECES.ROOK:
        addRookMoves(position, square, piece, moves, moveFilter);
        break;
      case PIECES.CANNON:
        addCannonMoves(position, square, piece, moves, moveFilter);
        break;
      case PIECES.PAWN:
        addPawnMoves(position, square, piece, moves, moveFilter);
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

  return isSquareAttackedBy(position, kingSquare, opponent(side));
}

export function findKing(position, side) {
  for (let square = 0; square < position.board.length; square += 1) {
    const piece = position.board[square];
    if (piece?.side === side && piece.type === PIECES.KING) return square;
  }

  return -1;
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

function isSquareAttackedBy(position, square, attackerSide) {
  return isAttackedBySlidingPiece(position, square, attackerSide)
    || isAttackedByHorse(position, square, attackerSide)
    || isAttackedByPawn(position, square, attackerSide);
}

function isAttackedBySlidingPiece(position, square, attackerSide) {
  const targetFile = fileOf(square);
  const targetRank = rankOf(square);

  for (const [dx, dy] of ORTHOGONAL) {
    let file = targetFile + dx;
    let rank = targetRank + dy;
    let screenSeen = false;
    let distance = 1;

    while (isInside(file, rank)) {
      const source = indexOf(file, rank);
      const piece = position.board[source];

      if (!piece) {
        file += dx;
        rank += dy;
        distance += 1;
        continue;
      }

      if (!screenSeen) {
        if (piece.side === attackerSide) {
          if (piece.type === PIECES.ROOK) return true;
          if (piece.type === PIECES.KING && kingAttacksAlongLine(source, square, attackerSide, distance)) {
            return true;
          }
        }
        screenSeen = true;
        file += dx;
        rank += dy;
        distance += 1;
        continue;
      }

      if (piece.side === attackerSide && piece.type === PIECES.CANNON) return true;
      break;
    }
  }

  return false;
}

function kingAttacksAlongLine(source, target, attackerSide, distance) {
  if (fileOf(source) === fileOf(target)) return true;
  return distance === 1 && palaceContains(attackerSide, fileOf(target), rankOf(target));
}

function isAttackedByHorse(position, square, attackerSide) {
  const targetFile = fileOf(square);
  const targetRank = rankOf(square);

  for (const [dx, dy] of HORSE_DELTAS) {
    const sourceFile = targetFile - dx;
    const sourceRank = targetRank - dy;
    if (!isInside(sourceFile, sourceRank)) continue;

    const source = indexOf(sourceFile, sourceRank);
    const piece = position.board[source];
    if (piece?.side !== attackerSide || piece.type !== PIECES.HORSE) continue;

    const legFile = Math.abs(dx) === 2 ? sourceFile + Math.sign(dx) : sourceFile;
    const legRank = Math.abs(dy) === 2 ? sourceRank + Math.sign(dy) : sourceRank;
    if (!position.board[indexOf(legFile, legRank)]) return true;
  }

  return false;
}

function isAttackedByPawn(position, square, attackerSide) {
  const targetFile = fileOf(square);
  const targetRank = rankOf(square);
  const forwardSourceRank = targetRank - forwardDelta(attackerSide);

  if (isEnemyPawnAt(position, targetFile, forwardSourceRank, attackerSide)) return true;

  for (const sourceFile of [targetFile - 1, targetFile + 1]) {
    if (!isEnemyPawnAt(position, sourceFile, targetRank, attackerSide)) continue;
    if (hasCrossedRiver(attackerSide, targetRank)) return true;
  }

  return false;
}

function isEnemyPawnAt(position, file, rank, attackerSide) {
  if (!isInside(file, rank)) return false;
  const piece = position.board[indexOf(file, rank)];
  return piece?.side === attackerSide && piece.type === PIECES.PAWN;
}

export function isLegalMove(position, move, side = position.turn) {
  return generateLegalMoves(position, side).some(
    (legalMove) => legalMove.from === move.from && legalMove.to === move.to
  );
}

function isLegalGeneratedMove(position, move, side) {
  if (move.captured?.type === PIECES.KING) return false;
  const next = makeMoveWithTurn(position, move, side);
  return !isInCheck(next, side);
}

function retainLegalGeneratedMoves(position, moves, side) {
  let write = 0;

  for (let read = 0; read < moves.length; read += 1) {
    const move = moves[read];
    if (!isLegalGeneratedMove(position, move, side)) continue;
    moves[write] = move;
    write += 1;
  }

  moves.length = write;
  return moves;
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
  if (side === position.turn) {
    return makeMove(position, move);
  }

  const originalTurn = position.turn;
  const next = makeMove({ ...position, turn: side }, move);
  return { ...next, turn: opponent(side), fullmove: originalTurn === SIDES.BLACK ? (position.fullmove ?? 1) + 1 : position.fullmove ?? 1 };
}

function addMove(position, moves, from, to, piece, moveFilter = MOVE_FILTER_ALL) {
  const captured = position.board[to];
  if (captured?.side === piece.side) return;
  if (moveFilter === MOVE_FILTER_CAPTURES && !captured) return;
  if (moveFilter === MOVE_FILTER_QUIETS && captured) return;

  moves.push({
    from,
    to,
    piece,
    captured,
    notation: `${indexToCoord(from)}-${indexToCoord(to)}`
  });
}

function addKingMoves(position, from, piece, moves, moveFilter = MOVE_FILTER_ALL) {
  const file = fileOf(from);
  const rank = rankOf(from);

  for (const [dx, dy] of ORTHOGONAL) {
    const targetFile = file + dx;
    const targetRank = rank + dy;
    if (!palaceContains(piece.side, targetFile, targetRank)) continue;
    addMove(position, moves, from, indexOf(targetFile, targetRank), piece, moveFilter);
  }
}

function addAdvisorMoves(position, from, piece, moves, moveFilter = MOVE_FILTER_ALL) {
  const file = fileOf(from);
  const rank = rankOf(from);

  for (const [dx, dy] of DIAGONAL) {
    const targetFile = file + dx;
    const targetRank = rank + dy;
    if (!palaceContains(piece.side, targetFile, targetRank)) continue;
    addMove(position, moves, from, indexOf(targetFile, targetRank), piece, moveFilter);
  }
}

function addElephantMoves(position, from, piece, moves, moveFilter = MOVE_FILTER_ALL) {
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

    addMove(position, moves, from, indexOf(targetFile, targetRank), piece, moveFilter);
  }
}

function addHorseMoves(position, from, piece, moves, moveFilter = MOVE_FILTER_ALL) {
  const file = fileOf(from);
  const rank = rankOf(from);

  for (const [dx, dy] of HORSE_DELTAS) {
    const targetFile = file + dx;
    const targetRank = rank + dy;
    if (!isInside(targetFile, targetRank)) continue;

    const legFile = Math.abs(dx) === 2 ? file + Math.sign(dx) : file;
    const legRank = Math.abs(dy) === 2 ? rank + Math.sign(dy) : rank;
    if (position.board[indexOf(legFile, legRank)]) continue;

    addMove(position, moves, from, indexOf(targetFile, targetRank), piece, moveFilter);
  }
}

function addRookMoves(position, from, piece, moves, moveFilter = MOVE_FILTER_ALL) {
  addSlidingMoves(position, from, piece, moves, false, moveFilter);
}

function addCannonMoves(position, from, piece, moves, moveFilter = MOVE_FILTER_ALL) {
  addSlidingMoves(position, from, piece, moves, true, moveFilter);
}

function addSlidingMoves(position, from, piece, moves, isCannon, moveFilter = MOVE_FILTER_ALL) {
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
          if (moveFilter === MOVE_FILTER_CAPTURES) {
            targetFile += dx;
            targetRank += dy;
            continue;
          }
          addMove(position, moves, from, target, piece, moveFilter);
        } else {
          if (occupant.side !== piece.side) addMove(position, moves, from, target, piece, moveFilter);
          break;
        }
      } else if (!screenFound) {
        if (!occupant) {
          if (moveFilter === MOVE_FILTER_CAPTURES) {
            targetFile += dx;
            targetRank += dy;
            continue;
          }
          addMove(position, moves, from, target, piece, moveFilter);
        } else {
          screenFound = true;
        }
      } else if (occupant) {
        if (occupant.side !== piece.side) addMove(position, moves, from, target, piece, moveFilter);
        break;
      }

      targetFile += dx;
      targetRank += dy;
    }
  }
}

function addPawnMoves(position, from, piece, moves, moveFilter = MOVE_FILTER_ALL) {
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
    addMove(position, moves, from, indexOf(targetFile, targetRank), piece, moveFilter);
  }
}
