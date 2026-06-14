import { PIECE_NAMES } from "./constants.js";
import {
  makeMove,
  moveToNotation,
  opponent,
  pieceLabel
} from "./board.js";
import { evaluateMoveDelta, describeCapture, describeEvaluationTerms } from "./evaluate.js";
import { generateLegalMoves, isInCheck } from "./movegen.js";
import { analyzeThreats, topThreat } from "./pressure.js";
import { formatPrincipalVariation } from "./search.js";
import { analyzeCapture } from "./tactics.js";

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

  const stability = searchStabilityReason(searchResult.iterations ?? []);
  if (stability) reasons.push(stability);

  if ((searchResult.stats?.qchecks ?? 0) > 0) {
    reasons.push(`Quiescence search tested ${searchResult.stats.qchecks} forcing quiet checks beyond capture-only tactics.`);
  }

  if (reasons.length === 0) {
    reasons.push("It is the highest-scoring move after search and keeps the position coordinated.");
  }

  const bestLine = searchResult.principalVariation ?? [];
  const summary = `${pieceLabel(move.piece)} ${moveToNotation(move)} is preferred at depth ${searchResult.depth}, with an engine score of ${formatScore(searchResult.score)} for ${position.turn}.`;

  return {
    summary,
    reasons: unique(reasons).slice(0, 7),
    alternatives: explainAlternatives(searchResult.candidates ?? []),
    principalVariation: bestLine.map((candidate) => candidate.notation ?? moveToNotation(candidate)),
    principalVariationText: formatPrincipalVariation(bestLine),
    evaluationDelta: moveStory.evaluationDelta,
    search: {
      depth: searchResult.depth,
      nodes: searchResult.nodes,
      timedOut: searchResult.timedOut,
      tableSize: searchResult.tableSize,
      stats: searchResult.stats,
      iterations: summarizeIterations(searchResult.iterations ?? [])
    }
  };
}

export function explainBookMove(position, bookResult) {
  const move = bookResult.bestMove;
  const moveStory = explainMoveFeatures(position, move);
  const entry = bookResult.book;
  const label = bookResult.source === "opening-heuristic" ? "Opening heuristic" : "Opening book";
  const summaryType = bookResult.source === "opening-heuristic" ? "opening heuristic move" : "book move";
  const reasons = [
    `${label}: ${entry.name}.`,
    entry.idea,
    ...moveStory.reasons
  ];

  return {
    summary: `${pieceLabel(move.piece)} ${moveToNotation(move)} is the ${summaryType}: ${entry.name}.`,
    reasons: unique(reasons).slice(0, 7),
    alternatives: bookResult.bookAlternatives.map((alternative, index) => ({
      rank: index + 1,
      move: alternative.notation,
      score: alternative.weight,
      note: `${alternative.name}: ${alternative.idea}`
    })),
    principalVariation: [moveToNotation(move)],
    principalVariationText: moveToNotation(move),
    evaluationDelta: moveStory.evaluationDelta,
    search: {
      depth: 0,
      nodes: 0,
      timedOut: false,
      tableSize: bookResult.tableSize,
      stats: bookResult.stats,
      iterations: [],
      source: bookResult.source ?? "opening-book"
    }
  };
}

export function explainMoveFeatures(position, move) {
  const next = makeMove(position, move);
  const delta = evaluateMoveDelta(position, next, position.turn);
  const termNotes = describeEvaluationTerms(delta.delta);
  const legalReplyCount = generateLegalMoves(next, next.turn).length;
  const beforeOpponentThreat = topThreat(position, opponent(position.turn));
  const afterOpponentThreat = topThreat(next, next.turn);
  const createdThreat = analyzeThreats(next, position.turn, { limit: 1 })[0] ?? null;
  const reasons = [];
  const capture = describeCapture(move);
  const captureAnalysis = analyzeCapture(position, move);

  if (captureAnalysis && captureAnalysis.exchangeScore < 0) {
    reasons.push(capitalize(captureAnalysis.summary));
  } else if (captureAnalysis?.recaptures.length > 0) {
    reasons.push(capitalize(captureAnalysis.summary));
  } else if (capture) {
    reasons.push(capitalize(capture));
  }
  if (captureAnalysis?.isSafe && captureAnalysis.recaptures.length === 0) {
    reasons.push("The capture is tactically safe against immediate recapture.");
  } else if (captureAnalysis?.isSafe && captureAnalysis.recaptures.length > 0) {
    reasons.push(`Static exchange evaluation keeps the capture at ${formatSignedCentipawns(captureAnalysis.exchangeScore)} after recaptures.`);
  }
  if (move.givesCheck || isInCheck(next, opponent(position.turn))) reasons.push("It gives check and forces the opponent to answer immediately.");
  if (isInCheck(position, position.turn)) reasons.push("It resolves the current check while keeping active play.");
  if (legalReplyCount <= 3) reasons.push(`It sharply limits the opponent to ${legalReplyCount} legal replies.`);
  if (createdThreat && createdThreat.score >= 400) {
    reasons.push(`It creates an immediate threat: ${createdThreat.summary}`);
  }
  if (beforeOpponentThreat && (!afterOpponentThreat || afterOpponentThreat.score + 120 < beforeOpponentThreat.score)) {
    reasons.push(`It reduces the opponent's strongest immediate threat: ${beforeOpponentThreat.summary}`);
  }
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

export function explainCandidateMove(position, candidate, context = {}) {
  const moveStory = explainMoveFeatures(position, candidate.move);
  const rank = context.rank ?? 1;
  const bestScore = context.bestScore ?? candidate.score;
  const centipawnLoss = Math.max(0, Math.round(bestScore - candidate.score));
  const notation = candidate.move.notation ?? moveToNotation(candidate.move);
  const principalVariation = (candidate.principalVariation ?? [])
    .map((move) => move.notation ?? moveToNotation(move));
  const reasons = [];

  if (rank === 1) {
    reasons.push("This is the engine's top candidate in the current search.");
  } else if (centipawnLoss <= 15) {
    reasons.push(`This line is effectively tied with the top move, trailing by ${centipawnLoss} centipawns.`);
  } else {
    reasons.push(`This line trails the top move by about ${centipawnLoss} centipawns.`);
  }

  reasons.push(...moveStory.reasons);

  return {
    summary: `Candidate ${rank}: ${pieceLabel(candidate.move.piece)} ${notation} scores ${formatScore(candidate.score)} at depth ${context.depth ?? "?"}.`,
    reasons: unique(reasons).slice(0, 7),
    principalVariation,
    principalVariationText: principalVariation.join(" "),
    evaluationDelta: moveStory.evaluationDelta,
    centipawnLoss
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

function searchStabilityReason(iterations) {
  if (iterations.length < 2) return null;

  const previous = iterations.at(-2);
  const latest = iterations.at(-1);
  const latestMove = latest.bestMove?.notation ?? (latest.bestMove ? moveToNotation(latest.bestMove) : null);
  if (!latestMove) return null;

  if (latest.stableBestMove) {
    return `The top move stayed ${latestMove} from depth ${previous.depth} to depth ${latest.depth}, which improves confidence in the line.`;
  }

  const previousMove = previous.bestMove?.notation ?? (previous.bestMove ? moveToNotation(previous.bestMove) : null);
  if (!previousMove) return null;

  return `The top move changed from ${previousMove} at depth ${previous.depth} to ${latestMove} at depth ${latest.depth}, so the deeper search found a better line.`;
}

function summarizeIterations(iterations) {
  return iterations.map((iteration) => ({
    depth: iteration.depth,
    bestMove: iteration.bestMove?.notation ?? (iteration.bestMove ? moveToNotation(iteration.bestMove) : null),
    score: Math.round(iteration.score),
    nodes: iteration.nodes,
    stableBestMove: iteration.stableBestMove,
    principalVariation: (iteration.principalVariation ?? [])
      .map((move) => move.notation ?? moveToNotation(move))
  }));
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatSignedCentipawns(score) {
  return `${score >= 0 ? "+" : ""}${Math.round(score)} centipawns`;
}

function unique(items) {
  return [...new Set(items)];
}

function classificationPhrase(classification) {
  if (classification === "best") return "the best move";
  if (classification === "inaccuracy") return "an inaccuracy";
  return `${["excellent"].includes(classification) ? "an" : "a"} ${classification} move`;
}
