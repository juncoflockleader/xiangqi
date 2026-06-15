import { moveToNotation } from "./board.js";
import { ENGINE_BACKEND_FEATURES, createEngineBackend } from "./backend.js";
import { createLessonPlanWithBackend } from "./lesson.js";
import { createGameStudyWithBackend } from "./game-study.js";
import { reviewGameWithBackend } from "./review.js";
import { studyPositionWithBackend } from "./study.js";

export function createOracleReviewEngineBackend(candidateBackend, oracleBackend, options = {}) {
  validateCandidateBackend(candidateBackend);
  validateOracleBackend(oracleBackend);

  const id = options.id ?? `${candidateBackend.id ?? "candidate"}-with-${oracleBackend.id ?? "oracle"}-review`;
  const name = options.name ?? `${candidateBackend.name ?? "Candidate Engine"} with ${oracleBackend.name ?? "Oracle"} Review`;
  let backend;

  backend = createEngineBackend({
    id,
    name,
    kind: options.kind ?? "oracle-reviewed",
    description: options.description
      ?? `Uses ${candidateBackend.name ?? "the candidate engine"} for move choice and asks ${oracleBackend.name ?? "the oracle"} to grade the selected move.`,
    features: unique([
      ...(candidateBackend.features ?? []),
      ENGINE_BACKEND_FEATURES.ORACLE_REVIEW,
      ENGINE_BACKEND_FEATURES.ASYNC_SEARCH
    ]),
    chooseMove: async (position, searchOptions = {}) => {
      const {
        oracleReviewOptions,
        strictOracleReview,
        ...candidateSearchOptions
      } = searchOptions;
      const decision = await candidateBackend.chooseMove(position, candidateSearchOptions);

      return annotateDecisionWithOracleReview(position, decision, oracleBackend, {
        reviewOptions: {
          ...(options.oracleReviewOptions ?? {}),
          ...(options.reviewOptions ?? {}),
          ...(oracleReviewOptions ?? {})
        },
        strict: strictOracleReview ?? options.strictOracleReview ?? false
      });
    },
    analyzePosition: (...args) => candidateBackend.analyzePosition(...args),
    reviewMove: (position, move, reviewOptions = {}) => reviewMoveWithOracle(candidateBackend, oracleBackend, position, move, {
      defaults: {
        ...(options.oracleReviewOptions ?? {}),
        ...(options.reviewOptions ?? {})
      },
      reviewOptions,
      strict: reviewOptions.strictOracleReview ?? options.strictOracleReview ?? false,
      reviewWithOracle: reviewOptions.reviewWithOracle ?? options.reviewWithOracle ?? true
    }),
    reviewGame: (moves, gameOptions = {}) => reviewGameWithBackend(backend, moves, gameOptions),
    coachMove: (...args) => candidateBackend.coachMove?.(...args),
    studyPosition: (position, studyOptions = {}) => studyPositionWithBackend(backend, position, studyOptions),
    lessonPlan: (moves, lessonOptions = {}) => createLessonPlanWithBackend(backend, moves, lessonOptions),
    gameStudy: (moves, gameStudyOptions = {}) => createGameStudyWithBackend(backend, moves, gameStudyOptions),
    openingBook: (...args) => candidateBackend.openingBook(...args),
    evaluate: (...args) => candidateBackend.evaluate?.(...args),
    pressure: (...args) => candidateBackend.pressure?.(...args),
    play: (...args) => candidateBackend.play(...args),
    legalMoves: (...args) => candidateBackend.legalMoves(...args),
    resetCache: () => candidateBackend.resetCache?.(),
    ready: async () => {
      await candidateBackend.ready?.();
      await oracleBackend.ready?.();
    },
    close: async () => {
      await candidateBackend.close?.();
      await oracleBackend.close?.();
    },
    get candidateBackend() {
      return candidateBackend;
    },
    get oracleBackend() {
      return oracleBackend;
    },
    get cacheSize() {
      return typeof candidateBackend.cacheSize === "number" ? candidateBackend.cacheSize : null;
    },
    get cacheCapacity() {
      return typeof candidateBackend.cacheCapacity === "number" ? candidateBackend.cacheCapacity : null;
    }
  });

  return backend;
}

export async function annotateDecisionWithOracleReview(position, decision, oracleBackend, options = {}) {
  validateOracleBackend(oracleBackend);
  if (!decision || typeof decision !== "object" || !decision.bestMove) return decision;

  try {
    const review = await oracleBackend.reviewMove(position, decision.bestMove, {
      useBook: false,
      ...(options.reviewOptions ?? {})
    });
    const oracleReview = summarizeOracleReview(review, oracleBackend);
    return attachOracleReview(decision, oracleReview);
  } catch (error) {
    if (options.strict) throw error;
    return attachOracleReview(decision, unavailableOracleReview(error, oracleBackend));
  }
}

function attachOracleReview(decision, oracleReview) {
  const reason = oracleReview.verdict;
  const explanation = decision.explanation
    ? {
        ...decision.explanation,
        reasons: unique([reason, ...(decision.explanation.reasons ?? [])]).slice(0, 8),
        oracleReview
      }
    : decision.explanation;

  return {
    ...decision,
    oracleReview,
    explanation
  };
}

async function reviewMoveWithOracle(candidateBackend, oracleBackend, position, move, options) {
  const {
    oracleReviewOptions,
    strictOracleReview,
    reviewWithOracle,
    ...candidateReviewOptions
  } = options.reviewOptions ?? {};
  const strict = strictOracleReview ?? options.strict;

  if (reviewWithOracle === false || options.reviewWithOracle === false) {
    return candidateBackend.reviewMove(position, move, candidateReviewOptions);
  }

  const oracleOptions = {
    ...(options.defaults ?? {}),
    ...candidateReviewOptions,
    useBook: false,
    ...(oracleReviewOptions ?? {})
  };

  try {
    const review = await oracleBackend.reviewMove(position, move, oracleOptions);
    return annotateMoveReviewSource(review, oracleBackend);
  } catch (error) {
    if (strict) throw error;
    const fallbackReview = await candidateBackend.reviewMove(position, move, candidateReviewOptions);
    return annotateReviewFallback(fallbackReview, error, oracleBackend, candidateBackend);
  }
}

function annotateMoveReviewSource(review, oracleBackend) {
  const oracleReview = summarizeOracleReview(review, oracleBackend);
  return {
    ...review,
    reviewBackend: summarizeBackend(oracleBackend),
    oracleReview
  };
}

function annotateReviewFallback(review, error, oracleBackend, candidateBackend) {
  const oracleReview = unavailableOracleReview(error, oracleBackend);
  const reason = `${oracleBackend.name ?? "Oracle"} review was unavailable (${oracleReview.error}), so ${candidateBackend.name ?? "the candidate engine"} reviewed this move.`;
  return {
    ...review,
    reviewBackend: summarizeBackend(candidateBackend),
    oracleReview,
    explanation: review.explanation
      ? {
          ...review.explanation,
          reasons: unique([reason, ...(review.explanation.reasons ?? [])]).slice(0, 8)
        }
      : review.explanation
  };
}

function summarizeOracleReview(review, oracleBackend) {
  const move = notationFor(review.move);
  const bestMove = notationFor(review.bestMove);
  const centipawnLoss = Math.max(0, Math.round(review.centipawnLoss ?? 0));
  const classification = review.classification ?? (review.isBestMove ? "best" : "review");
  const isBestMove = Boolean(review.isBestMove || (move && bestMove && move === bestMove));
  const verdict = isBestMove
    ? `${oracleBackend.name ?? "Oracle"} agrees with ${move}; the oracle review classifies it as best.`
    : `${oracleBackend.name ?? "Oracle"} grades ${move} as ${classification}, ${centipawnLoss} cp behind ${bestMove}.`;

  return {
    status: "reviewed",
    backend: summarizeBackend(oracleBackend),
    source: review.source ?? oracleBackend.kind ?? "oracle",
    move,
    bestMove,
    isBestMove,
    exactMatch: isBestMove,
    classification,
    centipawnLoss,
    playedScore: roundOrNull(review.playedScore),
    playedScoreDetail: review.playedScoreDetail ?? null,
    playedWdl: review.playedWdl ?? null,
    bestScore: roundOrNull(review.bestScore),
    bestScoreDetail: review.bestAnalysis?.scoreDetail ?? null,
    bestWdl: review.bestAnalysis?.wdl ?? null,
    depth: review.depth ?? 0,
    nodes: review.nodes ?? 0,
    principalVariation: (review.principalVariation ?? []).map(notationFor).filter(Boolean),
    summary: review.explanation?.summary ?? verdict,
    reasons: [...(review.explanation?.reasons ?? [])],
    verdict,
    mistakes: review.mistakes ?? null
  };
}

function unavailableOracleReview(error, oracleBackend) {
  const message = errorMessage(error);
  return {
    status: "unavailable",
    backend: summarizeBackend(oracleBackend),
    source: oracleBackend.kind ?? "oracle",
    move: null,
    bestMove: null,
    isBestMove: false,
    exactMatch: false,
    classification: "unreviewed",
    centipawnLoss: null,
    playedScore: null,
    playedScoreDetail: null,
    playedWdl: null,
    bestScore: null,
    bestScoreDetail: null,
    bestWdl: null,
    depth: 0,
    nodes: 0,
    principalVariation: [],
    summary: `${oracleBackend.name ?? "Oracle"} review was unavailable: ${message}.`,
    reasons: [],
    verdict: `${oracleBackend.name ?? "Oracle"} review was unavailable (${message}).`,
    error: message,
    mistakes: null
  };
}

function validateCandidateBackend(backend) {
  for (const method of ["chooseMove", "analyzePosition", "reviewMove", "openingBook", "play", "legalMoves"]) {
    if (typeof backend?.[method] !== "function") {
      throw new Error(`Oracle-reviewed backend candidate is missing ${method}.`);
    }
  }
}

function validateOracleBackend(backend) {
  if (typeof backend?.reviewMove !== "function") {
    throw new Error("Oracle-reviewed backend requires an oracle with reviewMove.");
  }
}

function summarizeBackend(backend) {
  return {
    id: backend.id ?? "oracle",
    name: backend.name ?? "Oracle",
    kind: backend.kind ?? "oracle",
    features: [...(backend.features ?? [])]
  };
}

function notationFor(move) {
  if (!move) return null;
  if (typeof move === "string") return move;
  return move.notation ?? moveToNotation(move);
}

function roundOrNull(value) {
  return Number.isFinite(value) ? Math.round(value) : null;
}

function errorMessage(error) {
  return String(error?.message ?? error ?? "unknown error").split(/\r?\n/, 1)[0];
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}
