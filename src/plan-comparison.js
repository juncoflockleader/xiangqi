export function compareLinePlans(playedLinePlan, bestLinePlan, options = {}) {
  if (!hasUsablePlan(playedLinePlan) || !hasUsablePlan(bestLinePlan)) return null;

  const playedMove = playedLinePlan.firstMove ?? null;
  const bestMove = bestLinePlan.firstMove ?? null;
  const playedExpectedReply = playedLinePlan.expectedReply ?? null;
  const bestExpectedReply = bestLinePlan.expectedReply ?? null;
  const sameFirstMove = Boolean(playedMove && bestMove && playedMove === bestMove);
  const sameExpectedReply = playedExpectedReply === bestExpectedReply;
  const sameContinuation = arraysEqual(playedLinePlan.continuation ?? [], bestLinePlan.continuation ?? []);
  const sharedMotifs = intersection(playedLinePlan.motifs ?? [], bestLinePlan.motifs ?? []);
  const missedMotifs = difference(bestLinePlan.motifs ?? [], playedLinePlan.motifs ?? []);
  const playedOnlyMotifs = difference(playedLinePlan.motifs ?? [], bestLinePlan.motifs ?? []);
  const centipawnLoss = numberOrNull(options.centipawnLoss);
  const evaluationSwingDelta = Number.isFinite(bestLinePlan.evaluationSwing) && Number.isFinite(playedLinePlan.evaluationSwing)
    ? Math.round(bestLinePlan.evaluationSwing - playedLinePlan.evaluationSwing)
    : null;
  const classification = options.classification ?? null;
  const kind = comparisonKind({ sameFirstMove, sameExpectedReply, sameContinuation });
  const reasons = comparisonReasons({
    playedMove,
    bestMove,
    playedExpectedReply,
    bestExpectedReply,
    sameFirstMove,
    sameExpectedReply,
    missedMotifs,
    centipawnLoss,
    classification
  });

  return {
    kind,
    summary: summarizePlanComparison({
      playedMove,
      bestMove,
      playedExpectedReply,
      bestExpectedReply,
      sameFirstMove,
      sameExpectedReply,
      centipawnLoss,
      classification
    }),
    playedMove,
    bestMove,
    playedExpectedReply,
    bestExpectedReply,
    sameFirstMove,
    sameExpectedReply,
    sameContinuation,
    sharedMotifs,
    missedMotifs,
    playedOnlyMotifs,
    centipawnLoss,
    classification,
    evaluationSwingDelta,
    evaluationSwingDeltaText: evaluationSwingDelta === null
      ? null
      : formatSignedCentipawns(evaluationSwingDelta),
    playedSummary: playedLinePlan.summary ?? "",
    bestSummary: bestLinePlan.summary ?? "",
    reasons
  };
}

export function summarizePlanComparisonEvidence(comparison) {
  if (!comparison) return null;

  return {
    kind: comparison.kind ?? "unavailable",
    summary: comparison.summary ?? "",
    playedMove: comparison.playedMove ?? null,
    bestMove: comparison.bestMove ?? null,
    playedExpectedReply: comparison.playedExpectedReply ?? null,
    bestExpectedReply: comparison.bestExpectedReply ?? null,
    sameFirstMove: Boolean(comparison.sameFirstMove),
    sameExpectedReply: Boolean(comparison.sameExpectedReply),
    sameContinuation: Boolean(comparison.sameContinuation),
    sharedMotifs: [...(comparison.sharedMotifs ?? [])],
    missedMotifs: [...(comparison.missedMotifs ?? [])],
    playedOnlyMotifs: [...(comparison.playedOnlyMotifs ?? [])],
    centipawnLoss: numberOrNull(comparison.centipawnLoss),
    classification: comparison.classification ?? null,
    evaluationSwingDelta: numberOrNull(comparison.evaluationSwingDelta),
    evaluationSwingDeltaText: comparison.evaluationSwingDeltaText ?? null,
    playedSummary: comparison.playedSummary ?? "",
    bestSummary: comparison.bestSummary ?? "",
    reasons: [...(comparison.reasons ?? [])]
  };
}

function hasUsablePlan(plan) {
  return Boolean(plan?.summary && plan?.firstMove);
}

function comparisonKind({ sameFirstMove, sameExpectedReply, sameContinuation }) {
  if (!sameFirstMove) return "different-first-move";
  if (!sameExpectedReply) return "different-reply";
  if (!sameContinuation) return "different-continuation";
  return "same-plan";
}

function comparisonReasons(context) {
  const reasons = [];

  if (context.sameFirstMove) {
    reasons.push(`Both plans start with ${context.bestMove}.`);
  } else if (context.playedMove && context.bestMove) {
    reasons.push(`You started with ${context.playedMove}; the engine starts with ${context.bestMove}.`);
  }

  if (context.sameExpectedReply && context.bestExpectedReply) {
    reasons.push(`Both lines expect ${context.bestExpectedReply} as the reply.`);
  } else if (context.playedExpectedReply && context.bestExpectedReply) {
    reasons.push(`Your line expects ${context.playedExpectedReply}; the engine line expects ${context.bestExpectedReply}.`);
  } else if (context.bestExpectedReply) {
    reasons.push(`The engine line expects ${context.bestExpectedReply}.`);
  }

  if (context.missedMotifs.length > 0) {
    reasons.push(`The engine plan adds ${joinList(context.missedMotifs.slice(0, 3))}.`);
  }

  if (Number.isFinite(context.centipawnLoss)) {
    const label = context.classification ? `${context.classification} gap` : "search gap";
    if (isForcedScoreGap(context.centipawnLoss)) {
      reasons.push(`The searched gap is a forced-score result (${label}).`);
    } else {
      reasons.push(`The searched gap is ${formatCentipawnCount(context.centipawnLoss)} (${label}).`);
    }
  }

  return reasons;
}

function summarizePlanComparison(context) {
  const gapText = Number.isFinite(context.centipawnLoss) && context.centipawnLoss > 0
    ? `, ${formatGapPhrase(context.centipawnLoss, context.classification)}`
    : "";

  if (context.sameFirstMove) {
    const replyText = context.bestExpectedReply
      ? ` and expects ${context.bestExpectedReply}`
      : "";
    return `Your plan matches the engine's first move ${context.bestMove}${replyText}.`;
  }

  const firstSentence = `Your plan starts with ${context.playedMove}; the engine prefers ${context.bestMove}${gapText}.`;
  if (context.sameExpectedReply && context.bestExpectedReply) {
    return `${firstSentence} Both lines expect ${context.bestExpectedReply}.`;
  }
  if (context.playedExpectedReply && context.bestExpectedReply) {
    return `${firstSentence} Your line expects ${context.playedExpectedReply}; the engine line expects ${context.bestExpectedReply}.`;
  }
  if (context.bestExpectedReply) {
    return `${firstSentence} The engine line expects ${context.bestExpectedReply}.`;
  }
  return firstSentence;
}

function formatGapPhrase(centipawnLoss, classification) {
  const label = classification ?? "search";
  if (isForcedScoreGap(centipawnLoss)) return `a ${label} forced-score gap`;
  return `a ${label} gap of ${formatCentipawnCount(centipawnLoss)}`;
}

function isForcedScoreGap(value) {
  return Math.abs(value) >= 90000;
}

function intersection(left, right) {
  const rightSet = new Set(right);
  return unique(left.filter((item) => rightSet.has(item)));
}

function difference(left, right) {
  const rightSet = new Set(right);
  return unique(left.filter((item) => !rightSet.has(item)));
}

function arraysEqual(left, right) {
  if (left.length !== right.length) return false;
  return left.every((item, index) => item === right[index]);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function joinList(values) {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function formatCentipawnCount(value) {
  const rounded = Math.round(value);
  return `${rounded} ${Math.abs(rounded) === 1 ? "centipawn" : "centipawns"}`;
}

function formatSignedCentipawns(value) {
  const rounded = Math.round(value);
  return `${rounded >= 0 ? "+" : ""}${formatCentipawnCount(rounded)}`;
}

function numberOrNull(value) {
  return Number.isFinite(value) ? Math.round(value) : null;
}
