import { moveToNotation, toFen } from "./board.js";
import { lineToChineseNotation, moveToChineseNotation } from "./chinese-notation.js";
import { summarizeAlternativeEvidence, summarizeComparisonEvidence, summarizeLinePlanEvidence } from "./explanation-artifacts.js";
import { summarizePlanComparisonEvidence } from "./plan-comparison.js";
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

export function formatPositionStudy(study, options = {}) {
  if (normalizeLocale(options.locale) === "zh") return formatPositionStudyZh(study);

  const lines = [
    `Position study: ${capitalize(study.side)} to move${study.bestMove ? `, best ${study.bestMove}` : ""}`,
    study.summary
  ];

  if (study.playedMoveReview) {
    const review = study.playedMoveReview;
    lines.push(`Review: ${review.move} is ${review.classification}, ${review.centipawnLoss} cp loss; best ${review.bestMove}.`);
    if (review.planComparison?.summary) {
      lines.push(`Plan comparison: ${review.planComparison.summary}`);
    }
  }

  if (study.practiceFocus) {
    lines.push(`Practice: ${study.practiceFocus.title} - ${study.practiceFocus.text}`);
  }

  if (study.oracleReview) {
    lines.push(`Oracle: ${study.oracleReview.verdict}`);
  }

  if (study.oracleDisagreement) {
    lines.push(`Oracle correction: ${study.oracleDisagreement.move} trails ${study.oracleDisagreement.bestMove} by ${study.oracleDisagreement.centipawnLoss} cp (${study.oracleDisagreement.classification}).`);
  }

  if (study.searchDisagreement) {
    lines.push(`Search check: ${study.searchDisagreement.searchMove} is the top search candidate, while ${study.searchDisagreement.openingMove} is the opening-book choice.`);
  }

  if (study.decision?.linePlan?.summary) {
    lines.push(`Plan: ${study.decision.linePlan.summary}`);
  }

  const openingCandidates = study.openingCandidates ?? [];
  if (openingCandidates.length > 0) {
    lines.push("Opening candidates:");
    for (const candidate of openingCandidates.slice(0, 5)) {
      lines.push(`  ${candidate.rank}. ${candidate.move} (${candidate.scoreText}) - ${candidate.name}`);
    }
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
      if (alternative.planComparison?.summary) {
        lines.push(`     Why not: ${alternative.planComparison.summary}`);
      }
    }
  }

  return lines.join("\n");
}

function formatPositionStudyZh(study) {
  const best = study.zhBestMove ?? study.bestMove;
  const lines = [
    `局面研習：${sideNameZh(study.side)}走棋${best ? `，最佳 ${best}` : ""}`,
    study.zhSummary ?? study.summary
  ];

  if (study.playedMoveReview) {
    const review = study.playedMoveReview;
    lines.push(`覆盤：${review.zhMove ?? review.move} 為 ${classificationZh(review.classification)}，損失 ${review.centipawnLoss} cp；最佳 ${review.zhBestMove ?? review.bestMove}。`);
    if (review.planComparison?.summary) {
      lines.push(`計畫比較：${review.planComparison.summary}`);
    }
  }

  if (study.practiceFocus) {
    lines.push(`練習：${study.practiceFocus.title} - ${study.practiceFocus.text}`);
  }

  if (study.oracleReview) {
    lines.push(`強引擎覆核：${study.oracleReview.verdict}`);
  }

  if (study.oracleDisagreement) {
    const move = study.oracleDisagreement.zhMove ?? study.oracleDisagreement.move;
    const bestMove = study.oracleDisagreement.zhBestMove ?? study.oracleDisagreement.bestMove;
    lines.push(`強引擎修正：${move} 落後 ${bestMove} ${study.oracleDisagreement.centipawnLoss} cp（${classificationZh(study.oracleDisagreement.classification)}）。`);
  }

  if (study.searchDisagreement) {
    lines.push(`搜索校驗：${study.searchDisagreement.zhSearchMove ?? study.searchDisagreement.searchMove} 是淺層搜索首選，${study.searchDisagreement.zhOpeningMove ?? study.searchDisagreement.openingMove} 是開局庫選擇。`);
  }

  if (study.decision?.linePlan?.zhSummary) {
    lines.push(`計畫：${study.decision.linePlan.zhSummary}`);
  } else if (study.decision?.linePlan?.summary) {
    lines.push(`計畫：${study.decision.linePlan.summary}`);
  }

  const openingCandidates = study.openingCandidates ?? [];
  if (openingCandidates.length > 0) {
    lines.push("開局候選：");
    for (const candidate of openingCandidates.slice(0, 5)) {
      lines.push(`  ${candidate.rank}. ${candidate.zhMove ?? candidate.move} (${candidate.scoreText}) - ${candidate.name}`);
    }
  }

  if (study.hints.length > 0) {
    const hints = study.coach?.zhLevels ?? study.hints;
    lines.push("提示：");
    for (const hint of hints.slice(0, 4)) {
      lines.push(`  ${hint.level}. ${hint.title}: ${hint.text}`);
    }
  }

  if (study.candidateLines.length > 0) {
    lines.push("候選著法：");
    for (const line of study.candidateLines.slice(0, 5)) {
      lines.push(`  ${line.rank}. ${line.zhMove ?? line.move} (${line.scoreText}，損失 ${line.centipawnLoss} cp)`);
    }
  }

  if (study.decision?.comparison?.reason) {
    lines.push(`比較：${study.decision.comparison.reason}`);
  }

  if (study.decision?.zhReasons?.length > 0) {
    lines.push("理由：");
    for (const reason of study.decision.zhReasons.slice(0, 5)) {
      lines.push(`  - ${reason}`);
    }
  }

  if (study.decision?.alternatives?.length > 0) {
    lines.push("決策候選：");
    for (const alternative of study.decision.alternatives.slice(0, 5)) {
      const verdict = verdictZh(alternative.verdict);
      const loss = Number.isFinite(alternative.centipawnLoss)
        ? `，損失 ${alternative.centipawnLoss} cp`
        : "";
      lines.push(`  ${alternative.rank}. ${alternative.zhMove ?? alternative.move} (${alternative.scoreText}，${verdict}${loss})`);
      if (alternative.planComparison?.summary) {
        lines.push(`     為何不選：${alternative.planComparison.summary}`);
      }
    }
  }

  return lines.join("\n");
}

function buildPositionStudy(position, parts) {
  const decision = parts.decision ? summarizeDecision(parts.decision, position) : null;
  const candidateLines = summarizeCandidateLines(parts.analysis, position);
  const coach = summarizeCoach(parts.coach, position);
  const openingCandidates = summarizeOpeningCandidates(decision, coach, position);
  const searchDisagreement = summarizeSearchDisagreement(decision, candidateLines);
  const playedMoveReview = parts.review ? summarizeReview(parts.review, position) : null;
  const pressure = parts.pressure ? summarizePressure(parts.pressure, position) : null;
  const practiceFocus = playedMoveReview
    ? playedMoveReview.practiceFocus ?? practiceFocusFromReview(playedMoveReview)
    : null;
  const bestMove = decision?.bestMove
    ?? candidateLines[0]?.move
    ?? coach?.bestMove
    ?? null;
  const zhBestMove = decision?.zhBestMove
    ?? candidateLines[0]?.zhMove
    ?? coach?.zhBestMove
    ?? chineseNotationFor(position, bestMove);
  const oracleReview = decision?.oracleReview ?? playedMoveReview?.oracleReview ?? null;
  const oracleDisagreement = summarizeOracleDisagreement(oracleReview, position);
  const summary = summarizeStudy({ side: position.turn, bestMove, decision, playedMoveReview, oracleReview });
  const zhSummary = summarizeStudyZh({ side: position.turn, bestMove, zhBestMove, decision, playedMoveReview, oracleReview });

  return {
    type: "position-study",
    side: position.turn,
    fen: toFen(position),
    bestMove,
    zhBestMove,
    summary,
    zhSummary,
    decision,
    candidateLines,
    openingCandidates,
    searchDisagreement,
    hints: coach?.levels ?? [],
    coach,
    playedMoveReview,
    pressure,
    practiceFocus,
    oracleReview,
    oracleDisagreement,
    nextSteps: nextStudySteps({ decision, coach, playedMoveReview, pressure, practiceFocus, oracleDisagreement, searchDisagreement }),
    zhNextSteps: nextStudyStepsZh({ decision, coach, playedMoveReview, pressure, practiceFocus, oracleDisagreement, searchDisagreement })
  };
}

function summarizeDecision(decision, position) {
  const principalVariation = (decision.principalVariation ?? []).map(notationFor).filter(Boolean);
  const summary = {
    source: decision.source ?? "search",
    bestMove: notationFor(decision.bestMove),
    ponderMove: notationFor(decision.ponderMove) ?? decision.explanation?.search?.ponderMove ?? null,
    zhBestMove: chineseNotationFor(position, decision.bestMove),
    score: Math.round(decision.score ?? 0),
    scoreDetail: scoreDetailFor(decision),
    scoreText: scoreTextFor(decision),
    wdl: decision.wdl ?? decision.explanation?.search?.wdl ?? null,
    depth: decision.depth ?? 0,
    nodes: decision.nodes ?? 0,
    summary: decision.explanation?.summary ?? "",
    reasons: [...(decision.explanation?.reasons ?? [])],
    confidence: decision.explanation?.confidence ?? null,
    linePlan: annotateLinePlan(position, decision.explanation?.linePlan),
    comparison: summarizeComparisonEvidence(decision.explanation?.comparison),
    alternatives: annotateAlternatives(position, summarizeAlternativeEvidence(decision.explanation?.alternatives)),
    principalVariation,
    zhPrincipalVariation: chineseLineFor(position, principalVariation),
    oracleReview: decision.oracleReview ?? decision.explanation?.oracleReview ?? null,
    backendFallback: decision.backendFallback ?? null
  };
  return {
    ...summary,
    zhReasons: summarizeDecisionReasonsZh(summary)
  };
}

function summarizeCandidateLines(analysis, position) {
  return (analysis?.lines ?? []).map((line) => ({
    rank: line.rank,
    move: notationFor(line.move),
    zhMove: chineseNotationFor(position, line.move),
    score: Math.round(line.score ?? 0),
    scoreDetail: scoreDetailFor(line),
    scoreText: scoreTextFor(line),
    wdl: line.wdl ?? null,
    centipawnLoss: Math.round(line.centipawnLoss ?? 0),
    principalVariation: [...(line.principalVariation ?? [])],
    zhPrincipalVariation: chineseLineFor(position, line.principalVariation ?? []),
    summary: line.explanation?.summary ?? "",
    reasons: [...(line.explanation?.reasons ?? [])],
    linePlan: annotateLinePlan(position, line.explanation?.linePlan)
  }));
}

function summarizeOpeningCandidates(decision, coach, position) {
  if (coach?.source?.startsWith("opening") && coach.alternatives?.length > 0) {
    return coach.alternatives.map((alternative) => ({
      rank: alternative.rank,
      move: alternative.move,
      zhMove: alternative.zhMove ?? chineseNotationFor(position, alternative.move),
      score: Math.round(alternative.score ?? 0),
      scoreDetail: alternative.scoreDetail ?? null,
      scoreText: alternative.scoreText ?? scoreTextFor(alternative),
      wdl: alternative.wdl ?? null,
      principalVariation: [...(alternative.principalVariation ?? [])],
      name: alternative.book?.name ?? "Opening candidate",
      idea: alternative.book?.idea ?? "",
      tags: [...(alternative.book?.tags ?? [])],
      weight: alternative.book?.weight ?? Math.round(alternative.score ?? 0),
      database: alternative.book?.database ?? null
    }));
  }

  if (!decision?.source?.startsWith("opening")) return [];
  return (decision.alternatives ?? []).map((alternative) => ({
    rank: alternative.rank,
    move: alternative.move,
    zhMove: alternative.zhMove ?? chineseNotationFor(position, alternative.move),
    score: Math.round(alternative.score ?? 0),
    scoreDetail: alternative.scoreDetail ?? null,
    scoreText: alternative.scoreText ?? scoreTextFor(alternative),
    wdl: alternative.wdl ?? null,
    principalVariation: [...(alternative.principalVariation ?? [])],
    name: "Opening candidate",
    idea: alternative.note || alternative.summary || "",
    tags: [],
    weight: Math.round(alternative.score ?? 0),
    database: null
  }));
}

function summarizeSearchDisagreement(decision, candidateLines) {
  if (!decision?.source?.startsWith("opening")) return null;
  const topSearch = candidateLines[0];
  if (!topSearch?.move || !decision.bestMove || topSearch.move === decision.bestMove) return null;

  return {
    kind: "opening-vs-search",
    openingMove: decision.bestMove,
    zhOpeningMove: decision.zhBestMove ?? null,
    openingSource: decision.source,
    openingScore: decision.score,
    openingScoreText: decision.scoreText,
    searchMove: topSearch.move,
    zhSearchMove: topSearch.zhMove ?? null,
    searchScore: topSearch.score,
    searchScoreText: topSearch.scoreText,
    searchSummary: topSearch.summary,
    summary: `${decision.bestMove} is the opening-book choice, while shallow search currently ranks ${topSearch.move} first.`
  };
}

function summarizeCoach(coach, position) {
  if (!coach) return null;
  const principalVariation = [...(coach.principalVariation ?? [])];
  const summary = {
    source: coach.source ?? "search",
    bestMove: notationFor(coach.bestMove),
    zhBestMove: chineseNotationFor(position, coach.bestMove),
    score: Math.round(coach.score ?? 0),
    scoreDetail: scoreDetailFor(coach),
    scoreText: scoreTextFor(coach),
    wdl: coach.wdl ?? null,
    summary: coach.summary,
    levels: (coach.levels ?? []).map((level) => ({ ...level })),
    alternatives: annotateAlternatives(position, (coach.alternatives ?? []).map((alternative) => ({
      ...alternative,
      move: notationFor(alternative.move),
      scoreDetail: scoreDetailFor(alternative),
      scoreText: scoreTextFor(alternative),
      wdl: alternative.wdl ?? alternative.native?.wdl ?? null
    }))),
    principalVariation,
    zhPrincipalVariation: chineseLineFor(position, principalVariation)
  };
  return {
    ...summary,
    zhLevels: summarizeCoachLevelsZh(summary)
  };
}

function summarizeReview(review, position) {
  const summary = {
    move: notationFor(review.move),
    bestMove: notationFor(review.bestMove),
    zhMove: chineseNotationFor(position, review.move),
    zhBestMove: chineseNotationFor(position, review.bestMove),
    classification: review.classification,
    centipawnLoss: Math.round(review.centipawnLoss ?? 0),
    isBestMove: Boolean(review.isBestMove),
    playedScore: Math.round(review.playedScore ?? 0),
    playedScoreDetail: review.playedScoreDetail ?? null,
    playedScoreText: review.playedScoreDetail?.text ?? formatCentipawns(review.playedScore),
    playedWdl: review.playedWdl ?? null,
    bestScore: Math.round(review.bestScore ?? 0),
    bestScoreDetail: scoreDetailFor(review.bestAnalysis),
    bestScoreText: scoreTextFor(review.bestAnalysis ?? { score: review.bestScore }),
    bestWdl: review.bestAnalysis?.wdl ?? null,
    playedLinePlan: annotateLinePlan(position, review.playedLinePlan),
    bestLinePlan: annotateLinePlan(position, review.bestLinePlan ?? review.bestExplanation?.linePlan ?? review.bestAnalysis?.explanation?.linePlan),
    planComparison: summarizePlanComparisonEvidence(review.planComparison),
    bestComparison: summarizeComparisonEvidence(review.bestComparison ?? review.bestAnalysis?.explanation?.comparison),
    bestAlternatives: annotateAlternatives(position, summarizeAlternativeEvidence(review.bestAlternatives ?? review.bestAnalysis?.explanation?.alternatives)),
    depth: review.depth ?? 0,
    nodes: review.nodes ?? 0,
    summary: review.explanation?.summary ?? "",
    reasons: [...(review.explanation?.reasons ?? [])],
    mistakes: review.mistakes ?? null,
    practiceFocus: review.practiceFocus ?? null,
    principalVariation: [...(review.principalVariation ?? [])],
    zhPrincipalVariation: chineseLineFor(position, review.principalVariation ?? []),
    oracleReview: review.oracleReview ?? null,
    reviewBackend: review.reviewBackend ?? null
  };
  return {
    ...summary,
    zhReasons: summarizeReviewReasonsZh(summary)
  };
}

function summarizeOracleDisagreement(oracleReview, position) {
  if (oracleReview?.status !== "reviewed" || oracleReview.isBestMove) return null;
  if (!oracleReview.move || !oracleReview.bestMove) return null;

  return {
    kind: "oracle-disagreement",
    move: oracleReview.move,
    bestMove: oracleReview.bestMove,
    zhMove: chineseNotationFor(position, oracleReview.move),
    zhBestMove: chineseNotationFor(position, oracleReview.bestMove),
    classification: oracleReview.classification ?? "review",
    centipawnLoss: Math.round(oracleReview.centipawnLoss ?? 0),
    backend: oracleReview.backend ?? null,
    verdict: oracleReview.verdict ?? "",
    summary: oracleReview.summary ?? oracleReview.verdict ?? "",
    reasons: [...(oracleReview.reasons ?? [])],
    principalVariation: [...(oracleReview.principalVariation ?? [])]
  };
}

function summarizePressure(pressure, position) {
  return {
    side: pressure.side,
    inCheck: Boolean(pressure.inCheck),
    threats: pressure.threats.map((threat) => summarizeThreat(threat, position)),
    opponentThreats: pressure.opponentThreats.map((threat) => summarizeThreat(threat, position))
  };
}

function summarizeThreat(threat, position) {
  const zhMove = chineseNotationFor(position, threat.notation);
  return {
    move: threat.notation,
    zhMove,
    score: threat.score,
    givesCheck: threat.givesCheck,
    isMate: threat.isMate,
    motifs: [...(threat.motifs ?? [])],
    summary: threat.summary,
    zhSummary: summarizeThreatZh(threat, zhMove)
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
    const loss = Number.isFinite(oracleReview.centipawnLoss)
      ? ` by ${Math.round(oracleReview.centipawnLoss)} cp`
      : "";
    return `${bestMove} is the candidate move, but the oracle prefers ${oracleReview.bestMove}${loss}.`;
  }
  return decision?.summary ?? `${bestMove} is the recommended move for ${side}.`;
}

function summarizeStudyZh({ side, bestMove, zhBestMove, decision, playedMoveReview, oracleReview }) {
  const best = zhBestMove ?? bestMove;
  if (playedMoveReview) {
    const played = playedMoveReview.zhMove ?? playedMoveReview.move;
    if (playedMoveReview.isBestMove) {
      return `${played} 是${sideNameZh(side)}的最佳著法；本局面仍建議 ${best}。`;
    }
    return `${played} 為 ${classificationZh(playedMoveReview.classification)}；建議改走 ${best}。`;
  }

  if (!bestMove) return `${sideNameZh(side)}無合法著法。`;
  if (oracleReview?.status === "reviewed" && !oracleReview.isBestMove) {
    const loss = Number.isFinite(oracleReview.centipawnLoss)
      ? ` ${Math.round(oracleReview.centipawnLoss)} cp`
      : "";
    const oracleBest = decision?.oracleReview?.zhBestMove ?? oracleReview.bestMove;
    return `${best} 是候選著法，但強引擎更偏好 ${oracleBest}${loss ? `，差距${loss}` : ""}。`;
  }

  const source = decision?.source?.startsWith("opening") ? "開局庫" : "搜索";
  const score = Number.isFinite(decision?.score) ? `，評分 ${decision.scoreText ?? formatCentipawns(decision.score)}` : "";
  return `${source}建議 ${best}${score}。`;
}

function summarizeDecisionReasonsZh(decision) {
  const reasons = [];
  const move = decision.zhBestMove ?? decision.bestMove;
  if (!move) return reasons;

  const source = decision.source?.startsWith("opening")
    ? "開局庫"
    : decision.source?.startsWith("native")
      ? "原生引擎"
      : "搜索";
  if (decision.source?.startsWith("opening")) {
    reasons.push(`${source}優先推薦 ${move}。`);
  } else if (decision.depth > 0) {
    reasons.push(`${source}在深度 ${decision.depth} 推薦 ${move}。`);
  } else {
    reasons.push(`${source}推薦 ${move}。`);
  }

  if (decision.scoreText) {
    reasons.push(`局面評分為 ${decision.scoreText}。`);
  }

  if (decision.linePlan?.zhSummary) {
    reasons.push(decision.linePlan.zhSummary);
  }

  const next = (decision.alternatives ?? []).find((alternative) => alternative.move !== decision.bestMove);
  if (next) {
    const gap = Number.isFinite(next.centipawnLoss)
      ? next.centipawnLoss
      : Math.max(0, Math.round((decision.score ?? 0) - (next.score ?? 0)));
    const unit = decision.source?.startsWith("opening") ? "權重點" : "cp";
    if (gap > 0) {
      reasons.push(`相較 ${next.zhMove ?? next.move}，首選約領先 ${gap} ${unit}。`);
    } else {
      reasons.push(`${next.zhMove ?? next.move} 與首選接近，適合一起比較。`);
    }
  }

  if (decision.oracleReview?.status === "reviewed" && !decision.oracleReview.isBestMove) {
    reasons.push(`強引擎覆核建議再比較 ${decision.oracleReview.bestMove}。`);
  }

  return reasons;
}

function summarizeReviewReasonsZh(review) {
  const reasons = [];
  const move = review.zhMove ?? review.move;
  const best = review.zhBestMove ?? review.bestMove;

  if (review.isBestMove) {
    reasons.push(`${move} 與引擎首選一致。`);
  } else if (move && best) {
    reasons.push(`${move} 損失約 ${review.centipawnLoss} cp，建議比較 ${best}。`);
  }

  if (review.playedScoreText) {
    reasons.push(`實戰著法評分 ${review.playedScoreText}。`);
  }
  if (review.bestScoreText) {
    reasons.push(`最佳著法評分 ${review.bestScoreText}。`);
  }
  if (review.playedLinePlan?.zhSummary) {
    reasons.push(`實戰計畫：${review.playedLinePlan.zhSummary}`);
  }
  if (review.bestLinePlan?.zhSummary) {
    reasons.push(`建議計畫：${review.bestLinePlan.zhSummary}`);
  }

  return reasons.slice(0, 6);
}

function summarizeThreatZh(threat, zhMove) {
  const move = zhMove ?? threat.notation;
  if (!move) return "";
  if (threat.isMate) return `${move} 形成殺勢。`;
  if (threat.givesCheck || threat.motifs?.includes("check")) return `${move} 將軍並迫使對方應對。`;
  if (threat.motifs?.some((motif) => /^wins /.test(motif))) return `${move} 有得子威脅。`;
  if (threat.motifs?.includes("safe capture")) return `${move} 是較安全的吃子手段。`;
  if (threat.motifs?.includes("recapture risk")) return `${move} 有吃子後被反吃的風險。`;
  return `${move} 對對方形成壓力。`;
}

function annotateAlternatives(position, alternatives = []) {
  return alternatives.map((alternative) => {
    const line = [alternative.move, alternative.expectedReply].filter(Boolean);
    const zhLine = chineseLineFor(position, line);
    return {
      ...alternative,
      zhMove: zhLine[0] ?? chineseNotationFor(position, alternative.move),
      zhExpectedReply: zhLine[1] ?? null,
      zhPrincipalVariation: chineseLineFor(position, alternative.principalVariation ?? [])
    };
  });
}

function annotateLinePlan(position, linePlan) {
  const summary = summarizeLinePlanEvidence(linePlan);
  if (!summary) return null;

  const line = [
    summary.firstMove,
    summary.expectedReply,
    ...(summary.continuation ?? [])
  ].filter(Boolean);
  const zhLine = chineseLineFor(position, line);

  return {
    ...summary,
    zhFirstMove: zhLine[0] ?? null,
    zhExpectedReply: zhLine[1] ?? null,
    zhContinuation: zhLine.slice(2),
    zhMoves: (summary.moves ?? []).map((move, index) => ({
      ...move,
      zhNotation: zhLine[index] ?? null
    })),
    zhSummary: summarizeLinePlanZh(summary, zhLine)
  };
}

function summarizeLinePlanZh(linePlan, zhLine) {
  if (!linePlan || zhLine.length === 0) return "";
  const [first, reply, ...rest] = zhLine;
  const motifs = linePlan.motifs?.length ? `；主題：${linePlan.motifs.map(motifZh).join("、")}` : "";
  const replyText = reply ? `，預期應手 ${reply}` : "";
  const continuation = rest.length > 0 ? `，後續 ${rest.join(" ")}` : "";
  return `先走 ${first}${replyText}${continuation}${motifs}。`;
}

function summarizeCoachLevelsZh(coach) {
  const move = coach.zhBestMove ?? coach.bestMove;
  if (!move) {
    return [{
      level: 1,
      kind: "status",
      title: "狀態",
      text: "此局面沒有可提示的合法著法。"
    }];
  }

  const next = (coach.alternatives ?? []).find((alternative) => alternative.move !== coach.bestMove);
  const levels = [{
    level: 1,
    kind: "concept",
    title: coach.source?.startsWith("opening") ? "開局方向" : "局面方向",
    text: coach.source?.startsWith("opening")
      ? `先考慮 ${move}，用開局庫思路建立子力活躍度。`
      : "先找能改善協調、限制對手或製造威脅的候選著法。"
  }, {
    level: 2,
    kind: "tactic",
    title: "戰術線索",
    text: coach.scoreText ? `目前評分線索為 ${coach.scoreText}。` : "留意將軍、得子和直接威脅。"
  }, {
    level: 3,
    kind: "candidate",
    title: "候選比較",
    text: next
      ? `把 ${move} 與 ${next.zhMove ?? next.move} 放在一起比較。`
      : `${move} 是目前候選列表中的首選。`
  }, {
    level: 4,
    kind: "reveal",
    title: "最佳著法",
    text: `最佳著法是 ${move}。`
  }];

  return levels;
}

function nextStudyStepsZh({ decision, coach, playedMoveReview, pressure, practiceFocus, oracleDisagreement, searchDisagreement }) {
  const steps = [];
  if (playedMoveReview && !playedMoveReview.isBestMove) {
    steps.push({
      kind: "correction",
      text: `比較 ${playedMoveReview.zhMove ?? playedMoveReview.move} 與 ${playedMoveReview.zhBestMove ?? playedMoveReview.bestMove}。`
    });
  }
  if (practiceFocus) {
    steps.push({
      kind: "practice",
      text: practiceFocus.text,
      focus: practiceFocus
    });
  }
  if (oracleDisagreement && !playedMoveReview) {
    const backend = oracleDisagreement.backend?.name ?? "Oracle";
    steps.push({
      kind: "oracle-disagreement",
      text: `${backend} 較偏好 ${oracleDisagreement.zhBestMove ?? oracleDisagreement.bestMove}，而不是 ${oracleDisagreement.zhMove ?? oracleDisagreement.move}（${oracleDisagreement.centipawnLoss} cp，${classificationZh(oracleDisagreement.classification)}）。`,
      ref: "oracle-review",
      oracleDisagreement
    });
  }
  if (searchDisagreement && !playedMoveReview) {
    steps.push({
      kind: "opening-search-check",
      text: `比較開局庫 ${searchDisagreement.zhOpeningMove ?? searchDisagreement.openingMove} 與搜索候選 ${searchDisagreement.zhSearchMove ?? searchDisagreement.searchMove}。`,
      ref: "search-disagreement",
      searchDisagreement
    });
  }
  if (coach?.levels?.[0]) {
    steps.push({
      kind: "hint",
      text: coach.zhLevels?.[0]?.text ?? coach.levels[0].text
    });
  }
  if (pressure?.opponentThreats?.[0]) {
    steps.push({
      kind: "danger",
      text: pressure.opponentThreats[0].zhSummary ?? pressure.opponentThreats[0].summary
    });
  }
  if (decision?.linePlan?.zhSummary) {
    steps.push({
      kind: "line",
      text: decision.linePlan.zhSummary
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

function nextStudySteps({ decision, coach, playedMoveReview, pressure, practiceFocus, oracleDisagreement, searchDisagreement }) {
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
  if (oracleDisagreement && !playedMoveReview) {
    const backend = oracleDisagreement.backend?.name ?? "Oracle";
    steps.push({
      kind: "oracle-disagreement",
      text: `${backend} prefers ${oracleDisagreement.bestMove} over ${oracleDisagreement.move} (${oracleDisagreement.centipawnLoss} cp, ${oracleDisagreement.classification}).`,
      ref: "oracle-review",
      oracleDisagreement
    });
  }
  if (searchDisagreement && !playedMoveReview) {
    steps.push({
      kind: "opening-search-check",
      text: `Compare opening-book ${searchDisagreement.openingMove} with search candidate ${searchDisagreement.searchMove}.`,
      ref: "search-disagreement",
      searchDisagreement
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

function chineseNotationFor(position, move) {
  if (!position || !move) return null;
  try {
    return moveToChineseNotation(position, move);
  } catch {
    return null;
  }
}

function chineseLineFor(position, moves) {
  if (!position || !moves?.length) return [];
  try {
    return lineToChineseNotation(position, moves);
  } catch {
    return [];
  }
}

function sideNameZh(side) {
  return side === "black" ? "黑方" : "紅方";
}

function classificationZh(classification) {
  return ({
    best: "最佳",
    excellent: "佳著",
    good: "好棋",
    inaccuracy: "緩手",
    mistake: "錯著",
    blunder: "敗著",
    review: "待覆盤"
  })[classification] ?? classification ?? "待覆盤";
}

function verdictZh(verdict) {
  return ({
    best: "最佳",
    playable: "可行",
    candidate: "候選",
    inferior: "較差",
    mistake: "錯著"
  })[verdict] ?? verdict ?? "候選";
}

function motifZh(motif) {
  return ({
    "creates threat": "製造威脅",
    "safe capture": "安全吃子",
    "recapture risk": "反吃風險",
    "limits replies": "限制應手",
    "discovered check": "閃擊將軍",
    skewer: "串打",
    pin: "牽制",
    check: "將軍"
  })[motif] ?? motif;
}

function normalizeLocale(locale) {
  return String(locale ?? "").toLowerCase().startsWith("zh") ? "zh" : "en";
}

function capitalize(text) {
  return `${text.slice(0, 1).toUpperCase()}${text.slice(1)}`;
}
