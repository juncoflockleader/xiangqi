import { INITIAL_FEN, PIECES, SIDES } from "./constants.js";
import {
  createInitialPosition,
  fileOf,
  makeMove,
  moveKey,
  moveToNotation,
  parseMoveNotation,
  positionKey,
  rankOf,
  sameMove
} from "./board.js";
import { generateLegalMoves, annotateMove } from "./movegen.js";

const AFTER_RED_CENTRAL_CANNON =
  "rheakaehr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RHEAKAEHR b";

const ROOT_ENTRIES = Object.freeze([
  freezeBookEntry({
    move: "h7-e7",
    name: "Central Cannon",
    weight: 100,
    idea: "Occupies the central file early, creates direct pressure on Black's palace, and often leads to tactical play.",
    tags: ["initiative", "central file", "tactical"]
  }),
  freezeBookEntry({
    move: "b9-c7",
    name: "Left Horse Development",
    weight: 82,
    idea: "Develops a horse toward the center while keeping the cannons flexible.",
    tags: ["development", "flexible"]
  }),
  freezeBookEntry({
    move: "h9-g7",
    name: "Right Horse Development",
    weight: 82,
    idea: "Develops a horse and supports a balanced setup before committing the cannons.",
    tags: ["development", "balanced"]
  }),
  freezeBookEntry({
    move: "a9-a8",
    name: "Rook Lift",
    weight: 58,
    idea: "Activates the rook early, though it gives up some central-opening pressure.",
    tags: ["rook activity", "quiet"]
  })
]);

const CENTRAL_CANNON_RESPONSES = Object.freeze([
  freezeBookEntry({
    move: "h0-g2",
    name: "Screen Horse Defense",
    weight: 95,
    idea: "Develops the horse toward the center and prepares to meet the central cannon with a resilient screen-horse structure.",
    tags: ["defense", "development", "central cannon"]
  }),
  freezeBookEntry({
    move: "b0-c2",
    name: "Left Screen Horse Defense",
    weight: 92,
    idea: "Mirrors the screen-horse concept from the other wing and keeps Black's formation solid.",
    tags: ["defense", "development", "central cannon"]
  }),
  freezeBookEntry({
    move: "a0-a1",
    name: "Rook Lift Response",
    weight: 55,
    idea: "Activates the rook quickly, but delays central defensive development.",
    tags: ["rook activity", "sideline"]
  })
]);

const OPENING_LINES = Object.freeze([
  Object.freeze([
    ...ROOT_ENTRIES.slice(0, 1),
    ...CENTRAL_CANNON_RESPONSES.slice(0, 1),
    freezeBookEntry({
      move: "h9-g7",
      name: "Right Horse Reinforcement",
      weight: 90,
      idea: "Develops the horse behind the central cannon so Red can support the center before opening a rook lane.",
      tags: ["central cannon", "development", "main line"]
    }),
    freezeBookEntry({
      move: "b0-c2",
      name: "Double Screen Horses",
      weight: 90,
      idea: "Completes the two-horse screen against the central cannon and keeps both flanks defended.",
      tags: ["screen horses", "development", "solid"]
    }),
    freezeBookEntry({
      move: "i9-h9",
      name: "Right Rook Patrol",
      weight: 78,
      idea: "Uses the developed horse to free the rook and increase pressure along the flank.",
      tags: ["rook activity", "development"]
    }),
    freezeBookEntry({
      move: "i0-h0",
      name: "Black Right Rook Patrol",
      weight: 76,
      idea: "Follows the same principle: the horse clears a lane so the rook can enter play.",
      tags: ["rook activity", "development"]
    })
  ]),
  Object.freeze([
    ROOT_ENTRIES[0],
    CENTRAL_CANNON_RESPONSES[1],
    freezeBookEntry({
      move: "b9-c7",
      name: "Left Horse Reinforcement",
      weight: 88,
      idea: "Develops the left horse and keeps the central cannon backed by a flexible formation.",
      tags: ["central cannon", "development"]
    }),
    freezeBookEntry({
      move: "h0-g2",
      name: "Balanced Screen Horse",
      weight: 88,
      idea: "Completes Black's screen-horse structure from the opposite wing.",
      tags: ["screen horses", "development"]
    })
  ]),
  Object.freeze([
    ROOT_ENTRIES[1],
    freezeBookEntry({
      move: "h0-g2",
      name: "Symmetric Horse Development",
      weight: 84,
      idea: "Meets Red's horse development with a centralizing horse of Black's own.",
      tags: ["development", "balanced"]
    }),
    freezeBookEntry({
      move: "h9-g7",
      name: "Double Horse Setup",
      weight: 84,
      idea: "Develops both horses before committing either cannon, a flexible learning-friendly setup.",
      tags: ["development", "flexible"]
    }),
    freezeBookEntry({
      move: "b0-c2",
      name: "Black Double Horse Setup",
      weight: 82,
      idea: "Keeps pace in development and contests the center without early pawn weaknesses.",
      tags: ["development", "balanced"]
    })
  ])
]);

export const DEFAULT_OPENING_BOOK = buildDefaultOpeningBook();

export function lookupOpeningBook(position, options = {}) {
  const book = options.book ?? DEFAULT_OPENING_BOOK;
  if (book === false) return null;

  let entries = book[positionKey(position)] ?? [];
  let source = "opening-book";
  if (entries.length === 0 && options.openingHeuristics !== false && isOpeningPhase(position)) {
    entries = heuristicOpeningEntries(position);
    source = "opening-heuristic";
  }
  if (entries.length === 0) return null;

  const bannedMoveKeys = new Set((options.bannedMoves ?? []).map(toBookMoveKey));
  const legalMoves = generateLegalMoves(position, position.turn);
  const legalEntries = entries
    .map((entry) => resolveBookEntry(position, entry, legalMoves))
    .filter((entry) => entry && !bannedMoveKeys.has(moveKey(entry.move)))
    .sort((a, b) => b.weight - a.weight || a.move.notation.localeCompare(b.move.notation));

  if (legalEntries.length === 0) return null;

  return {
    source,
    key: positionKey(position),
    move: legalEntries[0].move,
    entry: legalEntries[0],
    entries: legalEntries
  };
}

export function bookMoveToCandidate(entry) {
  return {
    move: entry.move,
    score: entry.weight,
    principalVariation: [entry.move],
    book: {
      name: entry.name,
      idea: entry.idea,
      tags: entry.tags,
      weight: entry.weight
    }
  };
}

function resolveBookEntry(position, entry, legalMoves) {
  const parsed = parseMoveNotation(entry.move);
  const legalMove = legalMoves.find((move) => sameMove(move, parsed));
  if (!legalMove) return null;

  return {
    ...entry,
    move: annotateMove(position, legalMove),
    notation: moveToNotation(legalMove)
  };
}

function freezeBookEntry(entry) {
  return Object.freeze({
    ...entry,
    tags: Object.freeze(entry.tags ?? [])
  });
}

function toBookMoveKey(move) {
  return moveKey(typeof move === "string" ? parseMoveNotation(move) : move);
}

function buildDefaultOpeningBook() {
  const positions = new Map();
  addEntries(positions, INITIAL_FEN, ROOT_ENTRIES);
  addEntries(positions, AFTER_RED_CENTRAL_CANNON, CENTRAL_CANNON_RESPONSES);

  for (const line of OPENING_LINES) {
    addOpeningLine(positions, line);
  }

  return freezeOpeningPositions(positions);
}

function addOpeningLine(positions, line) {
  let position = createInitialPosition();

  for (const entry of line) {
    addEntries(positions, positionKey(position), [entry]);
    position = applyBookMove(position, entry.move);
  }
}

function addEntries(positions, key, entries) {
  const byMove = positions.get(key) ?? new Map();

  for (const entry of entries) {
    const existing = byMove.get(entry.move);
    if (!existing || entry.weight > existing.weight) {
      byMove.set(entry.move, entry);
    }
  }

  positions.set(key, byMove);
}

function freezeOpeningPositions(positions) {
  return Object.freeze(Object.fromEntries(
    [...positions.entries()].map(([key, entries]) => [
      key,
      Object.freeze([...entries.values()].sort((a, b) => b.weight - a.weight))
    ])
  ));
}

function applyBookMove(position, notation) {
  const parsed = parseMoveNotation(notation);
  const legalMove = generateLegalMoves(position, position.turn)
    .find((move) => sameMove(move, parsed));

  if (!legalMove) {
    throw new Error(`Illegal opening-book move ${notation} from ${positionKey(position)}`);
  }

  return makeMove(position, legalMove);
}

function isOpeningPhase(position) {
  return (position.fullmove ?? 1) <= 12 && countPieces(position) >= 24;
}

function countPieces(position) {
  return position.board.reduce((count, piece) => count + (piece ? 1 : 0), 0);
}

function heuristicOpeningEntries(position) {
  return generateLegalMoves(position, position.turn)
    .map((move) => heuristicEntry(position, move))
    .filter(Boolean)
    .sort((a, b) => b.weight - a.weight || a.move.localeCompare(b.move))
    .slice(0, 6)
    .map(freezeBookEntry);
}

function heuristicEntry(position, move) {
  const piece = move.piece;
  const fromFile = fileOf(move.from);
  const toFile = fileOf(move.to);
  const fromRank = rankOf(move.from);
  const toRank = rankOf(move.to);

  if (piece.type === PIECES.HORSE && isHomeHorse(piece.side, fromFile, fromRank)) {
    return {
      move: move.notation,
      name: "Opening Horse Development",
      weight: 86 + centralFileBonus(toFile),
      idea: "Develops a horse toward the center, a reliable early-game priority before the board opens.",
      tags: ["heuristic", "development", "horse"]
    };
  }

  if (piece.type === PIECES.CANNON && toFile === 4) {
    return {
      move: move.notation,
      name: "Heuristic Central Cannon",
      weight: 84,
      idea: "Takes the central file with a cannon to pressure the palace and make the opponent defend accurately.",
      tags: ["heuristic", "central file", "cannon"]
    };
  }

  if (piece.type === PIECES.CANNON && isHomeCannon(piece.side, fromRank)) {
    return {
      move: move.notation,
      name: "Cannon Reposition",
      weight: 58 + centralFileBonus(toFile),
      idea: "Repositions a cannon while keeping attacking options flexible.",
      tags: ["heuristic", "cannon", "flexible"]
    };
  }

  if (piece.type === PIECES.ROOK && isHomeRook(piece.side, fromFile, fromRank)) {
    return {
      move: move.notation,
      name: "Rook Activation",
      weight: 68,
      idea: "Brings a corner rook into play once a lane is available, a major opening priority.",
      tags: ["heuristic", "rook activity"]
    };
  }

  if (piece.type === PIECES.PAWN && Math.abs(toFile - 4) <= 1) {
    return {
      move: move.notation,
      name: "Central Pawn Probe",
      weight: 48,
      idea: "Gains central space with a pawn, useful after the main pieces have begun developing.",
      tags: ["heuristic", "space", "pawn"]
    };
  }

  return null;
}

function isHomeHorse(side, file, rank) {
  const homeRank = side === SIDES.RED ? 9 : 0;
  return rank === homeRank && (file === 1 || file === 7);
}

function isHomeCannon(side, rank) {
  return side === SIDES.RED ? rank === 7 : rank === 2;
}

function isHomeRook(side, file, rank) {
  const homeRank = side === SIDES.RED ? 9 : 0;
  return rank === homeRank && (file === 0 || file === 8);
}

function centralFileBonus(file) {
  return Math.max(0, 4 - Math.abs(file - 4));
}
