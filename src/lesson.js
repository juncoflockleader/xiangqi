import { moveToNotation } from "./board.js";

const SEVERE_CLASSIFICATIONS = Object.freeze(["blunder", "mistake", "inaccuracy"]);
const POSITIVE_CLASSIFICATIONS = Object.freeze(["best", "excellent"]);

export function createLessonPlanFromReview(review, options = {}) {
  const maxCards = options.maxCards ?? 6;
  const candidates = review.moves
    .filter((move) => isLessonCandidate(move, options))
    .sort(compareLessonMoves)
    .slice(0, maxCards);
  const cards = candidates.map((move, index) => createLessonCard(move, index + 1));

  return {
    title: options.title ?? "Xiangqi Review Lesson",
    totalMoves: review.summary.totalMoves,
    averageCentipawnLoss: review.summary.averageCentipawnLoss,
    status: review.status,
    summary: summarizeLessonCards(cards),
    cards
  };
}

export function createLessonPlanWithEngine(engine, moves, options = {}) {
  const { lessonOptions = {}, review = null, ...reviewOptions } = options;
  const gameReview = review ?? engine.reviewGame(moves, reviewOptions);
  return createLessonPlanFromReview(gameReview, lessonOptions);
}

export async function createLessonPlanWithBackend(backend, moves, options = {}) {
  const { lessonOptions = {}, review = null, ...reviewOptions } = options;
  const gameReview = review ?? await backend.reviewGame(moves, reviewOptions);
  return createLessonPlanFromReview(gameReview, lessonOptions);
}

function isLessonCandidate(move, options) {
  if (move.book?.isBookMove) return options.includeBook !== false;
  if (SEVERE_CLASSIFICATIONS.includes(move.review.classification)) return true;
  if (options.includeModelMoves === true && POSITIVE_CLASSIFICATIONS.includes(move.review.classification)) return true;
  return false;
}

function compareLessonMoves(a, b) {
  const severity = lessonPriority(b) - lessonPriority(a);
  if (severity !== 0) return severity;
  if (b.review.centipawnLoss !== a.review.centipawnLoss) {
    return b.review.centipawnLoss - a.review.centipawnLoss;
  }
  return a.ply - b.ply;
}

function lessonPriority(move) {
  if (move.book?.isBookMove) return 95;
  if (move.review.classification === "blunder") return 90;
  if (move.review.classification === "mistake") return 80;
  if (move.review.classification === "inaccuracy") return 70;
  if (move.review.classification === "best") return 30;
  if (move.review.classification === "excellent") return 20;
  return 10;
}

function createLessonCard(move, rank) {
  const type = lessonType(move);
  const bestMove = formatMove(move.review.bestMove);
  const playedMove = move.notation;
  const answerMove = lessonAnswerMove(move, type, { bestMove, playedMove });
  const tags = lessonTags(move, type);

  return {
    id: `lesson-${rank}-ply-${move.ply}`,
    rank,
    type,
    title: lessonTitle(move, type),
    prompt: lessonPrompt(move, type),
    position: move.positionBefore,
    side: move.side,
    ply: move.ply,
    moveNumber: move.moveNumber,
    playedMove,
    bestMove,
    classification: move.review.classification,
    centipawnLoss: move.review.centipawnLoss,
    mistakes: move.review.mistakes,
    tags,
    hints: lessonHints(move, type, bestMove),
    answer: {
      move: answerMove,
      playedMove,
      summary: move.review.explanation.summary,
      reasons: move.review.explanation.reasons,
      principalVariation: move.review.principalVariation ?? []
    },
    book: move.book
  };
}

function lessonAnswerMove(move, type, moves) {
  if (type === "opening" && move.book?.played) return moves.playedMove;
  return moves.bestMove;
}

function lessonType(move) {
  if (move.book?.isBookMove) return "opening";
  if (SEVERE_CLASSIFICATIONS.includes(move.review.classification)) return "correction";
  return "model";
}

function lessonTitle(move, type) {
  if (type === "opening") return `Opening idea on move ${move.moveNumber}`;
  if (type === "correction") return `${capitalize(move.review.classification)} on move ${move.moveNumber}`;
  return `Model move on move ${move.moveNumber}`;
}

function lessonPrompt(move, type) {
  if (type === "opening") {
    return `${capitalize(move.side)} to move in the opening. Find the book idea.`;
  }
  if (type === "correction") {
    return `${capitalize(move.side)} to move. Find a stronger move than ${move.notation}.`;
  }
  return `${capitalize(move.side)} to move. Find the engine's preferred continuation.`;
}

function lessonHints(move, type, bestMove) {
  const hints = [];

  if (type === "opening" && move.book?.played?.idea) {
    hints.push({
      level: 1,
      kind: "concept",
      text: move.book.played.idea
    });
  } else if (move.review.explanation.reasons[0]) {
    hints.push({
      level: 1,
      kind: "concept",
      text: move.review.explanation.reasons[0]
    });
  }

  const tactical = move.review.explanation.reasons.find((reason) => /check|threat|capture|wins|recapture|loss|centipawn/i.test(reason));
  if (tactical && tactical !== hints[0]?.text) {
    hints.push({
      level: hints.length + 1,
      kind: "tactic",
      text: tactical
    });
  }

  if (type === "correction" && move.review.mistakes?.primary && move.review.mistakes.primary !== "none") {
    hints.push({
      level: hints.length + 1,
      kind: "pattern",
      text: move.review.mistakes.summary
    });
  }

  hints.push(revealHint(move, type, bestMove, hints.length + 1));

  return hints.slice(0, 4).map((hint, index) => ({
    ...hint,
    level: index + 1
  }));
}

function revealHint(move, type, bestMove, level) {
  if (type === "opening" && move.book?.played) {
    return {
      level,
      kind: "reveal",
      text: `The book move is ${move.notation}. ${move.book.played.idea}`
    };
  }

  return {
    level,
    kind: "reveal",
    text: `The engine prefers ${bestMove}. ${move.review.bestExplanation?.summary ?? move.review.explanation.summary}`
  };
}

function lessonTags(move, type) {
  const tags = new Set([type, move.side, move.review.classification]);
  if (move.book?.isBookMove) {
    tags.add("book");
    for (const tag of move.book.played?.tags ?? []) tags.add(tag);
  }
  if (move.review.centipawnLoss >= 300) tags.add("high-impact");
  if (move.review.centipawnLoss >= 90) tags.add("accuracy");
  for (const tag of move.review.mistakes?.tags ?? []) tags.add(tag);
  if (move.review.mistakes?.primary && move.review.mistakes.primary !== "none") {
    tags.add(move.review.mistakes.primary);
  }
  return [...tags];
}

function summarizeLessonCards(cards) {
  const byType = countBy(cards, (card) => card.type);
  const bySide = countBy(cards, (card) => card.side);
  const highImpact = cards.filter((card) => card.tags.includes("high-impact")).length;

  return {
    totalCards: cards.length,
    byType,
    bySide,
    highImpact
  };
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function capitalize(text) {
  return `${text.slice(0, 1).toUpperCase()}${text.slice(1)}`;
}

function formatMove(move) {
  if (!move) return "0000";
  return move.notation ?? moveToNotation(move);
}
