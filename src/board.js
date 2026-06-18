import {
  BOARD_FILES,
  BOARD_RANKS,
  BOARD_SIZE,
  FEN_TO_PIECE,
  INITIAL_FEN,
  PIECE_NAMES,
  PIECE_TO_FEN,
  SIDES
} from "./constants.js";

export function opponent(side) {
  return side === SIDES.RED ? SIDES.BLACK : SIDES.RED;
}

export function indexOf(file, rank) {
  return rank * BOARD_FILES + file;
}

export function fileOf(square) {
  return square % BOARD_FILES;
}

export function rankOf(square) {
  return Math.floor(square / BOARD_FILES);
}

export function isInside(file, rank) {
  return file >= 0 && file < BOARD_FILES && rank >= 0 && rank < BOARD_RANKS;
}

export function isRedSide(side) {
  return side === SIDES.RED;
}

export function palaceContains(side, file, rank) {
  if (file < 3 || file > 5) return false;
  return side === SIDES.RED ? rank >= 7 && rank <= 9 : rank >= 0 && rank <= 2;
}

export function ownRiverSide(side, rank) {
  return side === SIDES.RED ? rank >= 5 : rank <= 4;
}

export function hasCrossedRiver(side, rank) {
  return side === SIDES.RED ? rank <= 4 : rank >= 5;
}

export function forwardDelta(side) {
  return side === SIDES.RED ? -1 : 1;
}

export function emptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => null);
}

export function clonePiece(piece) {
  return piece ? { side: piece.side, type: piece.type } : null;
}

export function cloneBoard(board) {
  return board.slice();
}

export function createInitialPosition() {
  return parseFen(INITIAL_FEN);
}

export function parseFen(fen) {
  const [boardPart, turnPart = "r"] = fen.trim().split(/\s+/);
  const rows = boardPart.split("/");

  if (rows.length !== BOARD_RANKS) {
    throw new Error(`Xiangqi FEN must have ${BOARD_RANKS} ranks.`);
  }

  const board = emptyBoard();

  rows.forEach((row, rank) => {
    let file = 0;

    for (const char of row) {
      if (/\d/.test(char)) {
        file += Number(char);
        continue;
      }

      const type = FEN_TO_PIECE[char.toLowerCase()];
      if (!type) {
        throw new Error(`Unsupported FEN piece: ${char}`);
      }

      if (file >= BOARD_FILES) {
        throw new Error(`FEN rank ${rank} has too many files.`);
      }

      board[indexOf(file, rank)] = {
        side: char === char.toUpperCase() ? SIDES.RED : SIDES.BLACK,
        type
      };
      file += 1;
    }

    if (file !== BOARD_FILES) {
      throw new Error(`FEN rank ${rank} has ${file} files, expected ${BOARD_FILES}.`);
    }
  });

  const turn = parseTurn(turnPart);
  return { board, turn, halfmove: 0, fullmove: 1 };
}

export function parseTurn(token) {
  const normalized = token.toLowerCase();
  if (normalized === "r" || normalized === "w" || normalized === "red") return SIDES.RED;
  if (normalized === "b" || normalized === "black") return SIDES.BLACK;
  throw new Error(`Unsupported FEN side to move: ${token}`);
}

export function toFen(position) {
  const rows = [];

  for (let rank = 0; rank < BOARD_RANKS; rank += 1) {
    let row = "";
    let empties = 0;

    for (let file = 0; file < BOARD_FILES; file += 1) {
      const piece = position.board[indexOf(file, rank)];

      if (!piece) {
        empties += 1;
        continue;
      }

      if (empties > 0) {
        row += String(empties);
        empties = 0;
      }

      const char = PIECE_TO_FEN[piece.type];
      row += piece.side === SIDES.RED ? char.toUpperCase() : char;
    }

    if (empties > 0) row += String(empties);
    rows.push(row);
  }

  return `${rows.join("/")} ${position.turn === SIDES.RED ? "r" : "b"}`;
}

export function coordToIndex(coord) {
  const normalized = coord.toLowerCase();
  if (!/^[a-i][0-9]$/.test(normalized)) {
    throw new Error(`Invalid coordinate: ${coord}`);
  }

  const file = normalized.charCodeAt(0) - "a".charCodeAt(0);
  const rank = Number(normalized[1]);
  return indexOf(file, rank);
}

export function indexToCoord(square) {
  const file = String.fromCharCode("a".charCodeAt(0) + fileOf(square));
  return `${file}${rankOf(square)}`;
}

export function parseMoveNotation(text) {
  const normalized = text.trim().toLowerCase().replace(/-/g, "");
  if (!/^[a-i][0-9][a-i][0-9]$/.test(normalized)) {
    throw new Error(`Invalid move notation: ${text}`);
  }

  return {
    from: coordToIndex(normalized.slice(0, 2)),
    to: coordToIndex(normalized.slice(2, 4))
  };
}

export function moveToNotation(move) {
  return `${indexToCoord(move.from)}-${indexToCoord(move.to)}`;
}

export function pieceLabel(piece) {
  if (!piece) return "empty";
  const side = piece.side === SIDES.RED ? "Red" : "Black";
  return `${side} ${PIECE_NAMES[piece.type]}`;
}

export function sameMove(a, b) {
  return Boolean(a && b && a.from === b.from && a.to === b.to);
}

export function moveKey(move) {
  return `${move.from}:${move.to}`;
}

export function positionKey(position) {
  return toFen(position);
}

export function makeMove(position, move) {
  const board = cloneBoard(position.board);
  const moving = board[move.from];

  if (!moving) {
    throw new Error(`No piece on ${indexToCoord(move.from)}.`);
  }

  const captured = board[move.to];
  board[move.to] = moving;
  board[move.from] = null;

  return {
    board,
    turn: opponent(position.turn),
    halfmove: captured ? 0 : (position.halfmove ?? 0) + 1,
    fullmove: position.turn === SIDES.BLACK ? (position.fullmove ?? 1) + 1 : position.fullmove ?? 1
  };
}

export function formatBoard(position) {
  const rows = [];

  for (let rank = 0; rank < BOARD_RANKS; rank += 1) {
    const cells = [];
    for (let file = 0; file < BOARD_FILES; file += 1) {
      const piece = position.board[indexOf(file, rank)];
      if (!piece) {
        cells.push(".");
        continue;
      }

      const char = PIECE_TO_FEN[piece.type];
      cells.push(piece.side === SIDES.RED ? char.toUpperCase() : char);
    }
    rows.push(`${rank} ${cells.join(" ")}`);
  }

  return `  a b c d e f g h i\n${rows.join("\n")}`;
}
