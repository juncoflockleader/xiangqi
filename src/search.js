import {
  DRAW_SCORE,
  INFINITY_SCORE,
  MATE_SCORE,
  PIECES,
  PIECE_VALUES
} from "./constants.js";
import {
  makeMove,
  fileOf,
  indexOf,
  moveKey,
  moveToNotation,
  opponent,
  parseMoveNotation,
  positionKey,
  rankOf,
  sameMove
} from "./board.js";
import { hashPosition } from "./hash.js";
import { createTranspositionTable } from "./transposition.js";
import { resolveSearchBudget } from "./time.js";
import {
  annotateMove,
  findKing,
  generateCaptures,
  generateLegalMoves,
  generatePseudoMoves,
  isInCheck
} from "./movegen.js";
import { evaluatePosition } from "./evaluate.js";
import {
  analyzeCapture,
  analyzeDiscoveredCheck,
  analyzeFork,
  analyzePins,
  analyzeSkewer,
  captureExchangeScore
} from "./tactics.js";

const EXACT = "exact";
const LOWER = "lower";
const UPPER = "upper";
const DEFAULT_MAX_EXTENSIONS = 4;
const DEFAULT_MAX_PLY = 80;
const DEFAULT_ASPIRATION_WINDOW = 45;
const DEFAULT_QCHECK_DEPTH = 1;
const DEFAULT_DELTA_MARGIN = 160;
const DEFAULT_QUIESCENCE_TABLE_ENTRIES = 16_384;
const FUTILITY_BASE_MARGIN = 90;
const FUTILITY_DEPTH_MARGIN = 70;
const REVERSE_FUTILITY_BASE_MARGIN = 100;
const REVERSE_FUTILITY_DEPTH_MARGIN = 80;
const REVERSE_FUTILITY_MAX_DEPTH = 3;
const RAZOR_BASE_MARGIN = 180;
const RAZOR_DEPTH_MARGIN = 120;
const NULL_MOVE_MIN_DEPTH = 3;
const NULL_MOVE_VERIFICATION_MIN_DEPTH = 5;
const TRANSPOSITION_MATE_BOUND = MATE_SCORE - 1000;
const DEFAULT_SOFT_TIME_FRACTION = 0.55;
const DEFAULT_SOFT_MIN_DEPTH = 2;
const DEFAULT_SOFT_STABLE_DEPTHS = 1;
const DEFAULT_SOFT_SCORE_GAP = 80;
const DEFAULT_SEE_PRUNE_MARGIN = 120;
const DEFAULT_PROBCUT_MARGIN = 170;
const DEFAULT_TACTICAL_MOVE_ORDERING_MAX_PLY = 0;
const PROBCUT_MIN_DEPTH = 4;
const PROBCUT_REDUCTION = 2;
const PROBCUT_CAPTURE_LIMIT = 6;
const IID_MIN_DEPTH = 4;
const IID_REDUCTION = 2;
const IID_MOVE_LIMIT = 8;
const LMR_MIN_DEPTH = 3;
const LMR_BASE_MOVE_INDEX = 4;
const LATE_MOVE_PRUNING_MAX_DEPTH = 3;
const LATE_MOVE_PRUNING_BASE = 4;
const LATE_MOVE_PRUNING_DEPTH_FACTOR = 3;
const SINGULAR_EXTENSION_MIN_DEPTH = 5;
const SINGULAR_EXTENSION_REDUCTION = 2;
const DEFAULT_SINGULAR_EXTENSION_MARGIN = 90;
const HISTORY_GRAVITY_LIMIT = 200_000;
const IMPROVING_EVAL_MARGIN = 12;
const HISTORY_PRUNING_MAX_DEPTH = 3;
const HISTORY_PRUNING_BASE_INDEX = 3;

export function searchBestMove(position, options = {}) {
  const depthLimit = options.depth ?? 4;
  const timeBudget = resolveSearchBudget(options, position.turn, {}, { position });
  const timeLimitMs = timeBudget.timeLimitMs;
  const softTimeLimitMs = resolveSoftTimeLimit(options, timeLimitMs);
  const startedAt = performanceNow();
  const deadline = startedAt + timeLimitMs;
  const softDeadline = startedAt + softTimeLimitMs;
  const table = options.transpositionTable ?? createTranspositionTable({
    maxEntries: options.maxTranspositionEntries ?? options.ttSize,
    replacementSample: options.transpositionReplacementSample
  });
  table.nextGeneration?.();
  const quiescenceTable = options.quiescenceTable ?? createTranspositionTable({
    maxEntries: options.maxQuiescenceTranspositionEntries
      ?? options.qttSize
      ?? DEFAULT_QUIESCENCE_TABLE_ENTRIES,
    replacementSample: options.quiescenceReplacementSample
      ?? options.transpositionReplacementSample
  });
  quiescenceTable.nextGeneration?.();
  const evaluationCache = options.evaluationCache ?? new Map();
  const history = new Map();
  const killers = new Map();
  const countermoves = new Map();
  const continuationHistory = new Map();
  const captureHistory = new Map();
  const checkHistory = new Map();
  const tacticalCache = options.tacticalCache ?? new Map();
  const candidateLimit = options.candidateLimit ?? 8;
  const exactRootScores = options.exactRootScores === true || !Number.isFinite(candidateLimit);
  const bannedMoveKeys = new Set((options.bannedMoves ?? []).map(moveKey));
  const priorityMoveKeys = new Set((options.priorityMoves ?? []).map(toMoveKey));
  const repetitionCounts = buildRepetitionCounts(options.history ?? options.positionHistory ?? []);
  const rootMoves = generateLegalMoves(position, position.turn)
    .filter((move) => !bannedMoveKeys.has(moveKey(move)));

  if (rootMoves.length === 0) {
    return {
      bestMove: null,
      score: -MATE_SCORE,
      depth: 0,
      nodes: 0,
      principalVariation: [],
      candidates: [],
      iterations: [],
      timedOut: false,
      tableSize: table.size,
      stats: createSearchStats(),
      timeBudget
    };
  }

  let bestMove = rootMoves[0];
  let bestScore = evaluatePosition(position, position.turn).score;
  let bestLine = [];
  let completedDepth = 0;
  let timedOut = false;
  let nodes = 0;
  let stats = createSearchStats();
  let candidates = [];
  let previousBest = null;
  let previousScore = null;
  let previousRootScores = new Map();
  let stopReason = null;
  const iterations = [];

  for (let depth = 1; depth <= depthLimit; depth += 1) {
    const context = {
      startedAt,
      deadline,
      table,
      quiescenceTable,
      evaluationCache,
      history,
      killers,
      countermoves,
      continuationHistory,
      captureHistory,
      checkHistory,
      staticEvalStack: [],
      candidateLimit,
      priorityMoveKeys,
      repetitionCounts: new Map(repetitionCounts),
      pathCounts: new Map(),
      maxExtensions: options.maxExtensions ?? DEFAULT_MAX_EXTENSIONS,
      maxPly: options.maxPly ?? DEFAULT_MAX_PLY,
      exactRootScores,
      rootMoveScores: previousRootScores,
      aspirationWindow: options.aspirationWindow ?? DEFAULT_ASPIRATION_WINDOW,
      qCheckDepth: options.qCheckDepth ?? DEFAULT_QCHECK_DEPTH,
      deltaMargin: options.deltaMargin ?? DEFAULT_DELTA_MARGIN,
      useAspiration: options.useAspiration !== false && !exactRootScores,
      useNullMove: options.useNullMove !== false,
      useNullMoveVerification: options.useNullMoveVerification !== false,
      usePvs: options.usePvs !== false,
      useKillerMoves: options.useKillerMoves !== false,
      useCountermoves: options.useCountermoves !== false,
      useContinuationHistory: options.useContinuationHistory !== false,
      useCheckHistory: options.useCheckHistory !== false,
      useCheckEvasionOrdering: options.useCheckEvasionOrdering !== false,
      useRootScoreOrdering: options.useRootScoreOrdering !== false,
      useMateDistancePruning: options.useMateDistancePruning !== false,
      useReverseFutilityPruning: options.useReverseFutilityPruning !== false,
      useRazoring: options.useRazoring !== false,
      useFutilityPruning: options.useFutilityPruning !== false,
      useDeltaPruning: options.useDeltaPruning !== false,
      useQuiescenceChecks: options.useQuiescenceChecks !== false,
      useQuiescenceTable: options.useQuiescenceTable !== false,
      useQuiescenceHashMoveOrdering: options.useQuiescenceHashMoveOrdering !== false,
      useTranspositionMoveOrdering: options.useTranspositionMoveOrdering !== false,
      useEvaluationCache: options.useEvaluationCache !== false,
      useTacticalCache: options.useTacticalCache !== false,
      useRecaptureExtensions: options.useRecaptureExtensions !== false,
      useSeePruning: options.useSeePruning !== false,
      useCaptureHistory: options.useCaptureHistory !== false,
      useHistoryMalus: options.useHistoryMalus !== false,
      useHistoryPruning: options.useHistoryPruning !== false,
      useLateMovePruning: options.useLateMovePruning !== false,
      useLateMoveReductions: options.useLateMoveReductions !== false,
      useAdaptiveLmr: options.useAdaptiveLmr !== false,
      useNodeTypeReductions: options.useNodeTypeReductions !== false,
      useImprovingHeuristics: options.useImprovingHeuristics !== false,
      useProbCut: options.useProbCut !== false,
      useInternalIterativeDeepening: options.useInternalIterativeDeepening !== false,
      useSingularExtensions: options.useSingularExtensions !== false,
      useTacticalMoveOrdering: options.useTacticalMoveOrdering !== false,
      tacticalMoveOrderingMaxPly: Math.max(0, Math.floor(numberOption(
        options.tacticalMoveOrderingMaxPly,
        DEFAULT_TACTICAL_MOVE_ORDERING_MAX_PLY
      ))),
      nullMoveVerificationMinDepth: Math.max(3, Math.floor(numberOption(options.nullMoveVerificationMinDepth, NULL_MOVE_VERIFICATION_MIN_DEPTH))),
      seePruneMargin: Math.max(0, numberOption(options.seePruneMargin, DEFAULT_SEE_PRUNE_MARGIN)),
      probCutMargin: Math.max(0, numberOption(options.probCutMargin, DEFAULT_PROBCUT_MARGIN)),
      reverseFutilityMaxDepth: Math.max(1, Math.floor(numberOption(options.reverseFutilityMaxDepth, REVERSE_FUTILITY_MAX_DEPTH))),
      reverseFutilityBaseMargin: Math.max(0, numberOption(options.reverseFutilityBaseMargin, REVERSE_FUTILITY_BASE_MARGIN)),
      reverseFutilityDepthMargin: Math.max(0, numberOption(options.reverseFutilityDepthMargin, REVERSE_FUTILITY_DEPTH_MARGIN)),
      lateMovePruningMaxDepth: Math.max(1, Math.floor(numberOption(options.lateMovePruningMaxDepth, LATE_MOVE_PRUNING_MAX_DEPTH))),
      lateMovePruningBase: Math.max(1, Math.floor(numberOption(options.lateMovePruningBase, LATE_MOVE_PRUNING_BASE))),
      lateMovePruningDepthFactor: Math.max(0, Math.floor(numberOption(options.lateMovePruningDepthFactor, LATE_MOVE_PRUNING_DEPTH_FACTOR))),
      iidMinDepth: Math.max(2, Math.floor(numberOption(options.iidMinDepth, IID_MIN_DEPTH))),
      iidReduction: Math.max(1, Math.floor(numberOption(options.iidReduction, IID_REDUCTION))),
      iidMoveLimit: Math.max(1, Math.floor(numberOption(options.iidMoveLimit, IID_MOVE_LIMIT))),
      iidActive: false,
      singularExtensionMinDepth: Math.max(3, Math.floor(numberOption(options.singularExtensionMinDepth, SINGULAR_EXTENSION_MIN_DEPTH))),
      singularExtensionReduction: Math.max(1, Math.floor(numberOption(options.singularExtensionReduction, SINGULAR_EXTENSION_REDUCTION))),
      singularExtensionMargin: Math.max(1, numberOption(options.singularExtensionMargin, DEFAULT_SINGULAR_EXTENSION_MARGIN)),
      singularActive: false,
      useSoftTimeManagement: options.useSoftTimeManagement !== false && !exactRootScores,
      softDeadline,
      softMinDepth: Math.max(1, Math.floor(numberOption(options.softMinDepth, DEFAULT_SOFT_MIN_DEPTH))),
      softStableDepths: Math.max(1, Math.floor(numberOption(options.softStableDepths, DEFAULT_SOFT_STABLE_DEPTHS))),
      softScoreGap: Math.max(0, numberOption(options.softScoreGap, DEFAULT_SOFT_SCORE_GAP)),
      tacticalCache,
      stats: createSearchStats(),
      nodes: 0,
      timedOut: false
    };

    const root = searchDepthRoot(position, depth, previousBest, previousScore, context, rootMoves);

    if (context.timedOut) {
      nodes += context.nodes;
      stats = mergeSearchStats(stats, context.stats);
      timedOut = true;
      stopReason = "timeout";
      break;
    }

    bestMove = root.bestMove;
    bestScore = root.score;
    bestLine = root.principalVariation;
    candidates = root.candidates;
    completedDepth = depth;
    const stableBestMove = previousBest ? sameMove(root.bestMove, previousBest) : null;
    const softStopReason = softStopReasonFor({
      depth,
      depthLimit,
      root,
      stableBestMove,
      previousIterations: iterations,
      context
    });
    if (softStopReason) {
      context.stats.softStops += 1;
      stopReason = softStopReason;
    }
    const iteration = createIterationRecord(position, depth, root, context, previousBest);
    iterations.push(iteration);
    previousBest = bestMove;
    previousScore = bestScore;
    previousRootScores = root.rootMoveScores;
    nodes += context.nodes;
    stats = mergeSearchStats(stats, context.stats);
    if (stopReason) break;
  }

  let fallback = null;
  if (completedDepth === 0) {
    fallback = staticRootFallback(position, rootMoves, candidateLimit);
    bestMove = fallback.bestMove;
    bestScore = fallback.score;
    bestLine = fallback.principalVariation;
    candidates = fallback.candidates;
    nodes += fallback.nodes;
    stats = mergeSearchStats(stats, fallback.stats);
  }

  return {
    bestMove: bestMove ? annotateMove(position, bestMove) : null,
    score: bestScore,
    depth: completedDepth,
    nodes,
    principalVariation: bestLine,
    candidates,
    iterations,
    timedOut,
    tableSize: table.size,
    stats,
    timeBudget,
    stopReason,
    softTimeLimitMs: Number.isFinite(softTimeLimitMs) ? softTimeLimitMs : null,
    fallback: fallback?.kind ?? null
  };
}

function searchDepthRoot(position, depth, previousBest, previousScore, context, rootMoves) {
  if (!shouldUseAspiration(depth, previousScore, context)) {
    return searchRoot(position, depth, previousBest, context, rootMoves, -INFINITY_SCORE, INFINITY_SCORE);
  }

  const window = context.aspirationWindow;
  let alpha = Math.max(-INFINITY_SCORE, previousScore - window);
  let beta = Math.min(INFINITY_SCORE, previousScore + window);
  context.stats.aspirationSearches += 1;

  let root = searchRoot(position, depth, previousBest, context, rootMoves, alpha, beta);

  if (!context.timedOut && root.score <= alpha) {
    context.stats.aspirationFailLow += 1;
    root = searchRoot(position, depth, previousBest, context, rootMoves, -INFINITY_SCORE, INFINITY_SCORE);
  } else if (!context.timedOut && root.score >= beta) {
    context.stats.aspirationFailHigh += 1;
    root = searchRoot(position, depth, previousBest, context, rootMoves, -INFINITY_SCORE, INFINITY_SCORE);
  }

  return root;
}

function searchRoot(position, depth, previousBest, context, rootMoves, alpha, beta) {
  let bestMove = null;
  let bestScore = -INFINITY_SCORE;
  let bestTieBreak = -INFINITY_SCORE;
  let bestLine = [];
  const candidates = [];
  const checkInfo = isInCheck(position, position.turn) ? checkEvasionInfo(position) : null;
  const moves = orderMoves(position, rootMoves, previousBest, context, 0, null, checkInfo);

  for (const move of moves) {
    if (isTimedOut(context)) {
      context.timedOut = true;
      break;
    }

    const next = makeMove(position, move);
    const repetition = rootRepetitionInfo(context, positionKey(next));
    const line = [];
    const childAlpha = context.exactRootScores ? -INFINITY_SCORE : -beta;
    const childBeta = context.exactRootScores ? INFINITY_SCORE : -alpha;
    context.stats.rootMovesSearched += 1;
    const score = normalizeScore(-negamax(next, depth - 1, childAlpha, childBeta, 1, context, line, context.maxExtensions, true, move));
    const annotated = annotateMove(position, move);
    const tieBreak = rootTieBreakScore(annotated);

    candidates.push({
      move: annotated,
      score,
      tieBreak,
      repetition,
      principalVariation: [annotated, ...line]
    });

    if (score > bestScore || (score === bestScore && tieBreak > bestTieBreak)) {
      bestScore = score;
      bestTieBreak = tieBreak;
      bestMove = move;
      bestLine = [annotated, ...line];
    }

    alpha = Math.max(alpha, score);
    if (!context.exactRootScores && alpha >= beta) {
      context.stats.cutoffs += 1;
      break;
    }
  }

  candidates.sort((a, b) => (b.score - a.score) || (b.tieBreak - a.tieBreak));

  return {
    bestMove: bestMove ?? moves[0],
    score: bestScore,
    principalVariation: bestLine,
    candidates: candidates.slice(0, context.candidateLimit),
    rootMoveScores: createRootMoveScoreMap(candidates)
  };
}

function rootTieBreakScore(move) {
  let score = 0;
  if (move.givesCheck) score += 1000;
  if (move.piece?.type !== PIECES.KING) score += 100;
  if (move.captured) score += 10;
  return score;
}

function shouldUseAspiration(depth, previousScore, context) {
  if (!context.useAspiration) return false;
  if (depth <= 1 || previousScore === null) return false;
  if (Math.abs(previousScore) >= MATE_SCORE - 1000) return false;
  return context.aspirationWindow > 0 && context.aspirationWindow < INFINITY_SCORE;
}

function resolveSoftTimeLimit(options, timeLimitMs) {
  if (options.useSoftTimeManagement === false) return Number.POSITIVE_INFINITY;

  const explicit = numberOption(options.softTimeLimitMs, options.softTimeMs);
  if (explicit !== null) return Math.max(0, Math.floor(explicit));

  const fraction = Math.max(0, numberOption(options.softTimeFraction, DEFAULT_SOFT_TIME_FRACTION));
  return Math.max(0, Math.floor(timeLimitMs * Math.min(1, fraction)));
}

function softStopReasonFor({ depth, depthLimit, root, stableBestMove, previousIterations, context }) {
  if (!context.useSoftTimeManagement) return null;
  if (depth >= depthLimit) return null;
  if (depth < context.softMinDepth) return null;
  if (performanceNow() < context.softDeadline) return null;

  if (Math.abs(root.score) >= MATE_SCORE - 1000) return "soft-time-forced-score";

  const gap = rootCandidateGap(root.candidates);
  if (gap !== null && gap >= context.softScoreGap) return "soft-time-candidate-gap";

  const stableDepths = stableBestMove ? 1 + trailingStableDepths(previousIterations) : 0;
  if (stableDepths >= context.softStableDepths) return "soft-time-stable-best";

  return null;
}

function trailingStableDepths(iterations) {
  let count = 0;
  for (let index = iterations.length - 1; index >= 0; index -= 1) {
    if (iterations[index].stableBestMove !== true) break;
    count += 1;
  }
  return count;
}

function rootCandidateGap(candidates) {
  if ((candidates?.length ?? 0) < 2) return null;
  return candidates[0].score - candidates[1].score;
}

function createIterationRecord(position, depth, root, context, previousBest) {
  return {
    depth,
    bestMove: root.bestMove ? annotateMove(position, root.bestMove) : null,
    score: root.score,
    nodes: context.nodes,
    principalVariation: root.principalVariation,
    candidates: root.candidates,
    stableBestMove: previousBest ? sameMove(root.bestMove, previousBest) : null,
    stats: { ...context.stats }
  };
}

function staticRootFallback(position, rootMoves, candidateLimit) {
  const candidates = rootMoves.map((move) => {
    const annotated = annotateMove(position, move);
    const next = makeMove(position, move);
    const score = evaluatePosition(next, position.turn, { detailed: false }).score;

    return {
      move: annotated,
      score,
      fallback: "static-root",
      principalVariation: [annotated]
    };
  }).sort((a, b) => b.score - a.score);
  const best = candidates[0] ?? null;
  const limitedCandidates = candidates.slice(0, candidateLimit);

  return {
    kind: "static-root",
    bestMove: best?.move ?? null,
    score: best?.score ?? evaluatePosition(position, position.turn).score,
    principalVariation: best?.principalVariation ?? [],
    candidates: limitedCandidates,
    nodes: rootMoves.length,
    stats: {
      ...createSearchStats(),
      nodes: rootMoves.length
    }
  };
}

function negamax(position, depth, alpha, beta, ply, context, lineOut, extensionsRemaining, allowNullMove, previousMove = null) {
  context.nodes += 1;
  context.stats.nodes += 1;
  if (isTimedOut(context)) {
    context.timedOut = true;
    return evaluateStatic(position, position.turn, context);
  }

  if (ply >= context.maxPly) {
    return evaluateStatic(position, position.turn, context);
  }

  const repetitionKey = positionKey(position);
  if (isRepetition(context, repetitionKey)) {
    context.stats.repetitions += 1;
    return DRAW_SCORE;
  }

  enterPosition(context, repetitionKey);

  const mateWindow = applyMateDistanceWindow(alpha, beta, ply, context);
  if (mateWindow.pruned) {
    leavePosition(context, repetitionKey);
    return mateWindow.score;
  }
  alpha = mateWindow.alpha;
  beta = mateWindow.beta;

  const alphaOriginal = alpha;
  const transpositionKey = hashPosition(position);
  const tt = context.table.get(transpositionKey);

  if (tt && tt.depth >= depth) {
    context.stats.ttHits += 1;
    const ttScore = scoreFromTransposition(tt.score, ply);
    if (tt.flag === EXACT) {
      if (lineOut && tt.bestMove) lineOut.splice(0, lineOut.length, annotateMove(position, tt.bestMove));
      leavePosition(context, repetitionKey);
      return ttScore;
    }
    if (tt.flag === LOWER) alpha = Math.max(alpha, ttScore);
    if (tt.flag === UPPER) beta = Math.min(beta, ttScore);
    if (alpha >= beta) {
      leavePosition(context, repetitionKey);
      return ttScore;
    }
  }

  const inCheck = isInCheck(position, position.turn);
  if (depth <= 0) {
    if (inCheck && extensionsRemaining > 0) {
      depth = 1;
      extensionsRemaining -= 1;
      context.stats.extensions += 1;
    } else {
      const score = quiescence(position, alpha, beta, ply, context, context.qCheckDepth);
      leavePosition(context, repetitionKey);
      return score;
    }
  }

  if (shouldTryNullMove(position, depth, beta, inCheck, context, allowNullMove)) {
    const reduction = nullMoveReduction(depth);
    const nullPosition = makeNullMove(position);
    const nullScore = normalizeScore(-negamax(
      nullPosition,
      depth - 1 - reduction,
      -beta,
      -beta + 1,
      ply + 1,
      context,
      null,
      extensionsRemaining,
      false,
      null
    ));

    if (context.timedOut) {
      leavePosition(context, repetitionKey);
      return nullScore;
    }

    if (nullScore >= beta) {
      if (shouldVerifyNullMoveCutoff(position, depth, context)) {
        const verificationScore = verifyNullMoveCutoff({
          position,
          depth,
          beta,
          ply,
          context,
          extensionsRemaining,
          previousMove,
          principalMove: context.useTranspositionMoveOrdering ? (tt?.bestMove ?? null) : null,
          reduction
        });

        if (context.timedOut) {
          leavePosition(context, repetitionKey);
          return verificationScore ?? nullScore;
        }

        if (verificationScore < beta) {
          context.stats.nullMoveVerificationFailures += 1;
        } else {
          context.stats.nullMovePrunes += 1;
          leavePosition(context, repetitionKey);
          return beta;
        }
      } else {
        context.stats.nullMovePrunes += 1;
        leavePosition(context, repetitionKey);
        return beta;
      }
    }
  }

  const legalMoves = generateLegalMoves(position, position.turn);

  if (legalMoves.length === 0) {
    leavePosition(context, repetitionKey);
    return inCheck ? -MATE_SCORE + ply : -MATE_SCORE + ply;
  }

  const staticScore = inCheck ? null : evaluateStatic(position, position.turn, context);
  const staticTrend = staticEvalTrend(context, ply, staticScore);
  if (shouldPruneReverseFutility({ depth, inCheck, alpha, beta, staticScore, staticTrend, context })) {
    context.stats.reverseFutilityPrunes += 1;
    leavePosition(context, repetitionKey);
    return beta;
  }

  let bestScore = -INFINITY_SCORE;
  let bestMove = null;
  let bestChildLine = [];
  const ttBestMove = tt?.bestMove ?? null;
  const ttOrderingMove = context.useTranspositionMoveOrdering ? ttBestMove : null;
  let principalMove = ttOrderingMove;
  if (!principalMove) {
    principalMove = internalIterativeDeepeningMoveHint({
      position,
      legalMoves,
      depth,
      alpha,
      beta,
      ply,
      context,
      extensionsRemaining,
      previousMove,
      inCheck
    });
    if (context.timedOut) {
      leavePosition(context, repetitionKey);
      return evaluateStatic(position, position.turn, context);
    }
  }
  const checkInfo = inCheck ? checkEvasionInfo(position) : null;
  if (ttOrderingMove && legalMoves.some((move) => sameMove(move, ttOrderingMove))) {
    context.stats.ttMoveHits += 1;
  }
  const ordered = orderMoves(position, legalMoves, principalMove, context, ply, previousMove, checkInfo);
  const searchedQuietMoves = [];
  const searchedQuietChecks = [];
  const searchedCaptures = [];

  if (shouldRazor({ depth, inCheck, alpha, beta, staticScore, context })) {
    const razorScore = quiescence(position, alpha, beta, ply, context, context.qCheckDepth);
    if (context.timedOut) {
      leavePosition(context, repetitionKey);
      return razorScore;
    }
    if (razorScore <= alpha) {
      context.stats.razorPrunes += 1;
      leavePosition(context, repetitionKey);
      return razorScore;
    }
    context.stats.razorResearches += 1;
  }

  const probCutScore = tryProbCut({
    position,
    depth,
    alpha,
    beta,
    ply,
    context,
    extensionsRemaining,
    previousMove,
    inCheck
  });
  if (context.timedOut) {
    leavePosition(context, repetitionKey);
    return probCutScore ?? evaluateStatic(position, position.turn, context);
  }
  if (probCutScore !== null) {
    leavePosition(context, repetitionKey);
    return probCutScore;
  }

  for (let index = 0; index < ordered.length; index += 1) {
    const move = ordered[index];
    const next = makeMove(position, move);
    let childLine = [];
    const givesCheck = isInCheck(next, next.turn);
    const singularReason = singularExtensionReasonFor({
      position,
      orderedMoves: ordered,
      move,
      depth,
      ply,
      context,
      extensionsRemaining,
      tt,
      ttPrincipalMove: ttBestMove,
      inCheck,
      previousMove
    });
    const extensionReason = singularReason ?? extensionReasonFor({
      inCheck,
      givesCheck,
      move,
      previousMove,
      extensionsRemaining,
      context
    });
    const extension = extensionReason ? 1 : 0;
    const childExtensions = extensionsRemaining - extension;
    if (extension > 0) {
      context.stats.extensions += 1;
      if (extensionReason === "recapture") context.stats.recaptureExtensions += 1;
    }

    if (shouldPruneSee({
      depth,
      index,
      move,
      inCheck,
      givesCheck,
      extension,
      alpha,
      beta,
      context,
      position
    })) {
      context.stats.seePrunes += 1;
      continue;
    }

    if (shouldPruneFutility({
      depth,
      index,
      move,
      inCheck,
      givesCheck,
      extension,
      alpha,
      beta,
      staticScore,
      staticTrend,
      context
    })) {
      context.stats.futilityPrunes += 1;
      continue;
    }

    if (shouldPruneBadHistory({
      depth,
      index,
      move,
      inCheck,
      givesCheck,
      extension,
      alpha,
      beta,
      context,
      ply,
      previousMove,
      staticTrend
    })) {
      context.stats.badHistoryPrunes += 1;
      continue;
    }

    if (shouldPruneLateMove({
      depth,
      index,
      move,
      inCheck,
      givesCheck,
      extension,
      alpha,
      beta,
      context,
      ply,
      previousMove,
      staticTrend
    })) {
      context.stats.lateMovePrunes += 1;
      continue;
    }

    let reduction = lateMoveReduction({
      depth,
      index,
      move,
      inCheck,
      givesCheck,
      extension,
      context,
      ply,
      previousMove,
      alpha,
      beta,
      staticTrend
    });
    if (reduction > 0) {
      context.stats.reductions += 1;
      context.stats.reductionPlies += reduction;
      if (reduction > 1) context.stats.deepReductions += 1;
    }

    let childDepth = depth - 1 + extension - reduction;
    let score;

    if (index > 0 && context.usePvs) {
      score = normalizeScore(-negamax(
        next,
        childDepth,
        -alpha - 1,
        -alpha,
        ply + 1,
        context,
        childLine,
        childExtensions,
        true,
        move
      ));
    } else {
      score = normalizeScore(-negamax(
        next,
        childDepth,
        -beta,
        -alpha,
        ply + 1,
        context,
        childLine,
        childExtensions,
        true,
        move
      ));
    }

    if (reduction > 0 && score > alpha && !context.timedOut) {
      context.stats.lmrResearches += 1;
      childDepth = depth - 1 + extension;
      childLine = [];
      score = normalizeScore(-negamax(
        next,
        childDepth,
        context.usePvs && index > 0 ? -alpha - 1 : -beta,
        -alpha,
        ply + 1,
        context,
        childLine,
        childExtensions,
        true,
        move
      ));
    }

    if (index > 0 && context.usePvs && score > alpha && score < beta && !context.timedOut) {
      context.stats.pvsResearches += 1;
      childLine = [];
      score = normalizeScore(-negamax(
        next,
        depth - 1 + extension,
        -beta,
        -alpha,
        ply + 1,
        context,
        childLine,
        childExtensions,
        true,
        move
      ));
    }

    if (context.timedOut) {
      leavePosition(context, repetitionKey);
      return score;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
      bestChildLine = [annotateMove(position, move), ...childLine];
    }

    alpha = Math.max(alpha, score);

    if (alpha >= beta) {
      context.stats.cutoffs += 1;
      if (move.captured) {
        penalizeFailedCaptures(context, searchedCaptures, depth * depth * 16);
        bumpCaptureHistory(context, move, depth * depth * 16);
      } else {
        penalizeFailedQuietChecks(context, searchedQuietChecks, depth * depth * 8);
        penalizeFailedQuietMoves(context, searchedQuietMoves, depth * depth, previousMove);
        rememberKiller(context, ply, move);
        rememberCountermove(context, previousMove, move);
        if (givesCheck) bumpCheckHistory(context, move, depth * depth * 8);
        bumpHistory(context, move, depth * depth);
        bumpContinuationHistory(context, previousMove, move, depth * depth);
      }
      break;
    }

    if (move.captured) {
      searchedCaptures.push(move);
    } else {
      searchedQuietMoves.push(move);
      if (givesCheck) searchedQuietChecks.push(move);
    }
  }

  const flag = bestScore <= alphaOriginal ? UPPER : bestScore >= beta ? LOWER : EXACT;
  storeTransposition(context, transpositionKey, {
    depth,
    score: scoreToTransposition(bestScore, ply),
    flag,
    bestMove
  });

  if (lineOut) lineOut.splice(0, lineOut.length, ...bestChildLine);
  leavePosition(context, repetitionKey);
  return bestScore;
}

function quiescence(position, alpha, beta, ply, context, qChecksRemaining) {
  context.nodes += 1;
  context.stats.nodes += 1;
  context.stats.qnodes += 1;

  if (isTimedOut(context)) {
    context.timedOut = true;
    return evaluateStatic(position, position.turn, context);
  }

  if (ply >= context.maxPly) {
    return evaluateStatic(position, position.turn, context);
  }

  const mateWindow = applyMateDistanceWindow(alpha, beta, ply, context);
  if (mateWindow.pruned) return mateWindow.score;
  alpha = mateWindow.alpha;
  beta = mateWindow.beta;

  const inCheck = isInCheck(position, position.turn);
  const alphaOriginal = alpha;
  const transpositionKey = quiescenceTranspositionKey(position, qChecksRemaining);
  const tt = probeQuiescenceTransposition(context, transpositionKey, alpha, beta, ply);
  if (tt.hit) return tt.score;
  const hashMove = context.useQuiescenceHashMoveOrdering ? tt.bestMove : null;

  let moves;
  let bestScore = -INFINITY_SCORE;
  let bestMove = null;

  if (inCheck) {
    const checkInfo = checkEvasionInfo(position);
    moves = orderQuiescenceMoves(
      position,
      generateLegalMoves(position, position.turn),
      hashMove,
      context,
      ply,
      null,
      checkInfo
    );
    if (moves.length === 0) {
      const mateScore = -MATE_SCORE + ply;
      storeQuiescenceTransposition(context, transpositionKey, {
        score: scoreToTransposition(mateScore, ply),
        flag: EXACT,
        depth: qChecksRemaining,
        bestMove: null
      });
      return mateScore;
    }
  } else {
    const standPat = evaluateStatic(position, position.turn, context);
    bestScore = standPat;

    if (standPat >= beta) {
      context.stats.cutoffs += 1;
      storeQuiescenceTransposition(context, transpositionKey, {
        score: scoreToTransposition(standPat, ply),
        flag: LOWER,
        depth: qChecksRemaining,
        bestMove: null
      });
      return beta;
    }
    if (standPat > alpha) alpha = standPat;

    const tacticalMoves = [];
    for (const move of generateCaptures(position)) {
      if (!isGoodCapture(position, move, context)) continue;
      if (shouldPruneDelta({ position, move, standPat, alpha, context })) {
        context.stats.deltaPrunes += 1;
        continue;
      }
      tacticalMoves.push(move);
    }
    tacticalMoves.push(...quietCheckingMoves(position, context, qChecksRemaining));
    moves = orderQuiescenceMoves(position, tacticalMoves, hashMove, context, ply);
  }

  for (const move of moves) {
    if (isTimedOut(context)) {
      context.timedOut = true;
      break;
    }

    const next = makeMove(position, move);
    const nextQChecks = move.captured ? qChecksRemaining : Math.max(0, qChecksRemaining - 1);
    const score = normalizeScore(-quiescence(next, -beta, -alpha, ply + 1, context, nextQChecks));
    if (context.timedOut) return score;
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    if (score >= beta) {
      context.stats.cutoffs += 1;
      storeQuiescenceTransposition(context, transpositionKey, {
        score: scoreToTransposition(score, ply),
        flag: LOWER,
        depth: qChecksRemaining,
        bestMove: move
      });
      return beta;
    }
    if (score > alpha) alpha = score;
  }

  if (context.timedOut) return alpha;

  storeQuiescenceTransposition(context, transpositionKey, {
    score: scoreToTransposition(bestScore, ply),
    flag: bestScore <= alphaOriginal ? UPPER : EXACT,
    depth: qChecksRemaining,
    bestMove
  });
  return alpha;
}

function probeQuiescenceTransposition(context, key, alpha, beta, ply) {
  if (!context.useQuiescenceTable) return { hit: false, score: null, bestMove: null };

  const tt = context.quiescenceTable.get(key);
  if (!tt) return { hit: false, score: null, bestMove: null };

  const ttScore = scoreFromTransposition(tt.score, ply);
  if (tt.flag === EXACT) {
    context.stats.qttHits += 1;
    return { hit: true, score: ttScore, bestMove: tt.bestMove ?? null };
  }
  if (tt.flag === LOWER && ttScore >= beta) {
    context.stats.qttHits += 1;
    return { hit: true, score: ttScore, bestMove: tt.bestMove ?? null };
  }
  if (tt.flag === UPPER && ttScore <= alpha) {
    context.stats.qttHits += 1;
    return { hit: true, score: ttScore, bestMove: tt.bestMove ?? null };
  }
  return { hit: false, score: null, bestMove: tt.bestMove ?? null };
}

function storeQuiescenceTransposition(context, key, entry) {
  if (!context.useQuiescenceTable) return;
  const result = context.quiescenceTable.set(key, entry);

  if (!result || typeof result !== "object" || !("stored" in result)) {
    context.stats.qttStores += 1;
    return;
  }

  if (result.stored) context.stats.qttStores += 1;
  if (result.replaced) context.stats.qttReplacements += 1;
  if (result.evicted) context.stats.qttEvictions += 1;
  if (!result.stored) context.stats.qttSkips += 1;
}

function quiescenceTranspositionKey(position, qChecksRemaining) {
  return `${hashPosition(position)}:q:${qChecksRemaining}`;
}

function quietCheckingMoves(position, context, qChecksRemaining) {
  if (!context.useQuiescenceChecks || qChecksRemaining <= 0) return [];

  const checks = generateLegalMoves(position, position.turn)
    .filter((move) => !move.captured && givesCheck(position, move));

  context.stats.qchecks += checks.length;
  return checks;
}

function givesCheck(position, move) {
  const next = makeMove(position, move);
  return isInCheck(next, next.turn);
}

function orderMoves(position, moves, principalMove, context, ply, previousMove = null, checkInfo = null) {
  return moves
    .map((move) => ({
      move,
      score: moveOrderingScore(position, move, principalMove, context, ply, previousMove, checkInfo)
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.move);
}

function orderQuiescenceMoves(position, moves, hashMove, context, ply, previousMove = null, checkInfo = null) {
  const principalMove = context.useQuiescenceHashMoveOrdering ? hashMove : null;
  if (principalMove && moves.some((move) => sameMove(move, principalMove))) {
    context.stats.qttMoveHits += 1;
  }
  return orderMoves(position, moves, principalMove, context, ply, previousMove, checkInfo);
}

function moveOrderingScore(position, move, principalMove, context, ply, previousMove, checkInfo = null) {
  let score = 0;

  if (context.priorityMoveKeys?.has(moveKey(move))) score += 1_500_000;
  if (sameMove(move, principalMove)) score += 1_000_000;
  score += checkEvasionOrderingScore(move, checkInfo, context);
  score += rootMoveOrderingScore(context, move, ply);
  if (isCountermove(context, previousMove, move)) score += 30_000;
  score += continuationHistoryScore(context, previousMove, move);
  if (move.captured) {
    const capture = getCaptureAnalysis(position, move, context);
    score += 100_000 + (PIECE_VALUES[move.captured.type] * 10 - PIECE_VALUES[move.piece.type]);
    score += capture.exchangeScore * 12;
    score += capture.isSafe ? 8_000 : -12_000;
    score += captureHistoryScore(context, move);
  }

  const next = makeMove(position, move);
  if (isInCheck(next, opponent(position.turn))) {
    score += 40_000;
    score += checkHistoryScore(context, move);
  }

  if (!move.captured && ply <= context.tacticalMoveOrderingMaxPly) {
    score += tacticalMoveOrderingScore(position, move, context);
  }

  if (killerMoveHit(context, ply, move)) score += 25_000;
  score += context.history.get(moveKey(move)) ?? 0;

  return score;
}

function checkEvasionOrderingScore(move, checkInfo, context) {
  if (!context.useCheckEvasionOrdering || !checkInfo) return 0;

  let score = 0;
  let ordered = false;

  if (checkInfo.attackerSquares.has(move.to)) {
    score += 130_000 + (move.captured ? PIECE_VALUES[move.captured.type] * 16 : 0);
    context.stats.checkEvasionCaptures += 1;
    ordered = true;
  }

  if (move.piece.type === PIECES.KING) {
    score += 100_000;
    context.stats.checkEvasionKingMoves += 1;
    ordered = true;
  }

  if (move.piece.type !== PIECES.KING && checkInfo.blockSquares.has(move.to)) {
    score += 80_000;
    context.stats.checkEvasionBlocks += 1;
    ordered = true;
  }

  if (ordered) context.stats.checkEvasionOrderHits += 1;
  return score;
}

function checkEvasionInfo(position) {
  const side = position.turn;
  const kingSquare = findKing(position, side);
  if (kingSquare === -1) {
    return {
      kingSquare,
      attackerSquares: new Set(),
      blockSquares: new Set()
    };
  }

  const enemy = opponent(side);
  const attacks = generatePseudoMoves(position, enemy)
    .filter((move) => move.to === kingSquare);
  const flyingGeneralSquare = flyingGeneralAttackerSquare(position, side, kingSquare);
  if (flyingGeneralSquare !== null) {
    attacks.push({
      from: flyingGeneralSquare,
      to: kingSquare,
      piece: position.board[flyingGeneralSquare]
    });
  }

  const attackerSquares = new Set();
  const blockSquares = new Set();

  for (const attack of attacks) {
    attackerSquares.add(attack.from);
    for (const square of checkBlockSquares(position, attack, kingSquare)) {
      blockSquares.add(square);
    }
  }

  return {
    kingSquare,
    attackerSquares,
    blockSquares
  };
}

function flyingGeneralAttackerSquare(position, side, kingSquare) {
  const enemyKing = findKing(position, opponent(side));
  if (enemyKing === -1 || fileOf(enemyKing) !== fileOf(kingSquare)) return null;
  return squaresBetween(enemyKing, kingSquare).every((square) => !position.board[square])
    ? enemyKing
    : null;
}

function checkBlockSquares(position, attack, kingSquare) {
  if (!attack?.piece) return [];

  if (
    attack.piece.type === PIECES.ROOK
    || attack.piece.type === PIECES.CANNON
    || attack.piece.type === PIECES.KING
  ) {
    return lineAligned(attack.from, kingSquare) ? squaresBetween(attack.from, kingSquare) : [];
  }

  if (attack.piece.type === PIECES.HORSE) {
    const leg = horseLegSquare(attack.from, kingSquare);
    return leg === null || position.board[leg] ? [] : [leg];
  }

  return [];
}

function lineAligned(first, second) {
  return fileOf(first) === fileOf(second) || rankOf(first) === rankOf(second);
}

function squaresBetween(first, second) {
  const firstFile = fileOf(first);
  const firstRank = rankOf(first);
  const secondFile = fileOf(second);
  const secondRank = rankOf(second);
  const fileStep = Math.sign(secondFile - firstFile);
  const rankStep = Math.sign(secondRank - firstRank);

  if (firstFile !== secondFile && firstRank !== secondRank) return [];

  const squares = [];
  let file = firstFile + fileStep;
  let rank = firstRank + rankStep;

  while (file !== secondFile || rank !== secondRank) {
    squares.push(indexOf(file, rank));
    file += fileStep;
    rank += rankStep;
  }

  return squares;
}

function horseLegSquare(from, to) {
  const dx = fileOf(to) - fileOf(from);
  const dy = rankOf(to) - rankOf(from);
  if (!((Math.abs(dx) === 1 && Math.abs(dy) === 2) || (Math.abs(dx) === 2 && Math.abs(dy) === 1))) {
    return null;
  }

  const legFile = Math.abs(dx) === 2 ? fileOf(from) + Math.sign(dx) : fileOf(from);
  const legRank = Math.abs(dy) === 2 ? rankOf(from) + Math.sign(dy) : rankOf(from);
  return indexOf(legFile, legRank);
}

function isGoodCapture(position, move, context) {
  if (!move.captured) return false;
  const exchangeScore = context
    ? getCaptureAnalysis(position, move, context).exchangeScore
    : captureExchangeScore(position, move);
  return exchangeScore >= -40 || PIECE_VALUES[move.captured.type] >= PIECE_VALUES[move.piece.type] * 0.55;
}

function getCaptureAnalysis(position, move, context) {
  if (!context?.useTacticalCache) return analyzeCapture(position, move);

  const key = `${hashPosition(position)}:${moveKey(move)}`;
  if (context.tacticalCache.has(key)) {
    context.stats.tacticalCacheHits += 1;
    return context.tacticalCache.get(key);
  }

  const analysis = analyzeCapture(position, move);
  context.tacticalCache.set(key, analysis);
  context.stats.tacticalCacheStores += 1;
  return analysis;
}

function tacticalMoveOrderingScore(position, move, context) {
  if (!context?.useTacticalMoveOrdering) return 0;

  const compute = () => computeTacticalMoveOrderingScore(position, move);
  const score = context.useTacticalCache
    ? cachedTacticalMoveOrderingScore(position, move, context, compute)
    : compute();

  if (score > 0) context.stats.tacticalMoveOrderHits += 1;
  return score;
}

function cachedTacticalMoveOrderingScore(position, move, context, compute) {
  const key = `order:${hashPosition(position)}:${moveKey(move)}`;
  if (context.tacticalCache.has(key)) {
    context.stats.tacticalMoveOrderCacheHits += 1;
    return context.tacticalCache.get(key);
  }

  const score = compute();
  context.tacticalCache.set(key, score);
  context.stats.tacticalMoveOrderCacheStores += 1;
  return score;
}

function computeTacticalMoveOrderingScore(position, move) {
  let score = 0;

  const discoveredCheck = analyzeDiscoveredCheck(position, move);
  if (discoveredCheck) {
    score += 32_000 + Math.min(12_000, discoveredCheck.score * 4);
  }

  const skewer = analyzeSkewer(position, move);
  if (skewer) {
    score += 28_000 + Math.min(12_000, skewer.score * 4);
  }

  const fork = analyzeFork(position, move);
  if (fork) {
    score += 24_000 + Math.min(12_000, fork.score * 5);
  }

  const pins = analyzePins(position, move);
  if (pins) {
    score += 18_000 + Math.min(10_000, pins.score * 6);
  }

  return score;
}

function evaluateStatic(position, perspective, context) {
  if (!context?.useEvaluationCache) {
    return evaluatePosition(position, perspective).score;
  }

  const key = `${hashPosition(position)}:${perspective}`;
  const cached = context.evaluationCache.get(key);
  if (cached !== undefined) {
    context.stats.evalCacheHits += 1;
    return cached;
  }

  const score = evaluatePosition(position, perspective).score;
  context.evaluationCache.set(key, score);
  context.stats.evalCacheStores += 1;
  return score;
}

function toMoveKey(move) {
  return moveKey(typeof move === "string" ? parseMoveNotation(move) : move);
}

function createRootMoveScoreMap(candidates) {
  return new Map(candidates.map((candidate, rank) => [
    moveKey(candidate.move),
    { score: candidate.score, rank }
  ]));
}

function clampOrderingScore(score) {
  return Math.max(-200_000, Math.min(200_000, Math.round(score)));
}

function rootMoveOrderingScore(context, move, ply) {
  if (ply !== 0 || !context.useRootScoreOrdering) return 0;

  const entry = context.rootMoveScores?.get(moveKey(move));
  if (entry === undefined) return 0;

  const score = typeof entry === "number" ? entry : entry.score;
  let bonus = 500_000 + clampOrderingScore(score);
  context.stats.rootScoreOrderHits += 1;

  if (typeof entry === "object" && Number.isFinite(entry.rank)) {
    bonus += rootRankOrderingBonus(entry.rank);
    context.stats.rootRankOrderHits += 1;
  }

  return bonus;
}

function rootRankOrderingBonus(rank) {
  return Math.max(0, 160_000 - rank * 20_000);
}

function extensionReasonFor({ inCheck, givesCheck, move, previousMove, extensionsRemaining, context }) {
  if (extensionsRemaining <= 0) return null;
  if (inCheck) return "in-check";
  if (givesCheck) return "check";
  if (isRecapture(move, previousMove, context)) return "recapture";
  if (move.captured && PIECE_VALUES[move.captured.type] >= PIECE_VALUES[move.piece.type] * 2) return "winning-capture";
  return null;
}

function singularExtensionReasonFor({
  position,
  orderedMoves,
  move,
  depth,
  ply,
  context,
  extensionsRemaining,
  tt,
  ttPrincipalMove,
  inCheck,
  previousMove
}) {
  if (!shouldTrySingularExtension({
    orderedMoves,
    move,
    depth,
    context,
    extensionsRemaining,
    tt,
    ttPrincipalMove,
    inCheck
  })) {
    return null;
  }

  const ttScore = scoreFromTransposition(tt.score, ply);
  const singularBeta = Math.max(-INFINITY_SCORE + 1, ttScore - singularExtensionMargin(depth, context));
  const childDepth = Math.max(0, depth - 1 - context.singularExtensionReduction);
  const previousSingularActive = context.singularActive;
  let alternativeScore = -INFINITY_SCORE;

  context.singularActive = true;
  context.stats.singularExtensionSearches += 1;

  try {
    alternativeScore = searchExcludedMoveBestScore({
      position,
      moves: orderedMoves,
      excludedMove: move,
      threshold: singularBeta,
      childDepth,
      ply,
      context,
      extensionsRemaining,
      previousMove
    });
  } finally {
    context.singularActive = previousSingularActive;
  }

  if (context.timedOut) return null;
  if (alternativeScore < singularBeta) {
    context.stats.singularExtensions += 1;
    return "singular";
  }

  context.stats.singularExtensionRejects += 1;
  return null;
}

function shouldTrySingularExtension({
  orderedMoves,
  move,
  depth,
  context,
  extensionsRemaining,
  tt,
  ttPrincipalMove,
  inCheck
}) {
  if (!context.useSingularExtensions) return false;
  if (context.singularActive) return false;
  if (extensionsRemaining <= 0) return false;
  if (inCheck) return false;
  if (depth < context.singularExtensionMinDepth) return false;
  if ((orderedMoves?.length ?? 0) < 2) return false;
  if (!tt || !ttPrincipalMove || !sameMove(move, ttPrincipalMove)) return false;
  if (tt.flag === UPPER) return false;
  if ((tt.depth ?? 0) < depth - 2) return false;
  if (Math.abs(scoreFromTransposition(tt.score, 0)) >= MATE_SCORE - 1000) return false;
  return true;
}

function searchExcludedMoveBestScore({
  position,
  moves,
  excludedMove,
  threshold,
  childDepth,
  ply,
  context,
  extensionsRemaining,
  previousMove
}) {
  let bestScore = -INFINITY_SCORE;

  for (const move of moves) {
    if (sameMove(move, excludedMove)) continue;
    if (isTimedOut(context)) {
      context.timedOut = true;
      break;
    }

    const next = makeMove(position, move);
    const score = normalizeScore(-negamax(
      next,
      childDepth,
      -threshold,
      -threshold + 1,
      ply + 1,
      context,
      null,
      extensionsRemaining,
      false,
      move
    ));

    if (context.timedOut) break;
    if (score > bestScore) bestScore = score;
    if (score >= threshold) break;
  }

  return bestScore;
}

function singularExtensionMargin(depth, context) {
  return context.singularExtensionMargin + depth * 4;
}

function isRecapture(move, previousMove, context) {
  if (!context.useRecaptureExtensions) return false;
  return Boolean(
    move.captured
    && previousMove?.captured
    && move.to === previousMove.to
  );
}

function staticEvalTrend(context, ply, staticScore) {
  if (!context.useImprovingHeuristics) return { state: "disabled", delta: null };

  if (staticScore === null || !Number.isFinite(staticScore)) {
    context.staticEvalStack[ply] = null;
    return { state: "unknown", delta: null };
  }

  const previousStaticScore = context.staticEvalStack[ply - 2];
  context.staticEvalStack[ply] = staticScore;

  if (!Number.isFinite(previousStaticScore)) {
    return { state: "unknown", delta: null };
  }

  const delta = staticScore - previousStaticScore;
  if (delta > IMPROVING_EVAL_MARGIN) {
    context.stats.improvingNodes += 1;
    return { state: "improving", delta };
  }
  if (delta < -IMPROVING_EVAL_MARGIN) {
    context.stats.nonImprovingNodes += 1;
    return { state: "worsening", delta };
  }

  context.stats.stableEvalTrendNodes += 1;
  return { state: "stable", delta };
}

function isImprovingTrend(staticTrend) {
  return staticTrend?.state === "improving";
}

function isWorseningTrend(staticTrend) {
  return staticTrend?.state === "worsening";
}

function lateMoveReduction({
  depth,
  index,
  move,
  inCheck,
  givesCheck,
  extension,
  context,
  ply,
  previousMove,
  alpha,
  beta,
  staticTrend
}) {
  if (!context.useLateMoveReductions) return 0;
  if (depth < LMR_MIN_DEPTH) return 0;
  if (index < LMR_BASE_MOVE_INDEX) return 0;
  if (inCheck || givesCheck || extension > 0) return 0;
  if (move.captured) return 0;

  if (!context.useAdaptiveLmr) return 1;

  let reduction = 1;
  if (depth >= 5 && index >= 8) reduction += 1;
  if (depth >= 7 && index >= 14) reduction += 1;

  const historyScore = context.history.get(moveKey(move)) ?? 0;
  if (historyScore > depth * depth) reduction -= 1;
  if (historyScore < -depth * depth) reduction += 1;
  const continuationScore = continuationHistoryValue(context, previousMove, move);
  if (continuationScore > depth * depth) {
    reduction -= 1;
    context.stats.continuationReductionBoosts += 1;
  }
  if (continuationScore < -depth * depth) {
    reduction += 1;
    context.stats.continuationReductionMaluses += 1;
  }
  if (isStoredKiller(context, ply, move)) reduction -= 1;
  if (isStoredCountermove(context, previousMove, move)) reduction -= 1;

  if (context.useNodeTypeReductions) {
    if (beta - alpha > 1 && reduction > 0) {
      reduction -= 1;
      context.stats.pvReductionGuards += 1;
    } else if (beta - alpha === 1 && depth >= 4 && index >= LMR_BASE_MOVE_INDEX + 4 && !isImprovingTrend(staticTrend)) {
      reduction += 1;
      context.stats.cutNodeReductionBoosts += 1;
    }
  }

  if (isImprovingTrend(staticTrend) && reduction > 0) {
    reduction -= 1;
    context.stats.improvingReductionGuards += 1;
  } else if (isWorseningTrend(staticTrend) && index >= LMR_BASE_MOVE_INDEX + 2) {
    reduction += 1;
    context.stats.nonImprovingReductionBoosts += 1;
  }

  const maxReduction = Math.max(1, depth - 2);
  return Math.max(0, Math.min(maxReduction, reduction));
}

function isStoredCountermove(context, previousMove, move) {
  if (!context.useCountermoves || !previousMove) return false;
  return sameMove(context.countermoves.get(moveKey(previousMove)), move);
}

function shouldPruneFutility({
  depth,
  index,
  move,
  inCheck,
  givesCheck,
  extension,
  alpha,
  beta,
  staticScore,
  staticTrend,
  context
}) {
  if (!context.useFutilityPruning) return false;
  if (staticScore === null) return false;
  if (depth < 1 || depth > 2) return false;
  if (index === 0) return false;
  if (inCheck || givesCheck || extension > 0) return false;
  if (move.captured) return false;
  if (alpha <= -MATE_SCORE + 1000 || beta >= MATE_SCORE - 1000) return false;

  return staticScore + futilityMargin(depth, staticTrend) <= alpha;
}

function shouldPruneReverseFutility({ depth, inCheck, alpha, beta, staticScore, staticTrend, context }) {
  if (!context.useReverseFutilityPruning) return false;
  if (inCheck || staticScore === null) return false;
  if (depth < 1 || depth > context.reverseFutilityMaxDepth) return false;
  if (beta - alpha !== 1) return false;
  if (alpha <= -MATE_SCORE + 1000 || beta >= MATE_SCORE - 1000) return false;

  return staticScore - reverseFutilityMargin(depth, context, staticTrend) >= beta;
}

function reverseFutilityMargin(depth, context, staticTrend) {
  const margin = context.reverseFutilityBaseMargin + context.reverseFutilityDepthMargin * depth;
  if (isImprovingTrend(staticTrend)) return Math.max(0, margin - 35);
  if (isWorseningTrend(staticTrend)) return margin + 45;
  return margin;
}

function shouldPruneBadHistory({
  depth,
  index,
  move,
  inCheck,
  givesCheck,
  extension,
  alpha,
  beta,
  context,
  ply,
  previousMove,
  staticTrend
}) {
  if (!context.useHistoryPruning) return false;
  if (depth < 1 || depth > HISTORY_PRUNING_MAX_DEPTH) return false;
  if (index < historyPruningMoveIndex(depth, staticTrend)) return false;
  if (beta - alpha !== 1) return false;
  if (inCheck || givesCheck || extension > 0) return false;
  if (move.captured) return false;
  if (alpha <= -MATE_SCORE + 1000 || beta >= MATE_SCORE - 1000) return false;
  if (isImprovingTrend(staticTrend)) {
    context.stats.badHistoryPruneGuards += 1;
    return false;
  }
  if (isStoredKiller(context, ply, move)) return false;
  if (isStoredCountermove(context, previousMove, move)) return false;

  const historyScore = context.history.get(moveKey(move)) ?? 0;
  const continuationScore = continuationHistoryValue(context, previousMove, move);
  if (historyScore >= 0 && continuationScore >= 0) return false;

  const combinedHistory = historyScore + Math.trunc(continuationScore / 2);
  const threshold = -historyPruningMargin(depth, staticTrend);
  if (combinedHistory > threshold) return false;

  return historyScore <= -depth * depth || continuationScore <= -depth * depth;
}

function historyPruningMoveIndex(depth, staticTrend) {
  const index = HISTORY_PRUNING_BASE_INDEX + depth;
  return isWorseningTrend(staticTrend) ? Math.max(2, index - 1) : index;
}

function historyPruningMargin(depth, staticTrend) {
  const margin = depth * depth;
  return isWorseningTrend(staticTrend) ? Math.max(1, Math.floor(margin / 2)) : margin;
}

function shouldPruneLateMove({
  depth,
  index,
  move,
  inCheck,
  givesCheck,
  extension,
  alpha,
  beta,
  context,
  ply,
  previousMove,
  staticTrend
}) {
  if (!context.useLateMovePruning) return false;
  if (depth < 1 || depth > context.lateMovePruningMaxDepth) return false;
  const baseThreshold = lateMovePruningBaseThreshold(depth, context);
  const threshold = lateMovePruningThreshold(depth, context, staticTrend);
  if (index < threshold) {
    if (isImprovingTrend(staticTrend) && index >= baseThreshold) {
      context.stats.improvingLateMoveGuards += 1;
    }
    return false;
  }
  if (beta - alpha !== 1) return false;
  if (inCheck || givesCheck || extension > 0) return false;
  if (move.captured) return false;
  if (alpha <= -MATE_SCORE + 1000 || beta >= MATE_SCORE - 1000) return false;
  if (isStoredKiller(context, ply, move)) return false;
  if (isStoredCountermove(context, previousMove, move)) return false;
  if ((context.history.get(moveKey(move)) ?? 0) > depth * depth) return false;
  if (continuationHistoryValue(context, previousMove, move) > depth * depth) return false;
  if (isWorseningTrend(staticTrend) && index < baseThreshold) {
    context.stats.nonImprovingLateMovePrunes += 1;
  }
  return true;
}

function lateMovePruningBaseThreshold(depth, context) {
  return context.lateMovePruningBase + depth * context.lateMovePruningDepthFactor;
}

function lateMovePruningThreshold(depth, context, staticTrend) {
  const threshold = lateMovePruningBaseThreshold(depth, context);
  if (isImprovingTrend(staticTrend)) return threshold + 2;
  if (isWorseningTrend(staticTrend)) return Math.max(1, threshold - 1);
  return threshold;
}

function shouldPruneSee({
  depth,
  index,
  move,
  inCheck,
  givesCheck,
  extension,
  alpha,
  beta,
  context,
  position
}) {
  if (!context.useSeePruning) return false;
  if (!move.captured) return false;
  if (depth < 1 || depth > 2) return false;
  if (index === 0) return false;
  if (inCheck || givesCheck || extension > 0) return false;
  if (alpha <= -MATE_SCORE + 1000 || beta >= MATE_SCORE - 1000) return false;

  const capture = getCaptureAnalysis(position, move, context);
  return capture.exchangeScore <= -context.seePruneMargin;
}

function shouldRazor({ depth, inCheck, alpha, beta, staticScore, context }) {
  if (!context.useRazoring) return false;
  if (inCheck || staticScore === null) return false;
  if (depth < 1 || depth > 2) return false;
  if (alpha <= -MATE_SCORE + 1000 || beta >= MATE_SCORE - 1000) return false;

  return staticScore + razorMargin(depth) <= alpha;
}

function razorMargin(depth) {
  return RAZOR_BASE_MARGIN + RAZOR_DEPTH_MARGIN * depth;
}

function shouldPruneDelta({ position, move, standPat, alpha, context }) {
  if (!context.useDeltaPruning) return false;
  if (!move.captured) return false;
  if (move.captured.type === PIECES.KING) return false;
  if (alpha >= MATE_SCORE - 1000) return false;
  if (standPat + PIECE_VALUES[move.captured.type] + context.deltaMargin > alpha) return false;
  return !givesCheck(position, move);
}

function tryProbCut({
  position,
  depth,
  alpha,
  beta,
  ply,
  context,
  extensionsRemaining,
  previousMove,
  inCheck
}) {
  if (!context.useProbCut) return null;
  if (depth < PROBCUT_MIN_DEPTH) return null;
  if (inCheck) return null;
  if (beta - alpha !== 1) return null;
  if (alpha <= -MATE_SCORE + 1000 || beta >= MATE_SCORE - 1000) return null;

  const threshold = beta + context.probCutMargin;
  const reducedDepth = Math.max(0, depth - 1 - PROBCUT_REDUCTION);
  const captures = orderMoves(position, generateCaptures(position), null, context, ply, previousMove)
    .filter((move) => shouldVerifyProbCutCapture(position, move, context))
    .slice(0, PROBCUT_CAPTURE_LIMIT);

  for (const move of captures) {
    if (isTimedOut(context)) {
      context.timedOut = true;
      return null;
    }

    context.stats.probCutSearches += 1;
    const next = makeMove(position, move);
    const score = normalizeScore(-negamax(
      next,
      reducedDepth,
      -threshold,
      -threshold + 1,
      ply + 1,
      context,
      null,
      extensionsRemaining,
      false,
      move
    ));

    if (context.timedOut) return null;
    if (score >= threshold) {
      context.stats.probCutPrunes += 1;
      return threshold;
    }
  }

  return null;
}

function shouldVerifyProbCutCapture(position, move, context) {
  if (!move.captured) return false;
  if (move.captured.type === PIECES.KING) return false;
  const capture = getCaptureAnalysis(position, move, context);
  if (!capture.isSafe && capture.exchangeScore < 0) return false;
  return capture.exchangeScore >= 0 || PIECE_VALUES[move.captured.type] >= PIECE_VALUES[PIECES.HORSE];
}

function internalIterativeDeepeningMoveHint({
  position,
  legalMoves,
  depth,
  alpha,
  beta,
  ply,
  context,
  extensionsRemaining,
  previousMove,
  inCheck
}) {
  if (!shouldUseInternalIterativeDeepening({ depth, alpha, beta, inCheck, legalMoves, context })) {
    return null;
  }

  const reducedDepth = Math.max(1, depth - context.iidReduction);
  const moves = orderMoves(position, legalMoves, null, context, ply, previousMove)
    .slice(0, context.iidMoveLimit);
  const previousIidActive = context.iidActive;
  let bestMove = null;
  let bestScore = -INFINITY_SCORE;
  let localAlpha = alpha;

  context.iidActive = true;
  context.stats.iidSearches += 1;
  try {
    for (const move of moves) {
      if (isTimedOut(context)) {
        context.timedOut = true;
        break;
      }

      const next = makeMove(position, move);
      const score = normalizeScore(-negamax(
        next,
        reducedDepth - 1,
        -beta,
        -localAlpha,
        ply + 1,
        context,
        null,
        extensionsRemaining,
        false,
        move
      ));

      if (context.timedOut) break;
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
      if (score > localAlpha) {
        localAlpha = score;
        if (localAlpha >= beta) break;
      }
    }
  } finally {
    context.iidActive = previousIidActive;
  }

  if (!bestMove || context.timedOut) return null;
  context.stats.iidMoveHits += 1;
  return bestMove;
}

function shouldUseInternalIterativeDeepening({ depth, alpha, beta, inCheck, legalMoves, context }) {
  if (!context.useInternalIterativeDeepening) return false;
  if (context.iidActive) return false;
  if (inCheck) return false;
  if (depth < context.iidMinDepth) return false;
  if (legalMoves.length < 2) return false;
  if (beta - alpha <= 1) return false;
  return true;
}

function futilityMargin(depth, staticTrend) {
  const margin = FUTILITY_BASE_MARGIN + FUTILITY_DEPTH_MARGIN * depth;
  if (isImprovingTrend(staticTrend)) return margin + 45;
  if (isWorseningTrend(staticTrend)) return Math.max(0, margin - 25);
  return margin;
}

function shouldTryNullMove(position, depth, beta, inCheck, context, allowNullMove) {
  if (!context.useNullMove || !allowNullMove) return false;
  if (inCheck || depth < NULL_MOVE_MIN_DEPTH) return false;
  if (beta >= MATE_SCORE - 1000 || beta <= -MATE_SCORE + 1000) return false;
  if (!hasNullMoveMaterial(position, position.turn)) return false;
  return true;
}

function shouldVerifyNullMoveCutoff(position, depth, context) {
  if (!context.useNullMoveVerification) return false;
  if (depth < context.nullMoveVerificationMinDepth) return false;
  return hasNullMoveMaterial(position, position.turn);
}

function verifyNullMoveCutoff({
  position,
  depth,
  beta,
  ply,
  context,
  extensionsRemaining,
  previousMove,
  principalMove,
  reduction
}) {
  context.stats.nullMoveVerifications += 1;
  const verificationDepth = Math.max(0, depth - 1 - reduction);
  const alpha = beta - 1;
  const legalMoves = generateLegalMoves(position, position.turn);

  if (legalMoves.length === 0) return -MATE_SCORE + ply;

  let bestScore = -INFINITY_SCORE;
  const moves = orderMoves(position, legalMoves, principalMove, context, ply, previousMove);

  for (const move of moves) {
    if (isTimedOut(context)) {
      context.timedOut = true;
      break;
    }

    const next = makeMove(position, move);
    const score = normalizeScore(-negamax(
      next,
      Math.max(0, verificationDepth - 1),
      -beta,
      -alpha,
      ply + 1,
      context,
      null,
      extensionsRemaining,
      false,
      move
    ));

    if (context.timedOut) break;
    if (score > bestScore) bestScore = score;
    if (score >= beta) return score;
  }

  return bestScore;
}

function nullMoveReduction(depth) {
  return depth >= 5 ? 3 : 2;
}

function applyMateDistanceWindow(alpha, beta, ply, context) {
  if (!context.useMateDistancePruning || ply <= 0) {
    return { alpha, beta, pruned: false, score: null };
  }

  let adjustedAlpha = alpha;
  let adjustedBeta = beta;
  const lowerBound = -MATE_SCORE + ply;
  const upperBound = MATE_SCORE - ply;

  if (adjustedAlpha < lowerBound) adjustedAlpha = lowerBound;
  if (adjustedBeta > upperBound) adjustedBeta = upperBound;

  if (adjustedAlpha !== alpha || adjustedBeta !== beta) {
    context.stats.mateDistanceWindows += 1;
  }

  if (adjustedAlpha >= adjustedBeta) {
    context.stats.mateDistancePrunes += 1;
    return {
      alpha: adjustedAlpha,
      beta: adjustedBeta,
      pruned: true,
      score: adjustedAlpha
    };
  }

  return {
    alpha: adjustedAlpha,
    beta: adjustedBeta,
    pruned: false,
    score: null
  };
}

function makeNullMove(position) {
  return {
    ...position,
    turn: opponent(position.turn),
    halfmove: (position.halfmove ?? 0) + 1
  };
}

function hasNullMoveMaterial(position, side) {
  return position.board.some((piece) => (
    piece?.side === side
    && (piece.type === PIECES.ROOK || piece.type === PIECES.CANNON || piece.type === PIECES.HORSE)
  ));
}

function rememberKiller(context, ply, move) {
  if (!context.useKillerMoves) return;

  const existing = context.killers.get(ply) ?? [];
  if (existing.some((candidate) => sameMove(candidate, move))) return;
  context.killers.set(ply, [move, ...existing].slice(0, 2));
  context.stats.killerStores += 1;
}

function killerMoveHit(context, ply, move) {
  if (!isStoredKiller(context, ply, move)) return false;
  context.stats.killerHits += 1;
  return true;
}

function isStoredKiller(context, ply, move) {
  if (!context.useKillerMoves) return false;
  return (context.killers.get(ply) ?? []).some((candidate) => sameMove(candidate, move));
}

function rememberCountermove(context, previousMove, reply) {
  if (!context.useCountermoves || !previousMove) return;
  context.countermoves.set(moveKey(previousMove), reply);
  context.stats.countermoveStores += 1;
}

function isCountermove(context, previousMove, move) {
  if (!context.useCountermoves || !previousMove) return false;
  const reply = context.countermoves.get(moveKey(previousMove));
  if (!sameMove(reply, move)) return false;
  context.stats.countermoveHits += 1;
  return true;
}

function continuationHistoryScore(context, previousMove, move) {
  if (!context.useContinuationHistory || !previousMove) return 0;
  const score = continuationHistoryValue(context, previousMove, move);
  if (score !== 0) context.stats.continuationHistoryHits += 1;
  return score;
}

function continuationHistoryValue(context, previousMove, move) {
  if (!context.useContinuationHistory || !previousMove) return 0;
  const previous = context.continuationHistory.get(moveKey(previousMove));
  if (!previous) return 0;
  return previous.get(moveKey(move)) ?? 0;
}

function captureHistoryScore(context, move) {
  if (!context.useCaptureHistory || !move.captured) return 0;
  const score = context.captureHistory.get(captureHistoryKey(move)) ?? 0;
  if (score !== 0) context.stats.captureHistoryHits += 1;
  return Math.max(-30_000, Math.min(30_000, score));
}

function checkHistoryScore(context, move) {
  if (!context.useCheckHistory || move.captured) return 0;
  const score = context.checkHistory.get(moveKey(move)) ?? 0;
  if (score !== 0) context.stats.checkHistoryHits += 1;
  return Math.max(-40_000, Math.min(40_000, score));
}

function bumpHistory(context, move, amount) {
  const key = moveKey(move);
  context.history.set(key, gravityHistoryValue(context.history.get(key) ?? 0, amount));
  context.stats.historyGravityUpdates += 1;
}

function bumpCaptureHistory(context, move, amount) {
  if (!context.useCaptureHistory || !move.captured) return;
  const key = captureHistoryKey(move);
  context.captureHistory.set(key, gravityHistoryValue(context.captureHistory.get(key) ?? 0, amount));
  context.stats.captureHistoryStores += 1;
  context.stats.historyGravityUpdates += 1;
}

function bumpCheckHistory(context, move, amount) {
  if (!context.useCheckHistory || move.captured) return;
  const key = moveKey(move);
  context.checkHistory.set(key, gravityHistoryValue(context.checkHistory.get(key) ?? 0, amount));
  context.stats.checkHistoryStores += 1;
  context.stats.historyGravityUpdates += 1;
}

function penalizeFailedCaptures(context, moves, amount) {
  if (!context.useCaptureHistory || moves.length === 0) return;
  for (const move of moves) bumpCaptureHistory(context, move, -amount);
  context.stats.captureHistoryMaluses += moves.length;
}

function penalizeFailedQuietChecks(context, moves, amount) {
  if (!context.useCheckHistory || moves.length === 0) return;
  for (const move of moves) bumpCheckHistory(context, move, -amount);
  context.stats.checkHistoryMaluses += moves.length;
}

function captureHistoryKey(move) {
  return `${move.piece.type}:${move.to}:${move.captured?.type ?? ""}`;
}

function bumpContinuationHistory(context, previousMove, move, amount) {
  if (!context.useContinuationHistory || !previousMove) return;
  const previousKey = moveKey(previousMove);
  const moveTable = context.continuationHistory.get(previousKey) ?? new Map();
  const key = moveKey(move);
  moveTable.set(key, gravityHistoryValue(moveTable.get(key) ?? 0, amount));
  context.continuationHistory.set(previousKey, moveTable);
  context.stats.continuationHistoryStores += 1;
  context.stats.historyGravityUpdates += 1;
}

function penalizeFailedQuietMoves(context, moves, amount, previousMove) {
  if (!context.useHistoryMalus || moves.length === 0) return;
  for (const move of moves) {
    bumpHistory(context, move, -amount);
    bumpContinuationHistory(context, previousMove, move, -amount);
  }
  context.stats.historyMaluses += moves.length;
}

function gravityHistoryValue(current, bonus) {
  const scaled = current + bonus - Math.trunc(current * Math.abs(bonus) / HISTORY_GRAVITY_LIMIT);
  return clampOrderingScore(scaled);
}

function isTimedOut(context) {
  return performanceNow() >= context.deadline;
}

function buildRepetitionCounts(history) {
  const counts = new Map();

  for (const item of history) {
    const key = typeof item === "string" ? item : positionKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function storeTransposition(context, key, entry) {
  const result = context.table.set(key, entry);

  if (!result || typeof result !== "object" || !("stored" in result)) {
    context.stats.ttStores += 1;
    return;
  }

  if (result.stored) context.stats.ttStores += 1;
  if (result.replaced) context.stats.ttReplacements += 1;
  if (result.evicted) context.stats.ttEvictions += 1;
  if (!result.stored) context.stats.ttSkips += 1;
}

function isRepetition(context, key) {
  const previous = context.repetitionCounts.get(key) ?? 0;
  const currentPath = context.pathCounts.get(key) ?? 0;
  return previous + currentPath >= 2;
}

function rootRepetitionInfo(context, key) {
  const historyCount = context.repetitionCounts.get(key) ?? 0;
  const pathCount = context.pathCounts.get(key) ?? 0;

  if (historyCount + pathCount < 2) return null;

  return {
    kind: "repeated-position",
    adjudication: "draw-assumed",
    historyCount,
    pathCount,
    projectedCount: historyCount + pathCount + 1
  };
}

function enterPosition(context, key) {
  context.pathCounts.set(key, (context.pathCounts.get(key) ?? 0) + 1);
}

function leavePosition(context, key) {
  const count = context.pathCounts.get(key) ?? 0;
  if (count <= 1) {
    context.pathCounts.delete(key);
  } else {
    context.pathCounts.set(key, count - 1);
  }
}

function createSearchStats() {
  return {
    nodes: 0,
    qnodes: 0,
    qchecks: 0,
    qttHits: 0,
    qttStores: 0,
    qttReplacements: 0,
    qttEvictions: 0,
    qttSkips: 0,
    qttMoveHits: 0,
    evalCacheHits: 0,
    evalCacheStores: 0,
    tacticalCacheHits: 0,
    tacticalCacheStores: 0,
    tacticalMoveOrderHits: 0,
    tacticalMoveOrderCacheHits: 0,
    tacticalMoveOrderCacheStores: 0,
    ttHits: 0,
    ttStores: 0,
    ttReplacements: 0,
    ttEvictions: 0,
    ttSkips: 0,
    ttMoveHits: 0,
    cutoffs: 0,
    aspirationSearches: 0,
    aspirationFailHigh: 0,
    aspirationFailLow: 0,
    extensions: 0,
    recaptureExtensions: 0,
    singularExtensionSearches: 0,
    singularExtensions: 0,
    singularExtensionRejects: 0,
    softStops: 0,
    seePrunes: 0,
    reverseFutilityPrunes: 0,
    mateDistancePrunes: 0,
    mateDistanceWindows: 0,
    razorPrunes: 0,
    razorResearches: 0,
    leastAttackerCacheHits: 0,
    leastAttackerCacheProbes: 0,
    leastAttackerCacheStores: 0,
    probCutPrunes: 0,
    probCutSearches: 0,
    futilityPrunes: 0,
    badHistoryPrunes: 0,
    badHistoryPruneGuards: 0,
    lateMovePrunes: 0,
    depthThreeLateMovePrunes: 0,
    deltaPrunes: 0,
    reductions: 0,
    reductionPlies: 0,
    deepReductions: 0,
    lmrResearches: 0,
    pvReductionGuards: 0,
    cutNodeReductionBoosts: 0,
    improvingNodes: 0,
    nonImprovingNodes: 0,
    stableEvalTrendNodes: 0,
    improvingReductionGuards: 0,
    nonImprovingReductionBoosts: 0,
    improvingLateMoveGuards: 0,
    nonImprovingLateMovePrunes: 0,
    pvsResearches: 0,
    nullMovePrunes: 0,
    nullMoveVerifications: 0,
    nullMoveVerificationFailures: 0,
    killerStores: 0,
    killerHits: 0,
    captureHistoryStores: 0,
    captureHistoryHits: 0,
    captureHistoryMaluses: 0,
    checkHistoryStores: 0,
    checkHistoryHits: 0,
    checkHistoryMaluses: 0,
    countermoveStores: 0,
    countermoveHits: 0,
    continuationHistoryStores: 0,
    continuationHistoryHits: 0,
    continuationReductionBoosts: 0,
    continuationReductionMaluses: 0,
    checkEvasionOrderHits: 0,
    checkEvasionCaptures: 0,
    checkEvasionBlocks: 0,
    checkEvasionKingMoves: 0,
    historyMaluses: 0,
    historyGravityUpdates: 0,
    rootScoreOrderHits: 0,
    rootRankOrderHits: 0,
    iidSearches: 0,
    iidMoveHits: 0,
    rootMovesSearched: 0,
    repetitions: 0
  };
}

function mergeSearchStats(total, next) {
  return {
    nodes: total.nodes + next.nodes,
    qnodes: total.qnodes + next.qnodes,
    qchecks: total.qchecks + next.qchecks,
    qttHits: total.qttHits + next.qttHits,
    qttStores: total.qttStores + next.qttStores,
    qttReplacements: total.qttReplacements + next.qttReplacements,
    qttEvictions: total.qttEvictions + next.qttEvictions,
    qttSkips: total.qttSkips + next.qttSkips,
    qttMoveHits: total.qttMoveHits + next.qttMoveHits,
    evalCacheHits: total.evalCacheHits + next.evalCacheHits,
    evalCacheStores: total.evalCacheStores + next.evalCacheStores,
    tacticalCacheHits: total.tacticalCacheHits + next.tacticalCacheHits,
    tacticalCacheStores: total.tacticalCacheStores + next.tacticalCacheStores,
    tacticalMoveOrderHits: total.tacticalMoveOrderHits + next.tacticalMoveOrderHits,
    tacticalMoveOrderCacheHits: total.tacticalMoveOrderCacheHits + next.tacticalMoveOrderCacheHits,
    tacticalMoveOrderCacheStores: total.tacticalMoveOrderCacheStores + next.tacticalMoveOrderCacheStores,
    ttHits: total.ttHits + next.ttHits,
    ttStores: total.ttStores + next.ttStores,
    ttReplacements: total.ttReplacements + next.ttReplacements,
    ttEvictions: total.ttEvictions + next.ttEvictions,
    ttSkips: total.ttSkips + next.ttSkips,
    ttMoveHits: total.ttMoveHits + next.ttMoveHits,
    cutoffs: total.cutoffs + next.cutoffs,
    aspirationSearches: total.aspirationSearches + next.aspirationSearches,
    aspirationFailHigh: total.aspirationFailHigh + next.aspirationFailHigh,
    aspirationFailLow: total.aspirationFailLow + next.aspirationFailLow,
    extensions: total.extensions + next.extensions,
    recaptureExtensions: total.recaptureExtensions + next.recaptureExtensions,
    singularExtensionSearches: total.singularExtensionSearches + next.singularExtensionSearches,
    singularExtensions: total.singularExtensions + next.singularExtensions,
    singularExtensionRejects: total.singularExtensionRejects + next.singularExtensionRejects,
    softStops: total.softStops + next.softStops,
    seePrunes: total.seePrunes + next.seePrunes,
    reverseFutilityPrunes: total.reverseFutilityPrunes + next.reverseFutilityPrunes,
    mateDistancePrunes: total.mateDistancePrunes + next.mateDistancePrunes,
    mateDistanceWindows: total.mateDistanceWindows + next.mateDistanceWindows,
    razorPrunes: total.razorPrunes + next.razorPrunes,
    razorResearches: total.razorResearches + next.razorResearches,
    leastAttackerCacheHits: total.leastAttackerCacheHits + next.leastAttackerCacheHits,
    leastAttackerCacheProbes: total.leastAttackerCacheProbes + next.leastAttackerCacheProbes,
    leastAttackerCacheStores: total.leastAttackerCacheStores + next.leastAttackerCacheStores,
    probCutPrunes: total.probCutPrunes + next.probCutPrunes,
    probCutSearches: total.probCutSearches + next.probCutSearches,
    futilityPrunes: total.futilityPrunes + next.futilityPrunes,
    badHistoryPrunes: total.badHistoryPrunes + next.badHistoryPrunes,
    badHistoryPruneGuards: total.badHistoryPruneGuards + next.badHistoryPruneGuards,
    lateMovePrunes: total.lateMovePrunes + next.lateMovePrunes,
    depthThreeLateMovePrunes: total.depthThreeLateMovePrunes + next.depthThreeLateMovePrunes,
    deltaPrunes: total.deltaPrunes + next.deltaPrunes,
    reductions: total.reductions + next.reductions,
    reductionPlies: total.reductionPlies + next.reductionPlies,
    deepReductions: total.deepReductions + next.deepReductions,
    lmrResearches: total.lmrResearches + next.lmrResearches,
    pvReductionGuards: total.pvReductionGuards + next.pvReductionGuards,
    cutNodeReductionBoosts: total.cutNodeReductionBoosts + next.cutNodeReductionBoosts,
    improvingNodes: total.improvingNodes + next.improvingNodes,
    nonImprovingNodes: total.nonImprovingNodes + next.nonImprovingNodes,
    stableEvalTrendNodes: total.stableEvalTrendNodes + next.stableEvalTrendNodes,
    improvingReductionGuards: total.improvingReductionGuards + next.improvingReductionGuards,
    nonImprovingReductionBoosts: total.nonImprovingReductionBoosts + next.nonImprovingReductionBoosts,
    improvingLateMoveGuards: total.improvingLateMoveGuards + next.improvingLateMoveGuards,
    nonImprovingLateMovePrunes: total.nonImprovingLateMovePrunes + next.nonImprovingLateMovePrunes,
    pvsResearches: total.pvsResearches + next.pvsResearches,
    nullMovePrunes: total.nullMovePrunes + next.nullMovePrunes,
    nullMoveVerifications: total.nullMoveVerifications + next.nullMoveVerifications,
    nullMoveVerificationFailures: total.nullMoveVerificationFailures + next.nullMoveVerificationFailures,
    killerStores: total.killerStores + next.killerStores,
    killerHits: total.killerHits + next.killerHits,
    captureHistoryStores: total.captureHistoryStores + next.captureHistoryStores,
    captureHistoryHits: total.captureHistoryHits + next.captureHistoryHits,
    captureHistoryMaluses: total.captureHistoryMaluses + next.captureHistoryMaluses,
    checkHistoryStores: total.checkHistoryStores + next.checkHistoryStores,
    checkHistoryHits: total.checkHistoryHits + next.checkHistoryHits,
    checkHistoryMaluses: total.checkHistoryMaluses + next.checkHistoryMaluses,
    countermoveStores: total.countermoveStores + next.countermoveStores,
    countermoveHits: total.countermoveHits + next.countermoveHits,
    continuationHistoryStores: total.continuationHistoryStores + next.continuationHistoryStores,
    continuationHistoryHits: total.continuationHistoryHits + next.continuationHistoryHits,
    continuationReductionBoosts: total.continuationReductionBoosts + next.continuationReductionBoosts,
    continuationReductionMaluses: total.continuationReductionMaluses + next.continuationReductionMaluses,
    checkEvasionOrderHits: total.checkEvasionOrderHits + next.checkEvasionOrderHits,
    checkEvasionCaptures: total.checkEvasionCaptures + next.checkEvasionCaptures,
    checkEvasionBlocks: total.checkEvasionBlocks + next.checkEvasionBlocks,
    checkEvasionKingMoves: total.checkEvasionKingMoves + next.checkEvasionKingMoves,
    historyMaluses: total.historyMaluses + next.historyMaluses,
    historyGravityUpdates: total.historyGravityUpdates + next.historyGravityUpdates,
    rootScoreOrderHits: total.rootScoreOrderHits + next.rootScoreOrderHits,
    rootRankOrderHits: total.rootRankOrderHits + next.rootRankOrderHits,
    iidSearches: total.iidSearches + next.iidSearches,
    iidMoveHits: total.iidMoveHits + next.iidMoveHits,
    rootMovesSearched: total.rootMovesSearched + next.rootMovesSearched,
    repetitions: total.repetitions + next.repetitions
  };
}

function numberOption(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function performanceNow() {
  if (globalThis.performance?.now) return globalThis.performance.now();
  return Date.now();
}

function normalizeScore(score) {
  return Object.is(score, -0) ? 0 : score;
}

function scoreToTransposition(score, ply) {
  if (score >= TRANSPOSITION_MATE_BOUND) return score + ply;
  if (score <= -TRANSPOSITION_MATE_BOUND) return score - ply;
  return score;
}

function scoreFromTransposition(score, ply) {
  if (score >= TRANSPOSITION_MATE_BOUND) return score - ply;
  if (score <= -TRANSPOSITION_MATE_BOUND) return score + ply;
  return score;
}

export function formatPrincipalVariation(line) {
  return line.map((move) => move.notation ?? moveToNotation(move)).join(" ");
}
