export const BOARD_FILES = 9;
export const BOARD_RANKS = 10;
export const BOARD_SIZE = BOARD_FILES * BOARD_RANKS;

export const SIDES = Object.freeze({
  RED: "red",
  BLACK: "black"
});

export const PIECES = Object.freeze({
  KING: "king",
  ADVISOR: "advisor",
  ELEPHANT: "elephant",
  HORSE: "horse",
  ROOK: "rook",
  CANNON: "cannon",
  PAWN: "pawn"
});

export const PIECE_VALUES = Object.freeze({
  [PIECES.KING]: 20000,
  [PIECES.ROOK]: 900,
  [PIECES.CANNON]: 470,
  [PIECES.HORSE]: 430,
  [PIECES.ADVISOR]: 120,
  [PIECES.ELEPHANT]: 120,
  [PIECES.PAWN]: 90
});

export const MATE_SCORE = 100000;
export const DRAW_SCORE = 0;
export const INFINITY_SCORE = 1_000_000;

export const PIECE_NAMES = Object.freeze({
  [PIECES.KING]: "general",
  [PIECES.ADVISOR]: "advisor",
  [PIECES.ELEPHANT]: "elephant",
  [PIECES.HORSE]: "horse",
  [PIECES.ROOK]: "rook",
  [PIECES.CANNON]: "cannon",
  [PIECES.PAWN]: "pawn"
});

export const FEN_TO_PIECE = Object.freeze({
  k: PIECES.KING,
  a: PIECES.ADVISOR,
  e: PIECES.ELEPHANT,
  b: PIECES.ELEPHANT,
  h: PIECES.HORSE,
  n: PIECES.HORSE,
  r: PIECES.ROOK,
  c: PIECES.CANNON,
  p: PIECES.PAWN
});

export const PIECE_TO_FEN = Object.freeze({
  [PIECES.KING]: "k",
  [PIECES.ADVISOR]: "a",
  [PIECES.ELEPHANT]: "e",
  [PIECES.HORSE]: "h",
  [PIECES.ROOK]: "r",
  [PIECES.CANNON]: "c",
  [PIECES.PAWN]: "p"
});

export const INITIAL_FEN =
  "rheakaehr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RHEAKAEHR r";
