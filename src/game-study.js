import { parseFen, toFen } from "./board.js";
import { summarizeAlternativeEvidence, summarizeComparisonEvidence, summarizeLinePlanEvidence } from "./explanation-artifacts.js";
import { createLessonPlanFromReview } from "./lesson.js";
import { aggregatePracticeFocusFromReview } from "./practice.js";
import { studyPositionWithBackend, studyPositionWithEngine } from "./study.js";

const DEFAULT_MAX_POSITION_STUDIES = 3;

export function createGameStudyWithEngine(engine, moves, options = {}) {
  const review = options.review ?? engine.reviewGame(moves, gameReviewOptions(options));
  const lessonPlan = options.lessonPlan ?? createLessonPlanFromReview(review, {
    ...(options.lessonOptions ?? {})
  });
  const positionStudies = createPositionStudiesWithEngine(engine, review, options);

  return buildGameStudy(review, lessonPlan, positionStudies, options);
}

export async function createGameStudyWithBackend(backend, moves, options = {}) {
  const review = options.review ?? await backend.reviewGame(moves, gameReviewOptions(options));
  const lessonPlan = options.lessonPlan ?? createLessonPlanFromReview(review, {
    ...(options.lessonOptions ?? {})
  });
  const positionStudies = await createPositionStudiesWithBackend(backend, review, options);

  return buildGameStudy(review, lessonPlan, positionStudies, options);
}

export function formatGameStudy(study) {
  const lines = [
    `Game study: ${study.summary.totalMoves} moves, average loss ${study.summary.averageCentipawnLoss} cp`,
    `Lessons: ${study.summary.lessonCards}; position studies: ${study.summary.positionStudies}; key moments: ${study.summary.keyMoments}`
  ];

  if (study.status?.state) {
    lines.push(`Status: ${study.status.state}`);
  }

  if (study.keyMoments.length > 0) {
    lines.push("Key moments:");
    for (const moment of study.keyMoments.slice(0, 5)) {
      lines.push(`  ${moment.ply}. ${capitalize(moment.side)} ${moment.notation}: ${moment.classification}, ${moment.centipawnLoss} cp loss`);
      if (moment.bestLinePlan?.summary) {
        lines.push(`     Best plan: ${moment.bestLinePlan.summary}`);
      }
    }
  }

  if (study.lessonPlan.cards.length > 0) {
    lines.push("Lesson cards:");
    for (const card of study.lessonPlan.cards.slice(0, 5)) {
      lines.push(`  ${card.rank}. ${card.title}: ${card.prompt}`);
    }
  }

  if (study.practiceFocus.length > 0) {
    lines.push("Practice focus:");
    for (const focus of study.practiceFocus.slice(0, 3)) {
      lines.push(`  ${focus.title}: ${focus.text}`);
    }
  }

  if (study.positionStudies.length > 0) {
    lines.push("Position studies:");
    for (const item of study.positionStudies.slice(0, 3)) {
      lines.push(`  Ply ${item.gameMoment.ply}: ${item.summary}`);
    }
  }

  return lines.join("\n");
}

function createPositionStudiesWithEngine(engine, review, options) {
  return studyMoments(review, options).map((move) => {
    const position = parseFen(move.positionBefore);
    const study = studyPositionWithEngine(engine, position, positionStudyOptions(move, options));
    return attachGameMoment(study, move);
  });
}

async function createPositionStudiesWithBackend(backend, review, options) {
  const studies = [];
  for (const move of studyMoments(review, options)) {
    const position = parseFen(move.positionBefore);
    const study = await studyPositionWithBackend(backend, position, positionStudyOptions(move, options));
    studies.push(attachGameMoment(study, move));
  }
  return studies;
}

function buildGameStudy(review, lessonPlan, positionStudies, options) {
  const finalFen = review.finalPosition ? toFen(review.finalPosition) : null;
  const practiceFocus = aggregatePracticeFocusFromReview(review, options.practiceOptions ?? {});
  return {
    type: "game-study",
    title: options.title ?? "Xiangqi Game Study",
    summary: {
      ...review.summary,
      keyMoments: review.keyMoments.length,
      lessonCards: lessonPlan.cards.length,
      positionStudies: positionStudies.length,
      practiceFocus: practiceFocus.length
    },
    status: review.status,
    finalFen,
    review,
    keyMoments: review.keyMoments,
    lessonPlan,
    positionStudies,
    practiceFocus,
    nextSteps: nextGameStudySteps(lessonPlan, positionStudies, review, practiceFocus)
  };
}

function gameReviewOptions(options) {
  return {
    ...(options.initialPosition ? { initialPosition: options.initialPosition } : {}),
    ...(options.maxKeyMoments !== undefined ? { maxKeyMoments: options.maxKeyMoments } : {}),
    ...(options.bookOptions ? { bookOptions: options.bookOptions } : {}),
    reviewOptions: {
      ...(options.reviewOptions ?? {})
    }
  };
}

function studyMoments(review, options) {
  const maxStudies = normalizeLimit(
    options.maxPositionStudies
      ?? options.maxStudies
      ?? options.positionStudyLimit
      ?? DEFAULT_MAX_POSITION_STUDIES
  );
  if (maxStudies <= 0) return [];

  const selectedPlies = normalizeSelectedPlies(options.positionStudyPlies ?? options.studyPlies);
  const moves = selectedPlies.length > 0
    ? selectedPlies
        .map((ply) => review.moves.find((move) => move.ply === ply))
        .filter(Boolean)
    : review.keyMoments
        .map((moment) => review.moves.find((move) => move.ply === moment.ply))
        .filter(Boolean);

  return uniqueMoves(moves).slice(0, maxStudies);
}

function positionStudyOptions(move, options) {
  const studyOptions = options.studyOptions ?? {};
  const includePlayedMoveReview = options.includePlayedMoveReview ?? studyOptions.includePlayedMoveReview ?? true;

  return {
    ...(options.depth !== undefined ? { depth: options.depth } : {}),
    ...(options.timeLimitMs !== undefined ? { timeLimitMs: options.timeLimitMs } : {}),
    ...(options.lines !== undefined ? { lines: options.lines } : {}),
    ...studyOptions,
    ...(includePlayedMoveReview ? { playedMove: move.notation } : {})
  };
}

function attachGameMoment(study, move) {
  return {
    ...study,
    gameMoment: {
      ply: move.ply,
      moveNumber: move.moveNumber,
      side: move.side,
      notation: move.notation,
      classification: move.review.classification,
      centipawnLoss: move.review.centipawnLoss,
      bestMove: move.review.bestMove?.notation ?? null,
      bestScore: Math.round(move.review.bestScore ?? 0),
      bestScoreDetail: scoreDetailFor(move.review.bestAnalysis),
      bestScoreText: scoreTextFor(move.review.bestAnalysis ?? { score: move.review.bestScore }),
      bestWdl: move.review.bestAnalysis?.wdl ?? null,
      bestComparison: comparisonFor(move.review),
      bestAlternatives: alternativesFor(move.review),
      bestLinePlan: bestLinePlanFor(move.review),
      book: move.book
    }
  };
}

function nextGameStudySteps(lessonPlan, positionStudies, review, practiceFocus) {
  const steps = [];
  const firstCard = lessonPlan.cards[0];
  if (firstCard) {
    steps.push({
      kind: "lesson",
      text: firstCard.prompt,
      ref: firstCard.id
    });
  }

  const firstStudy = positionStudies[0];
  if (firstStudy?.nextSteps?.[0]) {
    steps.push({
      kind: "position-study",
      text: firstStudy.nextSteps[0].text,
      ref: `ply-${firstStudy.gameMoment.ply}`
    });
  }
  if (practiceFocus?.[0]) {
    steps.push({
      kind: "practice",
      text: practiceFocus[0].text,
      focus: practiceFocus[0]
    });
  }

  const worstSide = worstSideByAverageLoss(review.summary.bySide);
  if (worstSide) {
    steps.push({
      kind: "side-focus",
      text: `${capitalize(worstSide.side)} averaged ${worstSide.averageCentipawnLoss} cp loss; review that side's decisions first.`
    });
  }

  return steps.slice(0, 4);
}

function uniqueMoves(moves) {
  const seen = new Set();
  const unique = [];
  for (const move of moves) {
    if (!move || seen.has(move.ply)) continue;
    seen.add(move.ply);
    unique.push(move);
  }
  return unique;
}

function normalizeSelectedPlies(value) {
  if (value === undefined || value === null) return [];
  const values = Array.isArray(value) ? value : String(value).split(",");
  return values
    .map((item) => Number.parseInt(item, 10))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function normalizeLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_MAX_POSITION_STUDIES;
  return Math.max(0, Math.min(12, parsed));
}

function worstSideByAverageLoss(bySide) {
  const sides = Object.entries(bySide ?? {})
    .map(([side, summary]) => ({
      side,
      averageCentipawnLoss: summary.averageCentipawnLoss ?? 0,
      moves: summary.moves ?? 0
    }))
    .filter((item) => item.moves > 0);
  if (sides.length === 0) return null;
  return sides.sort((a, b) => b.averageCentipawnLoss - a.averageCentipawnLoss)[0];
}

function capitalize(text) {
  return `${text.slice(0, 1).toUpperCase()}${text.slice(1)}`;
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

function bestLinePlanFor(review) {
  return summarizeLinePlanEvidence(review.bestExplanation?.linePlan ?? review.bestAnalysis?.explanation?.linePlan);
}

function formatCentipawns(value) {
  const rounded = Math.round(value ?? 0);
  return `${rounded >= 0 ? "+" : ""}${rounded} cp`;
}
