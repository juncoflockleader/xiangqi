import {
  createInitialPosition,
  moveToNotation,
  parseMoveNotation,
  positionKey,
  sameMove,
  toFen
} from "./board.js";
import { generateLegalMoves } from "./movegen.js";
import { gameStatus } from "./game.js";
import { summarizeAlternativeEvidence, summarizeComparisonEvidence, summarizeLinePlanEvidence } from "./explanation-artifacts.js";
import { summarizePlanComparisonEvidence } from "./plan-comparison.js";

const CLASSIFICATIONS = Object.freeze([
  "best",
  "excellent",
  "good",
  "inaccuracy",
  "mistake",
  "blunder"
]);

export function reviewGameWithEngine(engine, moves, options = {}) {
  const initialPosition = options.initialPosition ?? createInitialPosition();
  const reviewOptions = options.reviewOptions ?? {};
  const maxKeyMoments = options.maxKeyMoments ?? 5;
  const reviewedMoves = [];
  const positions = [initialPosition];
  let position = initialPosition;

  for (let index = 0; index < moves.length; index += 1) {
    const rawMove = moves[index];
    const legalMove = resolveReviewedMove(position, rawMove);
    const notation = moveToNotation(legalMove);
    const book = classifyBookMove(engine, position, legalMove, options.bookOptions ?? {});
    const review = engine.reviewMove(position, legalMove, {
      ...reviewOptions,
      history: positions.map((item) => positionKey(item))
    });
    const after = engine.play(position, notation);

    reviewedMoves.push({
      ply: index + 1,
      moveNumber: Math.floor(index / 2) + 1,
      side: position.turn,
      notation,
      move: legalMove,
      positionBefore: toFen(position),
      positionAfter: toFen(after),
      review,
      book
    });

    position = after;
    positions.push(position);
  }

  const summary = summarizeReviewedMoves(reviewedMoves);

  return {
    initialPosition,
    finalPosition: position,
    moves: reviewedMoves,
    summary,
    keyMoments: selectKeyMoments(reviewedMoves, maxKeyMoments),
    status: gameStatus({
      position,
      moves: reviewedMoves,
      positions,
      positionCounts: countPositions(positions)
    })
  };
}

export async function reviewGameWithBackend(backend, moves, options = {}) {
  const initialPosition = options.initialPosition ?? createInitialPosition();
  const reviewOptions = options.reviewOptions ?? {};
  const maxKeyMoments = options.maxKeyMoments ?? 5;
  const reviewedMoves = [];
  const positions = [initialPosition];
  let position = initialPosition;

  for (let index = 0; index < moves.length; index += 1) {
    const rawMove = moves[index];
    const legalMove = resolveReviewedMove(position, rawMove);
    const notation = moveToNotation(legalMove);
    const book = classifyBookMove(backend, position, legalMove, options.bookOptions ?? {});
    const review = await backend.reviewMove(position, legalMove, {
      ...reviewOptions,
      history: positions.map((item) => positionKey(item))
    });
    const after = backend.play(position, notation);

    reviewedMoves.push({
      ply: index + 1,
      moveNumber: Math.floor(index / 2) + 1,
      side: position.turn,
      notation,
      move: legalMove,
      positionBefore: toFen(position),
      positionAfter: toFen(after),
      review,
      book
    });

    position = after;
    positions.push(position);
  }

  const summary = summarizeReviewedMoves(reviewedMoves);

  return {
    initialPosition,
    finalPosition: position,
    moves: reviewedMoves,
    summary,
    keyMoments: selectKeyMoments(reviewedMoves, maxKeyMoments),
    status: gameStatus({
      position,
      moves: reviewedMoves,
      positions,
      positionCounts: countPositions(positions)
    })
  };
}

function resolveReviewedMove(position, moveOrNotation) {
  const rawMove = typeof moveOrNotation === "string"
    ? parseMoveNotation(moveOrNotation)
    : moveOrNotation;
  const legalMove = generateLegalMoves(position, position.turn)
    .find((move) => sameMove(move, rawMove));

  if (!legalMove) {
    throw new Error(`Illegal reviewed move: ${moveToNotation(rawMove)}`);
  }

  return legalMove;
}

function classifyBookMove(engine, position, move, options) {
  const hit = engine.openingBook(position, options);
  if (!hit) return null;

  const matching = hit.entries.find((entry) => sameMove(entry.move, move));
  return {
    isBookMove: Boolean(matching),
    played: matching
      ? {
          name: matching.name,
          idea: matching.idea,
          tags: matching.tags,
          weight: matching.weight
        }
      : null,
    recommendation: {
      move: hit.entry.notation,
      name: hit.entry.name,
      idea: hit.entry.idea,
      tags: hit.entry.tags,
      weight: hit.entry.weight
    }
  };
}

function summarizeReviewedMoves(moves) {
  const bySide = {
    red: createSideSummary(),
    black: createSideSummary()
  };
  const classifications = Object.fromEntries(CLASSIFICATIONS.map((label) => [label, 0]));
  let totalLoss = 0;
  let bookMoves = 0;

  for (const item of moves) {
    const loss = item.review.centipawnLoss;
    totalLoss += loss;
    classifications[item.review.classification] += 1;

    const side = bySide[item.side];
    side.moves += 1;
    side.totalCentipawnLoss += loss;
    side.averageCentipawnLoss = Math.round(side.totalCentipawnLoss / side.moves);
    side.classifications[item.review.classification] += 1;

    if (item.book?.isBookMove) {
      bookMoves += 1;
      side.bookMoves += 1;
    }
  }

  return {
    totalMoves: moves.length,
    averageCentipawnLoss: moves.length === 0 ? 0 : Math.round(totalLoss / moves.length),
    classifications,
    bookMoves,
    bySide
  };
}

function selectKeyMoments(moves, limit) {
  return moves
    .filter((item) => item.review.centipawnLoss > 0 || item.book?.isBookMove)
    .sort((a, b) => {
      if (b.review.centipawnLoss !== a.review.centipawnLoss) {
        return b.review.centipawnLoss - a.review.centipawnLoss;
      }
      return a.ply - b.ply;
    })
    .slice(0, limit)
    .map((item) => ({
      ply: item.ply,
      moveNumber: item.moveNumber,
      side: item.side,
      notation: item.notation,
      classification: item.review.classification,
      centipawnLoss: item.review.centipawnLoss,
      bestMove: item.review.bestMove.notation,
      playedScore: Math.round(item.review.playedScore ?? 0),
      playedScoreDetail: item.review.playedScoreDetail ?? null,
      playedScoreText: item.review.playedScoreDetail?.text ?? formatCentipawns(item.review.playedScore),
      playedWdl: item.review.playedWdl ?? null,
      bestScore: Math.round(item.review.bestScore ?? 0),
      bestScoreDetail: scoreDetailFor(item.review.bestAnalysis),
      bestScoreText: scoreTextFor(item.review.bestAnalysis ?? { score: item.review.bestScore }),
      bestWdl: item.review.bestAnalysis?.wdl ?? null,
      bestComparison: comparisonFor(item.review),
      bestAlternatives: alternativesFor(item.review),
      playedLinePlan: playedLinePlanFor(item.review),
      bestLinePlan: bestLinePlanFor(item.review),
      planComparison: planComparisonFor(item.review),
      mistakes: item.review.mistakes,
      book: item.book,
      summary: item.review.explanation.summary,
      reasons: item.review.explanation.reasons
    }));
}

function createSideSummary() {
  return {
    moves: 0,
    totalCentipawnLoss: 0,
    averageCentipawnLoss: 0,
    bookMoves: 0,
    classifications: Object.fromEntries(CLASSIFICATIONS.map((label) => [label, 0]))
  };
}

function countPositions(positions) {
  const counts = new Map();
  for (const position of positions) {
    const key = positionKey(position);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function scoreDetailFor(entry) {
  if (!entry) return null;
  return entry.scoreDetail ?? entry.explanation?.search?.scoreDetail ?? null;
}

function scoreTextFor(entry) {
  return scoreDetailFor(entry)?.text ?? formatCentipawns(entry?.score);
}

function comparisonFor(review) {
  return summarizeComparisonEvidence(review.bestComparison ?? review.bestAnalysis?.explanation?.comparison);
}

function alternativesFor(review) {
  return summarizeAlternativeEvidence(review.bestAlternatives ?? review.bestAnalysis?.explanation?.alternatives);
}

function playedLinePlanFor(review) {
  return summarizeLinePlanEvidence(review.playedLinePlan);
}

function planComparisonFor(review) {
  return summarizePlanComparisonEvidence(review.planComparison);
}

function bestLinePlanFor(review) {
  return summarizeLinePlanEvidence(review.bestLinePlan ?? review.bestExplanation?.linePlan ?? review.bestAnalysis?.explanation?.linePlan);
}

function formatCentipawns(value) {
  const rounded = Math.round(value ?? 0);
  return `${rounded >= 0 ? "+" : ""}${rounded} cp`;
}
