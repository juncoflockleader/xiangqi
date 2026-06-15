import { PIECE_NAMES } from "./constants.js";
import {
  makeMove,
  moveToNotation,
  opponent,
  parseMoveNotation,
  pieceLabel,
  sameMove
} from "./board.js";
import {
  evaluateMoveDelta,
  evaluatePosition,
  describeCapture,
  describeEvaluationTerms
} from "./evaluate.js";
import { generateLegalMoves, isInCheck } from "./movegen.js";
import { analyzeThreats, topThreat } from "./pressure.js";
import { formatPrincipalVariation } from "./search.js";
import { analyzeCapture } from "./tactics.js";
import { compareLinePlans, summarizePlanComparisonEvidence } from "./plan-comparison.js";

export function explainMove(position, searchResult) {
  const move = searchResult.bestMove;

  if (!move) {
    return {
      summary: "No legal move is available.",
      reasons: [terminalNoMoveReason(position)],
      alternatives: [],
      principalVariation: [],
      linePlan: emptyLinePlan(),
      confidence: terminalConfidence(position)
    };
  }

  const moveStory = explainMoveFeatures(position, move);
  const reasons = [
    ...moveStory.reasons,
    ...searchTechniqueReasons(searchResult.stats)
  ];
  const validation = searchResult.openingHeuristicValidation;
  if (validation?.status === "rejected") {
    reasons.push(
      `Rejected opening heuristic ${validation.heuristicMove} because search found it loses about ${validation.centipawnLoss} centipawns compared with ${validation.searchBestMove}.`
    );
  }

  const candidateGap = candidateScoreGap(searchResult);
  if (candidateGap !== null && candidateGap >= 25) {
    reasons.push(`Search rates this ${Math.round(candidateGap)} centipawns better than the next candidate.`);
  }

  const bestCandidate = findCandidate(searchResult.candidates ?? [], move);
  const repetitionReason = explainRepetition(bestCandidate?.repetition);
  if (repetitionReason) reasons.push(repetitionReason);

  const stability = searchStabilityReason(searchResult.iterations ?? []);
  if (stability) reasons.push(stability);

  if (searchResult.fallback === "static-root") {
    reasons.push(searchResult.timedOut
      ? "Search reached the time limit before completing depth 1, so this move comes from a static one-ply fallback."
      : "No full search depth was completed, so this move comes from a static one-ply fallback.");
  }

  if ((searchResult.stats?.qchecks ?? 0) > 0) {
    reasons.push(`Quiescence search tested ${searchResult.stats.qchecks} forcing quiet checks beyond capture-only tactics.`);
  }

  if (reasons.length === 0) {
    reasons.push("It is the highest-scoring move after search and keeps the position coordinated.");
  }

  const bestLine = searchResult.principalVariation ?? [];
  const summary = `${pieceLabel(move.piece)} ${moveToNotation(move)} is preferred at depth ${searchResult.depth}, with an engine score of ${formatScore(searchResult.score)} for ${position.turn}.`;
  const confidence = assessSearchConfidence(searchResult, { source: searchResult.source ?? "search" });

  return {
    summary,
    reasons: unique(reasons).slice(0, 7),
    alternatives: explainAlternatives(position, searchResult.candidates ?? []),
    principalVariation: bestLine.map((candidate) => candidate.notation ?? moveToNotation(candidate)),
    principalVariationText: formatPrincipalVariation(bestLine),
    linePlan: buildLinePlan(position, bestLine, { perspective: position.turn }),
    evaluationDelta: moveStory.evaluationDelta,
    confidence,
    search: {
      depth: searchResult.depth,
      nodes: searchResult.nodes,
      timedOut: searchResult.timedOut,
      stopReason: searchResult.stopReason ?? null,
      softTimeLimitMs: searchResult.softTimeLimitMs ?? null,
      tableSize: searchResult.tableSize,
      stats: searchResult.stats,
      iterations: summarizeIterations(searchResult.iterations ?? []),
      openingHeuristicValidation: searchResult.openingHeuristicValidation ?? null
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
    ...(entry.database?.summary ? [entry.database.summary] : []),
    ...openingHeuristicValidationReasons(bookResult.openingHeuristicValidation),
    ...moveStory.reasons
  ];
  const confidence = assessSearchConfidence(bookResult, { source: bookResult.source ?? "opening-book" });

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
    linePlan: buildLinePlan(position, [move], {
      source: bookResult.source ?? "opening-book",
      perspective: position.turn
    }),
    evaluationDelta: moveStory.evaluationDelta,
    confidence,
    search: {
      depth: 0,
      nodes: 0,
      timedOut: false,
      tableSize: bookResult.tableSize,
      stats: bookResult.stats,
      iterations: [],
      source: bookResult.source ?? "opening-book",
      openingHeuristicValidation: bookResult.openingHeuristicValidation ?? null
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
  if (review.mistakes?.primary && review.mistakes.primary !== "none") {
    reasons.push(`Mistake pattern: ${review.mistakes.summary}`);
  }

  reasons.push(...moveStory.reasons);

  return {
    summary: `${moveToNotation(review.move)} is ${classificationPhrase(review.classification)} with ${loss} centipawns of loss.`,
    reasons: unique(reasons).slice(0, 7),
    move: moveStory,
    bestMove: review.bestExplanation,
    mistakes: review.mistakes ?? null
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

  const repetitionReason = explainRepetition(candidate.repetition);
  if (repetitionReason) reasons.push(repetitionReason);

  reasons.push(...moveStory.reasons);

  return {
    summary: `Candidate ${rank}: ${pieceLabel(candidate.move.piece)} ${notation} scores ${formatScore(candidate.score)} at depth ${context.depth ?? "?"}.`,
    reasons: unique(reasons).slice(0, 7),
    principalVariation,
    principalVariationText: principalVariation.join(" "),
    linePlan: buildLinePlan(position, candidate.principalVariation ?? [candidate.move], {
      perspective: position.turn
    }),
    evaluationDelta: moveStory.evaluationDelta,
    centipawnLoss
  };
}

export function formatScore(score) {
  if (Math.abs(score) > 90000) return score > 0 ? "winning by force" : "losing by force";
  const pawns = score / 100;
  return `${pawns >= 0 ? "+" : ""}${pawns.toFixed(2)}`;
}

export function assessSearchConfidence(result, context = {}) {
  const source = context.source ?? result.source ?? "";
  if (source.startsWith("opening")) return assessBookConfidence(result, source);

  const factors = [];
  let score = 35;
  const depth = result.depth ?? 0;
  const candidates = result.candidates ?? [];
  const iterations = result.iterations ?? [];
  const gap = candidateScoreGap(result);

  const depthImpact = Math.min(26, depth * 6);
  score += depthImpact;
  factors.push({
    kind: "depth",
    impact: depthImpact,
    text: depth > 0 ? `Search completed depth ${depth}.` : "No completed search depth."
  });

  if (gap !== null) {
    const gapImpact = gap >= 120 ? 20 : gap >= 60 ? 15 : gap >= 25 ? 9 : gap <= 10 ? -8 : 0;
    score += gapImpact;
    factors.push({
      kind: "candidate-gap",
      impact: gapImpact,
      text: gapImpact > 0
        ? `Top candidate leads the next line by ${Math.round(gap)} centipawns.`
        : `Top candidate is close to the next line, only ${Math.round(gap)} centipawns apart.`
    });
  } else {
    score -= 5;
    factors.push({
      kind: "candidate-gap",
      impact: -5,
      text: "Only one candidate line was available for comparison."
    });
  }

  const stability = bestMoveStability(iterations);
  if (stability.stable > 0) {
    const impact = Math.min(18, stability.stable * 8);
    score += impact;
    factors.push({
      kind: "stability",
      impact,
      text: `Best move stayed stable across ${stability.stable} depth transition${stability.stable === 1 ? "" : "s"}.`
    });
  } else if (stability.changed > 0) {
    score -= 8;
    factors.push({
      kind: "stability",
      impact: -8,
      text: "The best move changed at the last completed depth."
    });
  }

  if ((result.stopReason ?? "").startsWith("soft-time")) {
    score += 3;
    factors.push({
      kind: "time",
      impact: 3,
      text: `Soft time management stopped after a completed depth (${result.stopReason}).`
    });
  } else if (result.timedOut) {
    score -= 20;
    factors.push({
      kind: "time",
      impact: -20,
      text: "Search stopped on the time limit before finishing the next depth."
    });
  } else {
    score += 5;
    factors.push({
      kind: "time",
      impact: 5,
      text: "Search completed its requested depth without timing out."
    });
  }

  const selectivityFactor = searchSelectivityConfidenceFactor(result.stats);
  if (selectivityFactor) {
    score += selectivityFactor.impact;
    factors.push(selectivityFactor);
  }

  if (Math.abs(result.score ?? 0) > 90000) {
    score += 18;
    factors.push({
      kind: "forced-score",
      impact: 18,
      text: "The score indicates a forced win or loss."
    });
  }

  if (candidates.length >= 3) {
    score += 5;
    factors.push({
      kind: "breadth",
      impact: 5,
      text: `Compared ${Math.min(candidates.length, 12)} root candidate lines.`
    });
  }

  return buildConfidence(score, factors);
}

function searchTechniqueReasons(stats = {}) {
  if (!stats) return [];

  const reasons = [];
  const pruneParts = [];
  const staticPrunes = (
    (stats.seePrunes ?? 0) +
    (stats.futilityPrunes ?? 0) +
    (stats.razorPrunes ?? 0) +
    (stats.deltaPrunes ?? 0)
  );
  const verificationFailures = stats.nullMoveVerificationFailures ?? 0;

  if ((stats.nullMovePrunes ?? 0) > 0) {
    pruneParts.push(formatCount(stats.nullMovePrunes, "null-move cutoff"));
  }
  if ((stats.nullMoveVerifications ?? 0) > 0) {
    pruneParts.push(formatCount(stats.nullMoveVerifications, "verified null-move recheck"));
  }
  if ((stats.probCutPrunes ?? 0) > 0) {
    pruneParts.push(formatCount(stats.probCutPrunes, "ProbCut capture prune"));
  }
  if (staticPrunes > 0) {
    pruneParts.push(`${staticPrunes} SEE/futility/razor/delta prune${staticPrunes === 1 ? "" : "s"}`);
  }

  if (pruneParts.length > 0) {
    const suffix = verificationFailures > 0
      ? ` ${capitalize(formatCount(verificationFailures, "null-move shortcut"))} failed verification and was searched normally.`
      : "";
    reasons.push(`Selective search trimmed unlikely branches with ${formatList(pruneParts)} before spending depth on the main candidates.${suffix}`);
  } else if (verificationFailures > 0) {
    reasons.push(`${capitalize(formatCount(verificationFailures, "null-move shortcut"))} failed verification, so the engine searched those replies instead of trusting the shortcut.`);
  }

  const orderingParts = [];
  if ((stats.ttHits ?? 0) > 0) {
    orderingParts.push(formatCount(stats.ttHits, "transposition-table hit"));
  }
  if ((stats.iidMoveHits ?? 0) > 0) {
    orderingParts.push(formatCount(stats.iidMoveHits, "internal-iterative-deepening move hint"));
  }
  if ((stats.deepReductions ?? 0) > 0) {
    orderingParts.push(formatCount(stats.deepReductions, "deeper adaptive late-move reduction"));
  }
  if ((stats.singularExtensions ?? 0) > 0) {
    orderingParts.push(formatCount(stats.singularExtensions, "singular extension"));
  }

  if (orderingParts.length > 0) {
    reasons.push(`Move ordering evidence included ${formatList(orderingParts)}, helping the search focus depth on promising replies.`);
  }

  return reasons.slice(0, 2);
}

function searchSelectivityConfidenceFactor(stats = {}) {
  if (!stats) return null;

  const staticPrunes = (
    (stats.seePrunes ?? 0) +
    (stats.futilityPrunes ?? 0) +
    (stats.razorPrunes ?? 0) +
    (stats.deltaPrunes ?? 0)
  );
  const supports = [];

  if ((stats.ttHits ?? 0) > 0) supports.push("transposition-table reuse");
  if ((stats.iidMoveHits ?? 0) > 0) supports.push("internal iterative deepening");
  if ((stats.deepReductions ?? 0) > 0) supports.push("adaptive late-move reductions");
  if ((stats.singularExtensions ?? 0) > 0) supports.push("singular extensions");
  if ((stats.nullMovePrunes ?? 0) > 0 || (stats.nullMoveVerifications ?? 0) > 0) {
    supports.push("null-move pruning");
  }
  if ((stats.probCutPrunes ?? 0) > 0) supports.push("ProbCut");
  if (staticPrunes > 0) supports.push("static and tactical pruning");

  const verificationFailures = stats.nullMoveVerificationFailures ?? 0;
  if (supports.length === 0 && verificationFailures === 0) return null;

  let impact = supports.length > 0 ? Math.min(8, 2 + supports.length) : 0;
  impact -= Math.min(6, verificationFailures * 2);

  const text = verificationFailures > 0
    ? `Selective search used ${supports.length > 0 ? formatList(supports) : "null-move verification"} but caught ${formatCount(verificationFailures, "failed null-move shortcut")}, so confidence is tempered.`
    : `Selective search used ${formatList(supports)} to focus depth on likely relevant lines.`;

  return {
    kind: "selectivity",
    impact,
    text
  };
}

export function buildLinePlan(position, line = [], options = {}) {
  if (!line || line.length === 0) return emptyLinePlan();

  let current = position;
  const perspective = options.perspective ?? position.turn;
  const moves = [];
  const motifs = [];

  for (let index = 0; index < line.length; index += 1) {
    const rawMove = line[index];
    const notation = lineMoveNotation(rawMove);
    const legalMove = generateLegalMoves(current, current.turn)
      .find((candidate) => (candidate.notation ?? moveToNotation(candidate)) === notation);

    if (!legalMove) break;

    const annotated = {
      ...legalMove,
      notation
    };
    const role = lineMoveRole(index, options.source);
    const stepMotifs = lineMoveMotifs(current, annotated);
    const next = makeMove(current, legalMove);
    const scoreBefore = evaluatePosition(current, perspective).score;
    const scoreAfter = evaluatePosition(next, perspective).score;
    const scoreDelta = scoreAfter - scoreBefore;
    motifs.push(...stepMotifs);
    moves.push({
      ply: index + 1,
      side: current.turn,
      role,
      move: notation,
      piece: PIECE_NAMES[annotated.piece.type],
      summary: `${capitalize(role.replace("-", " "))}: ${pieceLabel(annotated.piece)} ${notation}`,
      scoreBefore: Math.round(scoreBefore),
      scoreAfter: Math.round(scoreAfter),
      scoreDelta: Math.round(scoreDelta),
      scoreBeforeText: formatScore(scoreBefore),
      scoreAfterText: formatScore(scoreAfter),
      scoreDeltaText: formatSignedCentipawns(scoreDelta),
      motifs: stepMotifs
    });

    current = next;
  }

  if (moves.length === 0) return emptyLinePlan();

  const first = moves[0];
  const reply = moves[1] ?? null;
  const continuation = moves.slice(2).map((move) => move.move);
  const uniqueMotifs = unique(motifs);
  const startingScore = first.scoreBefore;
  const endingScore = moves.at(-1).scoreAfter;
  const evaluationSwing = endingScore - startingScore;

  return {
    summary: summarizeLinePlan(first, reply, continuation, uniqueMotifs),
    perspective,
    firstMove: first.move,
    expectedReply: reply?.move ?? null,
    continuation,
    moves,
    motifs: uniqueMotifs,
    startingScore,
    endingScore,
    evaluationSwing,
    startingScoreText: formatScore(startingScore),
    endingScoreText: formatScore(endingScore),
    evaluationSwingText: formatSignedCentipawns(evaluationSwing)
  };
}

function lineMoveNotation(move) {
  return typeof move === "string"
    ? moveToNotation(parseMoveNotation(move))
    : move.notation ?? moveToNotation(move);
}

function explainAlternatives(position, candidates) {
  const bestScore = candidates[0]?.score ?? 0;
  const bestLinePlan = candidates[0]
    ? buildLinePlan(position, candidates[0].principalVariation ?? [candidates[0].move], {
        perspective: position.turn
      })
    : null;

  return candidates.slice(0, 5).map((candidate, index) => {
    const move = candidate.move;
    const tactical = [];
    const centipawnLoss = Math.max(0, Math.round(bestScore - candidate.score));
    const verdict = alternativeVerdict(index, centipawnLoss);
    const contrast = alternativeContrast(index, centipawnLoss);
    const principalVariation = (candidate.principalVariation ?? [])
      .map((lineMove) => lineMove.notation ?? moveToNotation(lineMove));
    const moveStory = explainMoveFeatures(position, move);
    const repetitionReason = explainRepetition(candidate.repetition);
    const linePlan = buildLinePlan(position, candidate.principalVariation ?? [move], {
      perspective: position.turn
    });
    const expectedReply = principalVariation[1] ?? null;

    if (candidate.repetition) {
      tactical.push("repeats a known position for a draw-assumed score");
    }
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
      centipawnLoss,
      verdict,
      summary: moveStory.summary,
      reasons: unique([
        contrast,
        ...(repetitionReason ? [repetitionReason] : []),
        ...moveStory.reasons
      ]).slice(0, 5),
      expectedReply,
      motifs: linePlan.motifs,
      linePlanSummary: linePlan.summary,
      planComparison: alternativePlanComparison(linePlan, bestLinePlan, {
        index,
        centipawnLoss,
        verdict,
        playedPlanLabel: "This candidate line",
        playedLineLabel: "This candidate line",
        playedStartLabel: "This candidate line starts",
        bestLineLabel: "the top line",
        bestLineSentenceLabel: "The top line",
        bestPossessiveLabel: "the top line's",
        bestPreferencePhrase: "the top line starts with",
        bestStartLabel: "the top line starts"
      }),
      principalVariation,
      principalVariationText: principalVariation.join(" "),
      note: `${contrast}; ${tactical.length > 0
        ? tactical.join(", ")
        : `${PIECE_NAMES[move.piece.type]} move with search score ${formatScore(candidate.score)}`}`
    };
  });
}

function alternativePlanComparison(linePlan, bestLinePlan, options = {}) {
  if (options.index === 0) return null;
  return summarizePlanComparisonEvidence(compareLinePlans(linePlan, bestLinePlan, {
    centipawnLoss: options.centipawnLoss,
    classification: options.verdict,
    playedPlanLabel: options.playedPlanLabel,
    playedLineLabel: options.playedLineLabel,
    playedStartLabel: options.playedStartLabel,
    bestLineLabel: options.bestLineLabel,
    bestLineSentenceLabel: options.bestLineSentenceLabel,
    bestPossessiveLabel: options.bestPossessiveLabel,
    bestPreferencePhrase: options.bestPreferencePhrase,
    bestStartLabel: options.bestStartLabel
  }));
}

function alternativeVerdict(index, centipawnLoss) {
  if (index === 0) return "best";
  if (centipawnLoss <= 15) return "tied";
  if (centipawnLoss <= 90) return "playable";
  if (centipawnLoss <= 250) return "inferior";
  return "poor";
}

function alternativeContrast(index, centipawnLoss) {
  if (index === 0) return "top line";
  if (centipawnLoss <= 15) return `roughly tied, trailing by ${centipawnLoss} centipawns`;
  return `trails the top line by ${centipawnLoss} centipawns`;
}

function explainRepetition(repetition) {
  if (!repetition) return null;

  const count = repetition.projectedCount ?? null;
  const countText = count ? ` for occurrence ${count}` : "";
  return `This line repeats a known position${countText} and is scored with draw-assumed repetition handling.`;
}

function findCandidate(candidates, move) {
  return candidates.find((candidate) => sameMove(candidate.move, move)) ?? null;
}

function emptyLinePlan() {
  return {
    summary: "No principal variation is available.",
    perspective: null,
    firstMove: null,
    expectedReply: null,
    continuation: [],
    moves: [],
    motifs: [],
    startingScore: null,
    endingScore: null,
    evaluationSwing: null,
    startingScoreText: null,
    endingScoreText: null,
    evaluationSwingText: null
  };
}

function lineMoveRole(index, source = "") {
  if (index === 0 && source.startsWith("opening")) return "opening-choice";
  if (index === 0) return "engine-choice";
  if (index === 1) return "expected-reply";
  return "continuation";
}

function lineMoveMotifs(position, move) {
  const next = makeMove(position, move);
  const motifs = [];

  if (move.captured) motifs.push(`wins ${PIECE_NAMES[move.captured.type]}`);
  if (move.givesCheck || isInCheck(next, next.turn)) motifs.push("check");

  const capture = analyzeCapture(position, move);
  if (capture?.isSafe) motifs.push("safe capture");
  if (capture && capture.exchangeScore < 0) motifs.push("recapture risk");

  const threat = analyzeThreats(next, position.turn, { limit: 1 })[0];
  if (threat && threat.score >= 400) motifs.push("creates threat");

  const replies = generateLegalMoves(next, next.turn).length;
  if (replies <= 3) motifs.push("limits replies");

  return unique(motifs);
}

function summarizeLinePlan(first, reply, continuation, motifs) {
  const parts = [`Start with ${first.move}`];
  if (reply) parts.push(`expect ${reply.move}`);
  if (continuation.length > 0) parts.push(`continue ${continuation.slice(0, 3).join(" ")}`);
  if (motifs.length > 0) parts.push(`theme: ${motifs.slice(0, 3).join(", ")}`);
  return `${parts.join("; ")}.`;
}

function candidateScoreGap(searchResult) {
  const candidates = searchResult.candidates ?? [];
  if (candidates.length < 2) return null;
  return candidates[0].score - candidates[1].score;
}

function assessBookConfidence(result, source) {
  const factors = [];
  let score = source === "opening-heuristic" ? 46 : 62;
  const alternatives = result.bookAlternatives ?? [];
  const gap = alternatives.length >= 2
    ? (alternatives[0].weight ?? 0) - (alternatives[1].weight ?? 0)
    : null;
  const database = result.book?.database;

  factors.push({
    kind: source === "opening-heuristic" ? "heuristic" : "book",
    impact: source === "opening-heuristic" ? -8 : 12,
    text: source === "opening-heuristic"
      ? "Move comes from opening heuristics rather than an exact book position."
      : "Move comes from an exact opening-book position."
  });

  if (gap !== null) {
    const impact = gap >= 40 ? 16 : gap >= 15 ? 9 : gap <= 5 ? -8 : 0;
    score += impact;
    factors.push({
      kind: "book-gap",
      impact,
      text: impact > 0
        ? `Book weight leads the next alternative by ${Math.round(gap)} points.`
        : `Book alternatives are close, only ${Math.round(gap)} weight points apart.`
    });
  }

  if (database?.games) {
    const impact = Math.min(18, Math.max(4, Math.round(Math.log10(database.games + 1) * 6)));
    score += impact;
    factors.push({
      kind: "database-games",
      impact,
      text: `Opening prior is backed by ${Math.round(database.games)} database games.`
    });
  }

  if (database?.expectedScore !== undefined) {
    const expectedScore = Math.round(database.expectedScore * 100);
    const impact = expectedScore >= 65 ? 10 : expectedScore <= 45 ? -6 : 3;
    score += impact;
    factors.push({
      kind: "database-score",
      impact,
      text: `Database expected score is ${expectedScore}% for the side to move.`
    });
  }

  if (result.openingHeuristicValidation) {
    const validation = result.openingHeuristicValidation;
    const loss = validation.centipawnLoss ?? null;
    const accepted = validation.status === "accepted";
    const rejected = validation.status === "rejected";
    const impact = accepted ? 12 : rejected ? 6 : -10;
    score += impact;
    factors.push({
      kind: "heuristic-validation",
      impact,
      text: accepted
        ? `Tactical validation kept the heuristic within ${loss} centipawns of search.`
        : rejected
          ? `Tactical validation rejected the heuristic after finding about ${loss} centipawns of loss.`
          : "Tactical validation was inconclusive, so this heuristic has lower confidence."
    });
  }

  return buildConfidence(score, factors);
}

function openingHeuristicValidationReasons(validation) {
  if (!validation) return [];
  if (validation.status === "accepted") {
    return [
      `A tactical validation search to depth ${validation.searchDepth} kept this heuristic within ${validation.centipawnLoss} centipawns of ${validation.searchBestMove}.`
    ];
  }
  if (validation.status === "inconclusive") {
    return [
      "The tactical validation search was inconclusive, so treat this heuristic as a low-confidence opening guide."
    ];
  }
  return [];
}

function terminalConfidence(position) {
  return buildConfidence(100, [{
    kind: "terminal",
    impact: 100,
    text: terminalNoMoveReason(position)
  }]);
}

function terminalNoMoveReason(position) {
  return isInCheck(position, position.turn)
    ? "No legal move exists because the side to move is checkmated."
    : "In Xiangqi, having no legal move loses even when the general is not currently in check.";
}

function bestMoveStability(iterations) {
  let stable = 0;
  let changed = 0;

  for (const iteration of iterations) {
    if (iteration.stableBestMove === true) stable += 1;
    if (iteration.stableBestMove === false) changed += 1;
  }

  return { stable, changed };
}

function buildConfidence(rawScore, factors) {
  const score = Math.round(Math.max(0, Math.min(100, rawScore)));
  const level = score >= 85 ? "very-high" : score >= 70 ? "high" : score >= 45 ? "medium" : "low";
  const label = {
    "very-high": "Very high confidence",
    high: "High confidence",
    medium: "Medium confidence",
    low: "Low confidence"
  }[level];

  return {
    score,
    level,
    label,
    factors: factors
      .filter((factor) => factor?.text)
      .map((factor) => ({
        kind: factor.kind,
        impact: Math.round(factor.impact),
        text: factor.text
      }))
  };
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

function formatCount(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatList(items) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function unique(items) {
  return [...new Set(items)];
}

function classificationPhrase(classification) {
  if (classification === "best") return "the best move";
  if (classification === "inaccuracy") return "an inaccuracy";
  return `${["excellent"].includes(classification) ? "an" : "a"} ${classification} move`;
}
