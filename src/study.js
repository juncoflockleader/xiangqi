import { moveToNotation, toFen } from "./board.js";
import { summarizeAlternativeEvidence, summarizeComparisonEvidence } from "./explanation-artifacts.js";
import { practiceFocusFromReview } from "./practice.js";

const DEFAULT_STUDY_LINES = 3;

export function studyPositionWithEngine(engine, position, options = {}) {
  const shared = sharedStudyOptions(options);
  const lines = normalizeStudyLines(options);
  const decision = options.includeDecision === false
    ? null
    : engine.chooseMove(position, {
        ...shared,
        lines,
        ...(options.decisionOptions ?? {})
      });
  const analysis = options.includeAnalysis === false
    ? null
    : engine.analyzePosition(position, {
        ...shared,
        lines,
        ...(options.analysisOptions ?? {})
      });
  const coach = options.includeCoach === false
    ? null
    : engine.coachMove(position, {
        ...shared,
        lines,
        maxLevels: options.maxHintLevels ?? options.maxLevels,
        ...(options.coachOptions ?? {})
      });
  const review = resolvePlayedMove(options)
    ? engine.reviewMove(position, resolvePlayedMove(options), {
        ...shared,
        ...(options.reviewOptions ?? {})
      })
    : null;
  const pressure = options.includePressure === false || typeof engine.pressure !== "function"
    ? null
    : engine.pressure(position, {
        limit: options.pressureLimit ?? 3,
        ...(options.pressureOptions ?? {})
      });

  return buildPositionStudy(position, {
    decision,
    analysis,
    coach,
    review,
    pressure
  });
}

export async function studyPositionWithBackend(backend, position, options = {}) {
  const shared = sharedStudyOptions(options);
  const lines = normalizeStudyLines(options);
  const decision = options.includeDecision === false
    ? null
    : await backend.chooseMove(position, {
        ...shared,
        lines,
        ...(options.decisionOptions ?? {})
      });
  const analysis = options.includeAnalysis === false
    ? null
    : await backend.analyzePosition(position, {
        ...shared,
        lines,
        ...(options.analysisOptions ?? {})
      });
  const coach = options.includeCoach === false || typeof backend.coachMove !== "function"
    ? null
    : await backend.coachMove(position, {
        ...shared,
        lines,
        maxLevels: options.maxHintLevels ?? options.maxLevels,
        ...(options.coachOptions ?? {})
      });
  const review = resolvePlayedMove(options) && typeof backend.reviewMove === "function"
    ? await backend.reviewMove(position, resolvePlayedMove(options), {
        ...shared,
        ...(options.reviewOptions ?? {})
      })
    : null;
  const pressure = options.includePressure === false || typeof backend.pressure !== "function"
    ? null
    : backend.pressure(position, {
        limit: options.pressureLimit ?? 3,
        ...(options.pressureOptions ?? {})
      });

  return buildPositionStudy(position, {
    decision,
    analysis,
    coach,
    review,
    pressure
  });
}

export function formatPositionStudy(study) {
  const lines = [
    `Position study: ${capitalize(study.side)} to move${study.bestMove ? `, best ${study.bestMove}` : ""}`,
    study.summary
  ];

  if (study.playedMoveReview) {
    const review = study.playedMoveReview;
    lines.push(`Review: ${review.move} is ${review.classification}, ${review.centipawnLoss} cp loss; best ${review.bestMove}.`);
  }

  if (study.practiceFocus) {
    lines.push(`Practice: ${study.practiceFocus.title} - ${study.practiceFocus.text}`);
  }

  if (study.oracleReview) {
    lines.push(`Oracle: ${study.oracleReview.verdict}`);
  }

  if (study.hints.length > 0) {
    lines.push("Hints:");
    for (const hint of study.hints.slice(0, 4)) {
      lines.push(`  ${hint.level}. ${hint.title}: ${hint.text}`);
    }
  }

  if (study.candidateLines.length > 0) {
    lines.push("Candidates:");
    for (const line of study.candidateLines.slice(0, 5)) {
      lines.push(`  ${line.rank}. ${line.move} (${line.scoreText}, loss ${line.centipawnLoss} cp)`);
    }
  }

  if (study.decision?.comparison?.reason) {
    lines.push(`Comparison: ${study.decision.comparison.reason}`);
  }

  if (study.decision?.alternatives?.length > 0) {
    lines.push("Decision alternatives:");
    for (const alternative of study.decision.alternatives.slice(0, 5)) {
      const verdict = alternative.verdict ?? "candidate";
      const loss = Number.isFinite(alternative.centipawnLoss)
        ? `, loss ${alternative.centipawnLoss} cp`
        : "";
      lines.push(`  ${alternative.rank}. ${alternative.move} (${alternative.scoreText}, ${verdict}${loss})`);
    }
  }

  return lines.join("\n");
}

function buildPositionStudy(position, parts) {
  const decision = parts.decision ? summarizeDecision(parts.decision) : null;
  const candidateLines = summarizeCandidateLines(parts.analysis);
  const coach = summarizeCoach(parts.coach);
  const playedMoveReview = parts.review ? summarizeReview(parts.review) : null;
  const pressure = parts.pressure ? summarizePressure(parts.pressure) : null;
  const practiceFocus = playedMoveReview ? practiceFocusFromReview(playedMoveReview) : null;
  const bestMove = decision?.bestMove
    ?? candidateLines[0]?.move
    ?? coach?.bestMove
    ?? null;
  const oracleReview = decision?.oracleReview ?? playedMoveReview?.oracleReview ?? null;

  return {
    type: "position-study",
    side: position.turn,
    fen: toFen(position),
    bestMove,
    summary: summarizeStudy({ side: position.turn, bestMove, decision, playedMoveReview, oracleReview }),
    decision,
    candidateLines,
    hints: coach?.levels ?? [],
    coach,
    playedMoveReview,
    pressure,
    practiceFocus,
    oracleReview,
    nextSteps: nextStudySteps({ decision, coach, playedMoveReview, pressure, practiceFocus })
  };
}

function summarizeDecision(decision) {
  return {
    source: decision.source ?? "search",
    bestMove: notationFor(decision.bestMove),
    score: Math.round(decision.score ?? 0),
    scoreDetail: scoreDetailFor(decision),
    scoreText: scoreTextFor(decision),
    wdl: decision.wdl ?? decision.explanation?.search?.wdl ?? null,
    depth: decision.depth ?? 0,
    nodes: decision.nodes ?? 0,
    summary: decision.explanation?.summary ?? "",
    reasons: [...(decision.explanation?.reasons ?? [])],
    confidence: decision.explanation?.confidence ?? null,
    linePlan: decision.explanation?.linePlan ?? null,
    comparison: summarizeComparisonEvidence(decision.explanation?.comparison),
    alternatives: summarizeAlternativeEvidence(decision.explanation?.alternatives),
    principalVariation: (decision.principalVariation ?? []).map(notationFor).filter(Boolean),
    oracleReview: decision.oracleReview ?? decision.explanation?.oracleReview ?? null,
    backendFallback: decision.backendFallback ?? null
  };
}

function summarizeCandidateLines(analysis) {
  return (analysis?.lines ?? []).map((line) => ({
    rank: line.rank,
    move: notationFor(line.move),
    score: Math.round(line.score ?? 0),
    scoreDetail: scoreDetailFor(line),
    scoreText: scoreTextFor(line),
    wdl: line.wdl ?? null,
    centipawnLoss: Math.round(line.centipawnLoss ?? 0),
    principalVariation: [...(line.principalVariation ?? [])],
    summary: line.explanation?.summary ?? "",
    reasons: [...(line.explanation?.reasons ?? [])],
    linePlan: line.explanation?.linePlan ?? null
  }));
}

function summarizeCoach(coach) {
  if (!coach) return null;
  return {
    source: coach.source ?? "search",
    bestMove: notationFor(coach.bestMove),
    score: Math.round(coach.score ?? 0),
    scoreDetail: scoreDetailFor(coach),
    scoreText: scoreTextFor(coach),
    wdl: coach.wdl ?? null,
    summary: coach.summary,
    levels: (coach.levels ?? []).map((level) => ({ ...level })),
    alternatives: (coach.alternatives ?? []).map((alternative) => ({
      ...alternative,
      move: notationFor(alternative.move),
      scoreDetail: scoreDetailFor(alternative),
      scoreText: scoreTextFor(alternative),
      wdl: alternative.wdl ?? alternative.native?.wdl ?? null
    })),
    principalVariation: [...(coach.principalVariation ?? [])]
  };
}

function summarizeReview(review) {
  return {
    move: notationFor(review.move),
    bestMove: notationFor(review.bestMove),
    classification: review.classification,
    centipawnLoss: Math.round(review.centipawnLoss ?? 0),
    isBestMove: Boolean(review.isBestMove),
    playedScore: Math.round(review.playedScore ?? 0),
    bestScore: Math.round(review.bestScore ?? 0),
    bestScoreDetail: scoreDetailFor(review.bestAnalysis),
    bestScoreText: scoreTextFor(review.bestAnalysis ?? { score: review.bestScore }),
    bestWdl: review.bestAnalysis?.wdl ?? null,
    bestComparison: summarizeComparisonEvidence(review.bestComparison ?? review.bestAnalysis?.explanation?.comparison),
    bestAlternatives: summarizeAlternativeEvidence(review.bestAlternatives ?? review.bestAnalysis?.explanation?.alternatives),
    depth: review.depth ?? 0,
    nodes: review.nodes ?? 0,
    summary: review.explanation?.summary ?? "",
    reasons: [...(review.explanation?.reasons ?? [])],
    mistakes: review.mistakes ?? null,
    principalVariation: [...(review.principalVariation ?? [])],
    oracleReview: review.oracleReview ?? null,
    reviewBackend: review.reviewBackend ?? null
  };
}

function summarizePressure(pressure) {
  return {
    side: pressure.side,
    inCheck: Boolean(pressure.inCheck),
    threats: pressure.threats.map(summarizeThreat),
    opponentThreats: pressure.opponentThreats.map(summarizeThreat)
  };
}

function summarizeThreat(threat) {
  return {
    move: threat.notation,
    score: threat.score,
    givesCheck: threat.givesCheck,
    isMate: threat.isMate,
    motifs: [...(threat.motifs ?? [])],
    summary: threat.summary
  };
}

function summarizeStudy({ side, bestMove, decision, playedMoveReview, oracleReview }) {
  if (playedMoveReview) {
    if (playedMoveReview.isBestMove) {
      return `${playedMoveReview.move} is best for ${side}; the study still recommends ${bestMove}.`;
    }
    return `${playedMoveReview.move} is ${playedMoveReview.classification}; ${bestMove} is the recommended move.`;
  }

  if (!bestMove) return `No legal move is available for ${side}.`;
  if (oracleReview?.status === "reviewed" && !oracleReview.isBestMove) {
    return `${bestMove} is the candidate move, but the oracle prefers ${oracleReview.bestMove}.`;
  }
  return decision?.summary ?? `${bestMove} is the recommended move for ${side}.`;
}

function nextStudySteps({ decision, coach, playedMoveReview, pressure, practiceFocus }) {
  const steps = [];
  if (playedMoveReview && !playedMoveReview.isBestMove) {
    steps.push({
      kind: "correction",
      text: `Compare ${playedMoveReview.move} with ${playedMoveReview.bestMove}.`
    });
  }
  if (practiceFocus) {
    steps.push({
      kind: "practice",
      text: practiceFocus.text,
      focus: practiceFocus
    });
  }
  if (coach?.levels?.[0]) {
    steps.push({
      kind: "hint",
      text: coach.levels[0].text
    });
  }
  if (pressure?.opponentThreats?.[0]) {
    steps.push({
      kind: "danger",
      text: pressure.opponentThreats[0].summary
    });
  }
  if (decision?.linePlan?.summary) {
    steps.push({
      kind: "line",
      text: decision.linePlan.summary
    });
  }
  if (decision?.comparison?.reason) {
    steps.push({
      kind: "comparison",
      text: decision.comparison.reason
    });
  }
  return steps.slice(0, 4);
}

function sharedStudyOptions(options) {
  return {
    ...(options.depth !== undefined ? { depth: options.depth } : {}),
    ...(options.timeLimitMs !== undefined ? { timeLimitMs: options.timeLimitMs } : {}),
    ...(options.useBook !== undefined ? { useBook: options.useBook } : {}),
    ...(options.history !== undefined ? { history: options.history } : {}),
    ...(options.searchOptions ?? {})
  };
}

function normalizeStudyLines(options) {
  const value = options.lines ?? options.multiPv ?? options.multipv ?? DEFAULT_STUDY_LINES;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_STUDY_LINES;
  return Math.max(1, Math.min(12, parsed));
}

function resolvePlayedMove(options) {
  return options.playedMove ?? options.move ?? null;
}

function notationFor(move) {
  if (!move) return null;
  if (typeof move === "string") return move;
  return move.notation ?? moveToNotation(move);
}

function formatCentipawns(value) {
  const rounded = Math.round(value ?? 0);
  return `${rounded >= 0 ? "+" : ""}${rounded} cp`;
}

function scoreDetailFor(entry) {
  if (!entry) return null;
  return entry.scoreDetail ?? entry.native?.scoreDetail ?? entry.explanation?.search?.scoreDetail ?? null;
}

function scoreTextFor(entry) {
  return scoreDetailFor(entry)?.text ?? formatCentipawns(entry?.score);
}

function capitalize(text) {
  return `${text.slice(0, 1).toUpperCase()}${text.slice(1)}`;
}
