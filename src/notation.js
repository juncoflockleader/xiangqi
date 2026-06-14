import { PIECES, SIDES } from "./constants.js";
import {
  createInitialPosition,
  fileOf,
  forwardDelta,
  makeMove,
  moveToNotation,
  parseMoveNotation,
  rankOf,
  sameMove
} from "./board.js";
import { generateLegalMoves } from "./movegen.js";

const COORDINATE_MOVE_PATTERN = /^[a-i][0-9]-?[a-i][0-9]$/i;
const WESTERN_MOVE_PATTERN = /^[KGAEBNRHCPkgaebnrhcp][1-9][=+\-][1-9]$/;
const MOVE_TOKEN_PATTERN = /[a-i][0-9]-?[a-i][0-9]|[KGAEBNRHCPkgaebnrhcp][1-9][=+\-][1-9]/g;

const PIECE_LETTERS = Object.freeze({
  k: PIECES.KING,
  g: PIECES.KING,
  a: PIECES.ADVISOR,
  e: PIECES.ELEPHANT,
  b: PIECES.ELEPHANT,
  h: PIECES.HORSE,
  n: PIECES.HORSE,
  r: PIECES.ROOK,
  c: PIECES.CANNON,
  p: PIECES.PAWN
});

const FILE_TARGET_PIECES = new Set([
  PIECES.ADVISOR,
  PIECES.ELEPHANT,
  PIECES.HORSE
]);

export function parseGameMoveText(text, options = {}) {
  const tokens = extractMoveTokens(text);
  const initialPosition = options.initialPosition ?? createInitialPosition();
  let position = initialPosition;
  const moves = [];

  for (const token of tokens) {
    const move = parsePortableMoveNotation(position, token);
    const notation = moveToNotation(move);
    moves.push(notation);
    position = makeMove(position, move);
  }

  return moves;
}

export function extractMoveTokens(text) {
  const direct = normalizeMoveListInput(text);
  if (direct) return direct;
  return [...String(text ?? "").matchAll(MOVE_TOKEN_PATTERN)].map((match) => match[0]);
}

export function parsePortableMoveNotation(position, text) {
  const token = String(text ?? "").trim();
  if (COORDINATE_MOVE_PATTERN.test(token)) {
    return resolveCoordinateMove(position, token);
  }
  if (WESTERN_MOVE_PATTERN.test(token)) {
    return parseWesternMoveNotation(position, token);
  }
  throw new Error(`Unsupported move notation: ${text}`);
}

export function parseWesternMoveNotation(position, text) {
  const token = String(text ?? "").trim();
  const match = token.match(/^([KGAEBNRHCPkgaebnrhcp])([1-9])([=+\-])([1-9])$/);
  if (!match) {
    throw new Error(`Invalid western Xiangqi move: ${text}`);
  }

  const [, pieceLetter, sourceFileText, action, targetText] = match;
  const pieceType = PIECE_LETTERS[pieceLetter.toLowerCase()];
  const sourceFile = Number(sourceFileText);
  const target = Number(targetText);
  const side = position.turn;
  const candidates = generateLegalMoves(position, side)
    .filter((move) => {
      const piece = position.board[move.from];
      return piece?.type === pieceType
        && piece.side === side
        && westernFileNumber(side, fileOf(move.from)) === sourceFile
        && matchesWesternDestination(move, side, pieceType, action, target);
    });

  if (candidates.length === 0) {
    throw new Error(`No legal move matches western Xiangqi notation: ${text}`);
  }
  if (candidates.length > 1) {
    throw new Error(`Ambiguous western Xiangqi notation: ${text}`);
  }
  return candidates[0];
}

function resolveCoordinateMove(position, text) {
  const parsed = parseMoveNotation(text);
  const match = generateLegalMoves(position, position.turn)
    .find((move) => sameMove(move, parsed));
  if (!match) {
    throw new Error(`Illegal move: ${text}`);
  }
  return match;
}

function normalizeMoveListInput(text) {
  if (Array.isArray(text)) return text.map(String);
  if (typeof text !== "string") return null;

  const trimmed = text.trim();
  if (!trimmed || !/^\s*[\[{"]/.test(trimmed)) return null;

  try {
    const data = JSON.parse(trimmed);
    if (Array.isArray(data)) return data.map(String);
    if (typeof data === "string") return extractMoveTokens(data);
    if (Array.isArray(data?.moves)) return data.moves.map(String);
    if (typeof data?.moves === "string") return extractMoveTokens(data.moves);
    return null;
  } catch {
    return null;
  }
}

function matchesWesternDestination(move, side, pieceType, action, target) {
  const fromFile = fileOf(move.from);
  const toFile = fileOf(move.to);
  const fromRank = rankOf(move.from);
  const toRank = rankOf(move.to);

  if (action === "=") {
    return fromRank === toRank && westernFileNumber(side, toFile) === target;
  }

  const direction = Math.sign((toRank - fromRank) * forwardDelta(side));
  if (action === "+" && direction <= 0) return false;
  if (action === "-" && direction >= 0) return false;

  if (FILE_TARGET_PIECES.has(pieceType)) {
    return westernFileNumber(side, toFile) === target;
  }

  return fromFile === toFile && Math.abs(toRank - fromRank) === target;
}

function westernFileNumber(side, file) {
  return side === SIDES.RED ? 9 - file : file + 1;
}
