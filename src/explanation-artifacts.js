export function summarizeComparisonEvidence(comparison) {
  if (!comparison) return null;

  return {
    ...comparison,
    bestLine: [...(comparison.bestLine ?? [])],
    nextLine: [...(comparison.nextLine ?? [])]
  };
}

export function summarizeAlternativeEvidence(alternatives) {
  return (alternatives ?? []).map((alternative) => ({
    rank: alternative.rank,
    move: alternative.move,
    score: Math.round(alternative.score ?? 0),
    scoreDetail: scoreDetailFor(alternative),
    scoreText: scoreTextForAlternative(alternative),
    wdl: alternative.wdl ?? null,
    centipawnLoss: Number.isFinite(alternative.centipawnLoss)
      ? Math.round(alternative.centipawnLoss)
      : null,
    verdict: alternative.verdict ?? null,
    summary: alternative.summary ?? "",
    reasons: [...(alternative.reasons ?? [])],
    expectedReply: alternative.expectedReply ?? null,
    motifs: [...(alternative.motifs ?? [])],
    linePlanSummary: alternative.linePlanSummary ?? "",
    principalVariation: [...(alternative.principalVariation ?? [])],
    principalVariationText: alternative.principalVariationText ?? "",
    note: alternative.note ?? ""
  }));
}

export function summarizeLinePlanEvidence(linePlan) {
  if (!linePlan) return null;

  return {
    summary: linePlan.summary ?? "",
    perspective: linePlan.perspective ?? null,
    firstMove: linePlan.firstMove ?? null,
    expectedReply: linePlan.expectedReply ?? null,
    continuation: [...(linePlan.continuation ?? [])],
    moves: (linePlan.moves ?? []).map((move) => ({
      ...move,
      motifs: [...(move.motifs ?? [])]
    })),
    motifs: [...(linePlan.motifs ?? [])],
    startingScore: numberOrNull(linePlan.startingScore),
    endingScore: numberOrNull(linePlan.endingScore),
    evaluationSwing: numberOrNull(linePlan.evaluationSwing),
    startingScoreText: linePlan.startingScoreText ?? null,
    endingScoreText: linePlan.endingScoreText ?? null,
    evaluationSwingText: linePlan.evaluationSwingText ?? null
  };
}

function scoreDetailFor(entry) {
  if (!entry) return null;
  return entry.scoreDetail ?? entry.native?.scoreDetail ?? entry.explanation?.search?.scoreDetail ?? null;
}

function scoreTextForAlternative(alternative) {
  const detail = scoreDetailFor(alternative);
  if (detail?.text) return detail.text;

  if (Number.isFinite(alternative.centipawnLoss) || alternative.verdict) {
    return formatCentipawns(alternative.score);
  }

  return `score ${Math.round(alternative.score ?? 0)}`;
}

function formatCentipawns(value) {
  const rounded = Math.round(value ?? 0);
  return `${rounded >= 0 ? "+" : ""}${rounded} cp`;
}

function numberOrNull(value) {
  return Number.isFinite(value) ? value : null;
}
