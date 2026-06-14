import { PIECE_NAMES } from "./constants.js";
import {
  makeMove,
  moveToNotation,
  opponent,
  pieceLabel
} from "./board.js";
import { evaluateMoveDelta, describeCapture, describeEvaluationTerms } from "./evaluate.js";
import { generateLegalMoves, isInCheck } from "./movegen.js";
import { formatPrincipalVariation } from "./search.js";

export function explainMove(position, searchResult) {
  const move = searchResult.bestMove;

  if (!move) {
    return {
      summary: "No legal move is available.",
      reasons: [isInCheck(position, position.turn) ? "The side to move is checkmated." : "The side to move has no legal move."],
      alternatives: [],
      principalVariation: []
    };
  }

  const moveStory = explainMoveFeatures(position, move);
  const reasons = [...moveStory.reasons];

  const candidateGap = candidateScoreGap(searchResult);
  if (candidateGap !== null && candidateGap >= 25) {
    reasons.push(`Search rates this ${Math.round(candidateGap)} centipawns better than the next candidate.`);
  }

  if (reasons.length === 0) {
    reasons.push("It is the highest-scoring move after search and keeps the position coordinated.");
  }

  const bestLine = searchResult.principalVariation ?? [];
  const summary = `${pieceLabel(move.piece)} ${moveToNotation(move)} is preferred at depth ${searchResult.depth}, with an engine score of ${formatScore(searchResult.score)} for ${position.turn}.`;

  return {
    summary,
    reasons: unique(reasons).slice(0, 6),
    alternatives: explainAlternatives(searchResult.candidates ?? []),
    principalVariation: bestLine.map((candidate) => candidate.notation ?? moveToNotation(candidate)),
    principalVariationText: formatPrincipalVariation(bestLine),
    evaluationDelta: moveStory.evaluationDelta,
    search: {
      depth: searchResult.depth,
      nodes: searchResult.nodes,
      timedOut: searchResult.timedOut,
      tableSize: searchResult.tableSize,
      stats: searchResult.stats
    }
  };
}

export function explainMoveFeatures(position, move) {
  const next = makeMove(position, move);
  const delta = evaluateMoveDelta(position, next, position.turn);
  const termNotes = describeEvaluationTerms(delta.delta);
  const legalReplyCount = generateLegalMoves(next, next.turn).length;
  const reasons = [];
  const capture = describeCapture(move);

  if (capture) reasons.push(capitalize(capture));
  if (move.givesCheck || isInCheck(next, opponent(position.turn))) reasons.push("It gives check and forces the opponent to answer immediately.");
  if (isInCheck(position, position.turn)) reasons.push("It resolves the current check while keeping active play.");
  if (legalReplyCount <= 3) reasons.push(`It sharply limits the opponent to ${legalReplyCount} legal replies.`);
  if (Math.abs(delta.deltaScore) >= 20) {
    reasons.push(`${delta.deltaScore >= 0 ? "Static evaluation improves" : "Static evaluation accepts a short-term cost"} by ${Math.abs(Math.round(delta.deltaScore))} centipawns.`);
  }

  for (const note of termNotes) {
    reasons.push(capitalize(note.text) + ".");
  }

  if (reasons.length === 0) {
    reasons.push("It keeps the position coordinated without changing the static balance much.");
  }

  return {
    summary: `${pieceLabel(move.piece)} ${moveToNotation(move)} changes the static score by ${Math.round(delta.deltaScore)} centipawns.`,
    reasons: unique(reasons).slice(0, 6),
    evaluationDelta: {
      before: Math.round(delta.before),
      after: Math.round(delta.after),
      delta: Math.round(delta.deltaScore)
    }
  };
}

export function explainReviewedMove(position, review) {
  const moveStory = explainMoveFeatures(position, review.move);
  const bestMove = review.bestMove;
  const loss = Math.round(review.centipawnLoss);
  const reasons = [];

  if (review.isBestMove) {
    reasons.push("It matches the engine's preferred move.");
  } else {
    reasons.push(`It gives up about ${loss} centipawns compared with ${bestMove.notation}.`);
    reasons.push(`The preferred line starts with ${bestMove.notation}: ${review.bestExplanation.summary}`);
  }

  reasons.push(...moveStory.reasons);

  return {
    summary: `${moveToNotation(review.move)} is ${classificationPhrase(review.classification)} with ${loss} centipawns of loss.`,
    reasons: unique(reasons).slice(0, 7),
    move: moveStory,
    bestMove: review.bestExplanation
  };
}

export function formatScore(score) {
  if (Math.abs(score) > 90000) return score > 0 ? "winning by force" : "losing by force";
  const pawns = score / 100;
  return `${pawns >= 0 ? "+" : ""}${pawns.toFixed(2)}`;
}

function explainAlternatives(candidates) {
  return candidates.slice(0, 5).map((candidate, index) => {
    const move = candidate.move;
    const tactical = [];

    if (move.captured) {
      tactical.push(`captures ${PIECE_NAMES[move.captured.type]}`);
    }
    if (move.givesCheck) {
      tactical.push("gives check");
    }

    return {
      rank: index + 1,
      move: move.notation ?? moveToNotation(move),
      score: Math.round(candidate.score),
      note: tactical.length > 0
        ? tactical.join(", ")
        : `${PIECE_NAMES[move.piece.type]} move with search score ${formatScore(candidate.score)}`
    };
  });
}

function candidateScoreGap(searchResult) {
  const candidates = searchResult.candidates ?? [];
  if (candidates.length < 2) return null;
  return candidates[0].score - candidates[1].score;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function unique(items) {
  return [...new Set(items)];
}

function classificationPhrase(classification) {
  if (classification === "best") return "the best move";
  if (classification === "inaccuracy") return "an inaccuracy";
  return `${["excellent"].includes(classification) ? "an" : "a"} ${classification} move`;
}
