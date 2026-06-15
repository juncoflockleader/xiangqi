import {
  fileOf,
  indexOf,
  makeMove,
  moveToNotation,
  parseMoveNotation,
  rankOf
} from "./board.js";
import { BOARD_FILES, BOARD_RANKS, PIECES, SIDES } from "./constants.js";

const RED_NUMERALS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
const BLACK_NUMERALS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

const PIECE_NAMES_ZH = Object.freeze({
  [SIDES.RED]: Object.freeze({
    [PIECES.KING]: "帥",
    [PIECES.ADVISOR]: "仕",
    [PIECES.ELEPHANT]: "相",
    [PIECES.HORSE]: "傌",
    [PIECES.ROOK]: "俥",
    [PIECES.CANNON]: "炮",
    [PIECES.PAWN]: "兵"
  }),
  [SIDES.BLACK]: Object.freeze({
    [PIECES.KING]: "將",
    [PIECES.ADVISOR]: "士",
    [PIECES.ELEPHANT]: "象",
    [PIECES.HORSE]: "馬",
    [PIECES.ROOK]: "車",
    [PIECES.CANNON]: "砲",
    [PIECES.PAWN]: "卒"
  })
});

const FRONT_LABELS = Object.freeze(["前", "中", "後"]);
const FILE_TARGET_TYPES = new Set([PIECES.ADVISOR, PIECES.ELEPHANT, PIECES.HORSE]);

export function moveToChineseNotation(position, moveOrNotation) {
  const move = normalizeMove(moveOrNotation);
  const piece = move.piece ?? position.board[move.from];
  if (!piece) return notationFromMove(moveOrNotation);

  const fromFile = fileOf(move.from);
  const fromRank = rankOf(move.from);
  const toFile = fileOf(move.to);
  const toRank = rankOf(move.to);
  const direction = moveDirection(piece.side, fromRank, toRank);
  const destination = destinationText(piece, fromFile, fromRank, toFile, toRank, direction);

  return [
    PIECE_NAMES_ZH[piece.side]?.[piece.type] ?? "?",
    originText(position, piece, fromFile, fromRank),
    direction,
    destination
  ].join("");
}

export function lineToChineseNotation(position, moves) {
  const result = [];
  let current = position;

  for (const moveOrNotation of moves ?? []) {
    const move = normalizeMove(moveOrNotation);
    const text = moveToChineseNotation(current, move);
    result.push(text);

    try {
      current = makeMove(current, move);
    } catch {
      break;
    }
  }

  return result;
}

function normalizeMove(moveOrNotation) {
  if (typeof moveOrNotation === "string") return parseMoveNotation(moveOrNotation);
  return {
    ...moveOrNotation,
    notation: moveOrNotation.notation ?? moveToNotation(moveOrNotation)
  };
}

function notationFromMove(moveOrNotation) {
  if (!moveOrNotation) return null;
  if (typeof moveOrNotation === "string") return moveOrNotation;
  return moveOrNotation.notation ?? moveToNotation(moveOrNotation);
}

function originText(position, piece, fromFile, fromRank) {
  const sameFilePieces = [];
  for (let rank = 0; rank < BOARD_RANKS; rank += 1) {
    const candidate = position.board[indexOf(fromFile, rank)];
    if (candidate?.side === piece.side && candidate.type === piece.type) {
      sameFilePieces.push({ rank });
    }
  }

  if (sameFilePieces.length < 2) return fileText(piece.side, fromFile);

  sameFilePieces.sort((a, b) => piece.side === SIDES.RED ? a.rank - b.rank : b.rank - a.rank);
  const index = sameFilePieces.findIndex((entry) => entry.rank === fromRank);
  if (sameFilePieces.length === 2) return index === 0 ? "前" : "後";
  if (sameFilePieces.length === 3) return FRONT_LABELS[index] ?? fileText(piece.side, fromFile);
  return numberText(piece.side, index + 1);
}

function moveDirection(side, fromRank, toRank) {
  if (fromRank === toRank) return "平";
  const forward = side === SIDES.RED ? toRank < fromRank : toRank > fromRank;
  return forward ? "進" : "退";
}

function destinationText(piece, fromFile, fromRank, toFile, toRank, direction) {
  if (direction === "平" || FILE_TARGET_TYPES.has(piece.type)) {
    return fileText(piece.side, toFile);
  }
  return numberText(piece.side, Math.abs(toRank - fromRank));
}

function fileText(side, file) {
  const index = side === SIDES.RED ? BOARD_FILES - file : file + 1;
  return numberText(side, index);
}

function numberText(side, number) {
  const values = side === SIDES.RED ? RED_NUMERALS : BLACK_NUMERALS;
  return values[number - 1] ?? String(number);
}
