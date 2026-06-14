import { BOARD_SIZE, PIECES, SIDES } from "./constants.js";

const TYPE_ORDER = Object.freeze([
  PIECES.KING,
  PIECES.ADVISOR,
  PIECES.ELEPHANT,
  PIECES.HORSE,
  PIECES.ROOK,
  PIECES.CANNON,
  PIECES.PAWN
]);

const PIECE_HASH_COUNT = TYPE_ORDER.length * 2;
const ZOBRIST_SEED = 0x584951414e475149n;
const ZOBRIST = createZobristTable();
const SIDE_TO_MOVE_HASH = nextSplitMix64(0x5455524e5f424c4bn);

export function hashPosition(position) {
  let hash = 0n;

  for (let square = 0; square < position.board.length; square += 1) {
    const piece = position.board[square];
    if (!piece) continue;
    hash ^= ZOBRIST[pieceHashIndex(piece)][square];
  }

  if (position.turn === SIDES.BLACK) {
    hash ^= SIDE_TO_MOVE_HASH;
  }

  return toHashString(hash);
}

export function hashBoard(board) {
  return hashPosition({ board, turn: SIDES.RED });
}

function createZobristTable() {
  const table = [];
  let state = ZOBRIST_SEED;

  for (let pieceIndex = 0; pieceIndex < PIECE_HASH_COUNT; pieceIndex += 1) {
    const squares = [];
    for (let square = 0; square < BOARD_SIZE; square += 1) {
      state = nextSplitMix64(state);
      squares.push(state);
    }
    table.push(squares);
  }

  return table;
}

function pieceHashIndex(piece) {
  const typeIndex = TYPE_ORDER.indexOf(piece.type);
  if (typeIndex === -1) {
    throw new Error(`Unsupported piece type for hash: ${piece.type}`);
  }

  return typeIndex + (piece.side === SIDES.RED ? 0 : TYPE_ORDER.length);
}

function nextSplitMix64(value) {
  let z = BigInt.asUintN(64, value + 0x9e3779b97f4a7c15n);
  z = BigInt.asUintN(64, (z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n);
  z = BigInt.asUintN(64, (z ^ (z >> 27n)) * 0x94d049bb133111ebn);
  return BigInt.asUintN(64, z ^ (z >> 31n));
}

function toHashString(hash) {
  return hash.toString(16).padStart(16, "0");
}
