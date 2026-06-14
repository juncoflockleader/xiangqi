import { INITIAL_FEN } from "./constants.js";
import {
  moveKey,
  moveToNotation,
  parseMoveNotation,
  positionKey,
  sameMove
} from "./board.js";
import { generateLegalMoves, annotateMove } from "./movegen.js";

const AFTER_RED_CENTRAL_CANNON =
  "rheakaehr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RHEAKAEHR b";

export const DEFAULT_OPENING_BOOK = Object.freeze({
  [INITIAL_FEN]: Object.freeze([
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
  ]),
  [AFTER_RED_CENTRAL_CANNON]: Object.freeze([
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
  ])
});

export function lookupOpeningBook(position, options = {}) {
  const book = options.book ?? DEFAULT_OPENING_BOOK;
  if (book === false) return null;

  const entries = book[positionKey(position)] ?? [];
  if (entries.length === 0) return null;

  const bannedMoveKeys = new Set((options.bannedMoves ?? []).map(toBookMoveKey));
  const legalMoves = generateLegalMoves(position, position.turn);
  const legalEntries = entries
    .map((entry) => resolveBookEntry(position, entry, legalMoves))
    .filter((entry) => entry && !bannedMoveKeys.has(moveKey(entry.move)))
    .sort((a, b) => b.weight - a.weight || a.move.notation.localeCompare(b.move.notation));

  if (legalEntries.length === 0) return null;

  return {
    source: "opening-book",
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
