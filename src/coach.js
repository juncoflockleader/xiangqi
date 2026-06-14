import {
  indexToCoord,
  moveToNotation,
  opponent,
  pieceLabel,
  sameMove
} from "./board.js";
import { bookMoveToCandidate } from "./book.js";
import { explainBookMove, explainMoveFeatures, formatScore } from "./reasoning.js";
import { topThreat } from "./pressure.js";

const DEFAULT_COACH_LINES = 3;

export function coachMoveWithEngine(engine, position, options = {}) {
  const result = chooseCoachResult(engine, position, options);
  return buildCoachMove(position, result, options);
}

export async function coachMoveWithBackend(backend, position, options = {}) {
  const result = await chooseCoachResultAsync(backend, position, options);
  return buildCoachMove(position, result, options);
}

function chooseCoachResult(engine, position, options) {
  const bookResult = maybeCoachBookResult(engine, position, options);
  if (bookResult) return bookResult;

  return engine.analyzePosition(position, {
    ...options,
    lines: normalizeCoachLines(options)
  });
}

async function chooseCoachResultAsync(backend, position, options) {
  const bookResult = maybeCoachBookResult(backend, position, options);
  if (bookResult) return bookResult;

  return backend.analyzePosition(position, {
    ...options,
    lines: normalizeCoachLines(options)
  });
}

function maybeCoachBookResult(engine, position, options) {
  if (options.useBook === false) return null;

  const bookHit = engine.openingBook(position, options.bookOptions ?? options);
  if (!bookHit) return null;

  const candidates = bookHit.entries.map(bookMoveToCandidate);
  const result = {
    source: bookHit.source ?? "opening-book",
    bestMove: bookHit.move,
    score: bookHit.entry.weight,
    depth: 0,
    nodes: 0,
    principalVariation: [bookHit.move],
    candidates,
    book: {
      name: bookHit.entry.name,
      idea: bookHit.entry.idea,
      tags: bookHit.entry.tags,
      weight: bookHit.entry.weight
    },
    bookAlternatives: bookHit.entries
  };

  return {
    ...result,
    explanation: explainBookMove(position, result)
  };
}

function buildCoachMove(position, result, options) {
  if (!result.bestMove) {
    return {
      side: position.turn,
      source: result.source ?? "search",
      bestMove: null,
      summary: "No hint is available because there is no legal move.",
      levels: [{
        level: 1,
        kind: "status",
        title: "No Legal Move",
        text: result.explanation?.summary ?? "The side to move has no legal move."
      }],
      alternatives: [],
      principalVariation: [],
      explanation: result.explanation ?? null
    };
  }

  const moveStory = explainMoveFeatures(position, result.bestMove);
  const alternatives = normalizeAlternatives(result);
  const principalVariation = normalizePrincipalVariation(result);
  const levels = buildCoachLevels(position, result, moveStory, alternatives);

  return {
    side: position.turn,
    source: result.source ?? "search",
    bestMove: result.bestMove,
    score: Math.round(result.score ?? 0),
    depth: result.depth ?? 0,
    nodes: result.nodes ?? 0,
    summary: `Try to find the best move for ${position.turn}.`,
    levels: levels.slice(0, options.maxLevels ?? 4),
    alternatives,
    principalVariation,
    principalVariationText: principalVariation.join(" "),
    explanation: result.explanation,
    search: result.explanation?.search ?? {
      depth: result.depth ?? 0,
      nodes: result.nodes ?? 0,
      source: result.source ?? "search"
    }
  };
}

function buildCoachLevels(position, result, moveStory, alternatives) {
  const move = result.bestMove;
  const notation = moveToNotation(move);
  const from = indexToCoord(move.from);
  const isOpening = (result.source ?? "").startsWith("opening");
  const enemyThreat = topThreat(position, opponent(position.turn));
  const ownThreat = topThreat(position, position.turn);
  const levels = [];

  if (isOpening) {
    levels.push({
      level: 1,
      kind: "concept",
      title: "Opening Idea",
      text: result.book?.idea ?? "Look for a developing move that contests the center and keeps future piece activity flexible."
    });
  } else if (enemyThreat) {
    levels.push({
      level: 1,
      kind: "danger",
      title: "Opponent Threat",
      text: `${enemyThreat.summary} Your move should answer that pressure or create something stronger.`
    });
  } else {
    levels.push({
      level: 1,
      kind: "concept",
      title: "Position Idea",
      text: firstReason(moveStory) ?? "Look for the move that improves coordination while keeping the general safe."
    });
  }

  levels.push({
    level: 2,
    kind: "tactic",
    title: "Tactical Clue",
    text: tacticalClue(result, moveStory, ownThreat)
  });

  levels.push({
    level: 3,
    kind: "candidate",
    title: "Candidate Focus",
    text: `Focus on the ${pieceLabel(move.piece)} on ${from}. ${comparisonClue(result, alternatives)}`
  });

  levels.push({
    level: 4,
    kind: "reveal",
    title: "Best Move",
    text: `${notation} is the engine choice. ${result.explanation?.summary ?? moveStory.summary}`
  });

  return levels;
}

function tacticalClue(result, moveStory, ownThreat) {
  const forcingReason = moveStory.reasons.find((reason) => /check|threat|capture|wins|recapture|limits/i.test(reason));
  if (forcingReason) return forcingReason;
  if (ownThreat) return `The side to move already has a forcing resource: ${ownThreat.summary}`;
  if ((result.depth ?? 0) > 0) {
    return `Search prefers the line at depth ${result.depth} with a score of ${formatScore(result.score ?? 0)}.`;
  }
  return `This move follows the highest-weighted ${result.source ?? "engine"} recommendation.`;
}

function comparisonClue(result, alternatives) {
  const next = alternatives.find((alternative) => !sameMove(alternative.move, result.bestMove));
  if (!next) return "There is no close alternative in the current candidate list.";

  const gap = Math.max(0, Math.round((result.score ?? 0) - next.score));
  const unit = (result.source ?? "").startsWith("opening") ? "book-weight points" : "centipawns";
  if (gap <= 15) return `The next candidate, ${next.notation}, is very close in score.`;
  return `The next candidate, ${next.notation}, trails by about ${gap} ${unit}.`;
}

function normalizeAlternatives(result) {
  return (result.candidates ?? []).map((candidate, index) => ({
    rank: index + 1,
    move: candidate.move,
    notation: candidate.move.notation ?? moveToNotation(candidate.move),
    score: Math.round(candidate.score ?? 0),
    principalVariation: (candidate.principalVariation ?? [])
      .map((move) => move.notation ?? moveToNotation(move)),
    book: candidate.book ?? null,
    native: candidate.native ?? null
  }));
}

function normalizePrincipalVariation(result) {
  return (result.principalVariation ?? [])
    .map((move) => move.notation ?? moveToNotation(move));
}

function firstReason(moveStory) {
  return moveStory.reasons.find(Boolean) ?? null;
}

function normalizeCoachLines(options) {
  const value = options.lines ?? options.multiPv ?? options.multipv ?? DEFAULT_COACH_LINES;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_COACH_LINES;
  return Math.max(1, Math.min(12, parsed));
}
