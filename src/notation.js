import { PIECES, SIDES } from "./constants.js";
import {
  createInitialPosition,
  fileOf,
  forwardDelta,
  makeMove,
  moveToNotation,
  parseMoveNotation,
  rankOf,
  sameMove,
  toFen
} from "./board.js";
import { generateLegalMoves } from "./movegen.js";

const COORDINATE_MOVE_PATTERN = /^[a-i][0-9]-?[a-i][0-9]$/i;
const WESTERN_MOVE_PATTERN = /^[KGAEBNRHCPkgaebnrhcp][1-9][=+\-][1-9]$/;
const MOVE_TOKEN_PATTERN = /[a-i][0-9]-?[a-i][0-9]|[KGAEBNRHCPkgaebnrhcp][1-9][=+\-][1-9]/g;
const HEADER_PATTERN = /^\s*\[([A-Za-z][\w-]*)\s+"([^"]*)"\]\s*$/;
const COLON_HEADER_PATTERN = /^\s*([A-Za-z][\w -]{1,40})\s*:\s*(\S.*)$/;

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
  return importGameMoveText(text, options).moves;
}

export function importGameMoveText(text, options = {}) {
  const record = normalizeMoveRecordInput(text);
  const tokens = record.tokens ?? extractMoveTokens(record.text);
  const initialPosition = options.initialPosition ?? createInitialPosition();
  let position = initialPosition;
  const moves = [];
  const parsedTokens = [];

  for (const token of tokens) {
    const move = parsePortableMoveNotation(position, token);
    const notation = moveToNotation(move);
    moves.push(notation);
    parsedTokens.push({
      ply: moves.length,
      token,
      notation,
      side: position.turn,
      fenBefore: toFen(position)
    });
    position = makeMove(position, move);
  }

  return {
    type: "game-move-import",
    moves,
    tokens: parsedTokens,
    metadata: record.metadata,
    diagnostics: record.diagnostics,
    initialFen: toFen(initialPosition),
    finalFen: toFen(position)
  };
}

export function extractMoveTokens(text) {
  return normalizeMoveRecordInput(text).tokens;
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

function normalizeMoveRecordInput(text) {
  if (Array.isArray(text)) {
    return {
      text: text.join(" "),
      tokens: text.map(String),
      metadata: {},
      diagnostics: []
    };
  }

  if (typeof text !== "string") {
    return {
      text: "",
      tokens: [],
      metadata: {},
      diagnostics: []
    };
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return {
      text: "",
      tokens: [],
      metadata: {},
      diagnostics: []
    };
  }

  if (/^\s*[\[{"]/.test(trimmed)) {
    const jsonRecord = normalizeJsonMoveRecord(trimmed);
    if (jsonRecord) return jsonRecord;
  }

  const { text: body, metadata, diagnostics } = stripHeadersAndComments(trimmed);
  MOVE_TOKEN_PATTERN.lastIndex = 0;
  const tokenMatches = [...body.matchAll(MOVE_TOKEN_PATTERN)];
  return {
    text: body,
    tokens: tokenMatches.map((match) => match[0]),
    metadata,
    diagnostics: [
      ...diagnostics,
      ...skippedTokenDiagnostics(body, tokenMatches)
    ]
  };
}

function normalizeJsonMoveRecord(text) {
  try {
    const data = JSON.parse(text);
    if (Array.isArray(data)) {
      return {
        text: data.join(" "),
        tokens: data.map(String),
        metadata: {},
        diagnostics: []
      };
    }
    if (typeof data === "string") return normalizeMoveRecordInput(data);
    if (!data || typeof data !== "object") return null;

    const moves = data.moves ?? data.movetext ?? data.moveText ?? "";
    const base = Array.isArray(moves)
      ? {
          text: moves.join(" "),
          tokens: moves.map(String),
          metadata: {},
          diagnostics: []
        }
      : normalizeMoveRecordInput(String(moves ?? ""));
    return {
      ...base,
      metadata: {
        ...metadataFromJsonObject(data),
        ...(base.metadata ?? {})
      }
    };
  } catch {
    return null;
  }
}

function metadataFromJsonObject(data) {
  const metadata = {};
  for (const [key, value] of Object.entries(data)) {
    if (["moves", "movetext", "moveText"].includes(key)) continue;
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
      metadata[key] = value;
    }
  }
  if (data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)) {
    Object.assign(metadata, data.metadata);
  }
  return metadata;
}

function stripHeadersAndComments(text) {
  const metadata = {};
  const diagnostics = [];
  const lines = [];

  for (const line of text.split(/\r?\n/)) {
    const header = line.match(HEADER_PATTERN);
    if (header) {
      metadata[header[1]] = header[2];
      continue;
    }

    const colonHeader = line.match(COLON_HEADER_PATTERN);
    if (colonHeader && !MOVE_TOKEN_PATTERN.test(line)) {
      metadata[normalizeMetadataKey(colonHeader[1])] = colonHeader[2].trim();
      MOVE_TOKEN_PATTERN.lastIndex = 0;
      continue;
    }
    MOVE_TOKEN_PATTERN.lastIndex = 0;

    lines.push(line);
  }

  const body = lines.join("\n")
    .replace(/\{[^}]*\}/g, (match) => {
      diagnostics.push({
        kind: "comment",
        text: match.slice(1, -1).trim()
      });
      return " ";
    })
    .replace(/;[^\n]*/g, (match) => {
      diagnostics.push({
        kind: "comment",
        text: match.slice(1).trim()
      });
      return " ";
    });

  return { text: body, metadata, diagnostics };
}

function skippedTokenDiagnostics(text, tokenMatches) {
  let remainder = text;
  for (const match of tokenMatches) {
    remainder = replaceSpan(remainder, match.index, match.index + match[0].length);
  }

  return remainder
    .split(/[\s,;|]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map(cleanResidualToken)
    .filter(Boolean)
    .filter((token) => !isIgnorableResidualToken(token))
    .map((token) => ({
      kind: "skipped-token",
      token
    }));
}

function replaceSpan(text, start, end) {
  return `${text.slice(0, start)}${" ".repeat(Math.max(0, end - start))}${text.slice(end)}`;
}

function cleanResidualToken(token) {
  return token.replace(/^[()[\]{}."'`]+|[()[\]{}."'`]+$/g, "");
}

function isIgnorableResidualToken(token) {
  return !token
    || /^\d+\.*$/.test(token)
    || /^[-+]?\/?$/.test(token)
    || /^(?:1-0|0-1|1\/2-1\/2|\*)$/.test(token)
    || /^[-=:+]+$/.test(token);
}

function normalizeMetadataKey(key) {
  return key.trim().replace(/\s+/g, " ");
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
