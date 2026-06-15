import {
  DRAW_SCORE,
  INFINITY_SCORE,
  MATE_SCORE,
  PIECES,
  PIECE_VALUES
} from "./constants.js";
import {
  makeMove,
  moveKey,
  moveToNotation,
  opponent,
  parseMoveNotation,
  positionKey,
  sameMove
} from "./board.js";
import { hashPosition } from "./hash.js";
import { createTranspositionTable } from "./transposition.js";
import { resolveSearchBudget } from "./time.js";
import {
  annotateMove,
  generateCaptures,
  generateLegalMoves,
  isInCheck
} from "./movegen.js";
import { evaluatePosition } from "./evaluate.js";
import { analyzeCapture, captureExchangeScore } from "./tactics.js";

const EXACT = "exact";
const LOWER = "lower";
const UPPER = "upper";
const DEFAULT_MAX_EXTENSIONS = 4;
const DEFAULT_MAX_PLY = 80;
const DEFAULT_ASPIRATION_WINDOW = 45;
const DEFAULT_QCHECK_DEPTH = 1;
const DEFAULT_DELTA_MARGIN = 160;
const FUTILITY_BASE_MARGIN = 90;
const FUTILITY_DEPTH_MARGIN = 70;
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
const PROBCUT_MIN_DEPTH = 4;
const PROBCUT_REDUCTION = 2;
const PROBCUT_CAPTURE_LIMIT = 6;
const IID_MIN_DEPTH = 4;
const IID_REDUCTION = 2;
const IID_MOVE_LIMIT = 8;
const LMR_MIN_DEPTH = 3;
const LMR_BASE_MOVE_INDEX = 4;
const SINGULAR_EXTENSION_MIN_DEPTH = 5;
const SINGULAR_EXTENSION_REDUCTION = 2;
const DEFAULT_SINGULAR_EXTENSION_MARGIN = 90;

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
  const history = new Map();
  const killers = new Map();
  const countermoves = new Map();
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
      history,
      killers,
      countermoves,
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
      useCountermoves: options.useCountermoves !== false,
      useRootScoreOrdering: options.useRootScoreOrdering !== false,
      useMateDistancePruning: options.useMateDistancePruning !== false,
      useRazoring: options.useRazoring !== false,
      useFutilityPruning: options.useFutilityPruning !== false,
      useDeltaPruning: options.useDeltaPruning !== false,
      useQuiescenceChecks: options.useQuiescenceChecks !== false,
      useRecaptureExtensions: options.useRecaptureExtensions !== false,
      useSeePruning: options.useSeePruning !== false,
      useHistoryMalus: options.useHistoryMalus !== false,
      useLateMoveReductions: options.useLateMoveReductions !== false,
      useAdaptiveLmr: options.useAdaptiveLmr !== false,
      useProbCut: options.useProbCut !== false,
      useInternalIterativeDeepening: options.useInternalIterativeDeepening !== false,
      useSingularExtensions: options.useSingularExtensions !== false,
      nullMoveVerificationMinDepth: Math.max(3, Math.floor(numberOption(options.nullMoveVerificationMinDepth, NULL_MOVE_VERIFICATION_MIN_DEPTH))),
      seePruneMargin: Math.max(0, numberOption(options.seePruneMargin, DEFAULT_SEE_PRUNE_MARGIN)),
      probCutMargin: Math.max(0, numberOption(options.probCutMargin, DEFAULT_PROBCUT_MARGIN)),
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
      tacticalCache: new Map(),
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
  let bestLine = [];
  const candidates = [];
  const moves = orderMoves(position, rootMoves, previousBest, context, 0);

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

    candidates.push({
      move: annotated,
      score,
      repetition,
      principalVariation: [annotated, ...line]
    });

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
      bestLine = [annotated, ...line];
    }

    alpha = Math.max(alpha, score);
    if (!context.exactRootScores && alpha >= beta) {
      context.stats.cutoffs += 1;
      break;
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  return {
    bestMove: bestMove ?? moves[0],
    score: bestScore,
    principalVariation: bestLine,
    candidates: candidates.slice(0, context.candidateLimit),
    rootMoveScores: createRootMoveScoreMap(candidates)
  };
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
    return evaluatePosition(position, position.turn).score;
  }

  if (ply >= context.maxPly) {
    return evaluatePosition(position, position.turn).score;
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
          principalMove: tt?.bestMove ?? null,
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

  let bestScore = -INFINITY_SCORE;
  let bestMove = null;
  let bestChildLine = [];
  const ttPrincipalMove = tt?.bestMove ?? null;
  let principalMove = ttPrincipalMove;
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
      return evaluatePosition(position, position.turn).score;
    }
  }
  const ordered = orderMoves(position, legalMoves, principalMove, context, ply, previousMove);
  const staticScore = inCheck ? null : evaluatePosition(position, position.turn).score;
  const searchedQuietMoves = [];

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
    return probCutScore ?? evaluatePosition(position, position.turn).score;
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
      ttPrincipalMove,
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
      context
    })) {
      context.stats.futilityPrunes += 1;
      continue;
    }

    let reduction = lateMoveReduction({ depth, index, move, inCheck, givesCheck, extension, context, ply, previousMove });
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
      if (!move.captured) {
        penalizeFailedQuietMoves(context, searchedQuietMoves, depth * depth);
        rememberKiller(context.killers, ply, move);
        rememberCountermove(context, previousMove, move);
        bumpHistory(context.history, move, depth * depth);
      }
      break;
    }

    if (!move.captured) searchedQuietMoves.push(move);
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
    return evaluatePosition(position, position.turn).score;
  }

  if (ply >= context.maxPly) {
    return evaluatePosition(position, position.turn).score;
  }

  const mateWindow = applyMateDistanceWindow(alpha, beta, ply, context);
  if (mateWindow.pruned) return mateWindow.score;
  alpha = mateWindow.alpha;
  beta = mateWindow.beta;

  const inCheck = isInCheck(position, position.turn);
  let moves;

  if (inCheck) {
    moves = orderMoves(position, generateLegalMoves(position, position.turn), null, context, ply);
    if (moves.length === 0) return -MATE_SCORE + ply;
  } else {
    const standPat = evaluatePosition(position, position.turn).score;

    if (standPat >= beta) {
      context.stats.cutoffs += 1;
      return beta;
    }
    if (standPat > alpha) alpha = standPat;

    const captures = [];
    for (const move of orderMoves(position, generateCaptures(position), null, context, ply)) {
      if (!isGoodCapture(position, move, context)) continue;
      if (shouldPruneDelta({ position, move, standPat, alpha, context })) {
        context.stats.deltaPrunes += 1;
        continue;
      }
      captures.push(move);
    }
    const checkingMoves = quietCheckingMoves(position, context, qChecksRemaining, ply);
    moves = [...captures, ...checkingMoves];
  }

  for (const move of moves) {
    if (isTimedOut(context)) {
      context.timedOut = true;
      break;
    }

    const next = makeMove(position, move);
    const nextQChecks = move.captured ? qChecksRemaining : Math.max(0, qChecksRemaining - 1);
    const score = normalizeScore(-quiescence(next, -beta, -alpha, ply + 1, context, nextQChecks));
    if (score >= beta) {
      context.stats.cutoffs += 1;
      return beta;
    }
    if (score > alpha) alpha = score;
  }

  return alpha;
}

function quietCheckingMoves(position, context, qChecksRemaining, ply) {
  if (!context.useQuiescenceChecks || qChecksRemaining <= 0) return [];

  const checks = orderMoves(position, generateLegalMoves(position, position.turn), null, context, ply)
    .filter((move) => !move.captured && givesCheck(position, move));

  context.stats.qchecks += checks.length;
  return checks;
}

function givesCheck(position, move) {
  const next = makeMove(position, move);
  return isInCheck(next, next.turn);
}

function orderMoves(position, moves, principalMove, context, ply, previousMove = null) {
  return moves
    .map((move) => ({
      move,
      score: moveOrderingScore(position, move, principalMove, context, ply, previousMove)
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.move);
}

function moveOrderingScore(position, move, principalMove, context, ply, previousMove) {
  let score = 0;

  if (context.priorityMoveKeys?.has(moveKey(move))) score += 1_500_000;
  if (sameMove(move, principalMove)) score += 1_000_000;
  if (ply === 0 && context.useRootScoreOrdering && context.rootMoveScores?.has(moveKey(move))) {
    score += 500_000 + clampOrderingScore(context.rootMoveScores.get(moveKey(move)));
    context.stats.rootScoreOrderHits += 1;
  }
  if (isCountermove(context, previousMove, move)) score += 30_000;
  if (move.captured) {
    const capture = getCaptureAnalysis(position, move, context);
    score += 100_000 + (PIECE_VALUES[move.captured.type] * 10 - PIECE_VALUES[move.piece.type]);
    score += capture.exchangeScore * 12;
    score += capture.isSafe ? 8_000 : -12_000;
  }

  const next = makeMove(position, move);
  if (isInCheck(next, opponent(position.turn))) score += 40_000;

  if (isKiller(context.killers, ply, move)) score += 25_000;
  score += context.history.get(moveKey(move)) ?? 0;

  return score;
}

function isGoodCapture(position, move, context) {
  if (!move.captured) return false;
  const exchangeScore = context
    ? getCaptureAnalysis(position, move, context).exchangeScore
    : captureExchangeScore(position, move);
  return exchangeScore >= -40 || PIECE_VALUES[move.captured.type] >= PIECE_VALUES[move.piece.type] * 0.55;
}

function getCaptureAnalysis(position, move, context) {
  const key = `${hashPosition(position)}:${moveKey(move)}`;
  const cached = context.tacticalCache.get(key);
  if (cached) return cached;

  const analysis = analyzeCapture(position, move);
  context.tacticalCache.set(key, analysis);
  return analysis;
}

function toMoveKey(move) {
  return moveKey(typeof move === "string" ? parseMoveNotation(move) : move);
}

function createRootMoveScoreMap(candidates) {
  return new Map(candidates.map((candidate) => [moveKey(candidate.move), candidate.score]));
}

function clampOrderingScore(score) {
  return Math.max(-200_000, Math.min(200_000, Math.round(score)));
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

function lateMoveReduction({ depth, index, move, inCheck, givesCheck, extension, context, ply, previousMove }) {
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
  if (isKiller(context.killers, ply, move)) reduction -= 1;
  if (isStoredCountermove(context, previousMove, move)) reduction -= 1;

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
  context
}) {
  if (!context.useFutilityPruning) return false;
  if (staticScore === null) return false;
  if (depth < 1 || depth > 2) return false;
  if (index === 0) return false;
  if (inCheck || givesCheck || extension > 0) return false;
  if (move.captured) return false;
  if (alpha <= -MATE_SCORE + 1000 || beta >= MATE_SCORE - 1000) return false;

  return staticScore + futilityMargin(depth) <= alpha;
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

function futilityMargin(depth) {
  return FUTILITY_BASE_MARGIN + FUTILITY_DEPTH_MARGIN * depth;
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

function rememberKiller(killers, ply, move) {
  const existing = killers.get(ply) ?? [];
  if (existing.some((candidate) => sameMove(candidate, move))) return;
  killers.set(ply, [move, ...existing].slice(0, 2));
}

function isKiller(killers, ply, move) {
  return (killers.get(ply) ?? []).some((candidate) => sameMove(candidate, move));
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

function bumpHistory(history, move, amount) {
  const key = moveKey(move);
  history.set(key, clampOrderingScore((history.get(key) ?? 0) + amount));
}

function penalizeFailedQuietMoves(context, moves, amount) {
  if (!context.useHistoryMalus || moves.length === 0) return;
  for (const move of moves) bumpHistory(context.history, move, -amount);
  context.stats.historyMaluses += moves.length;
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
    ttHits: 0,
    ttStores: 0,
    ttReplacements: 0,
    ttEvictions: 0,
    ttSkips: 0,
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
    mateDistancePrunes: 0,
    mateDistanceWindows: 0,
    razorPrunes: 0,
    razorResearches: 0,
    probCutPrunes: 0,
    probCutSearches: 0,
    futilityPrunes: 0,
    deltaPrunes: 0,
    reductions: 0,
    reductionPlies: 0,
    deepReductions: 0,
    lmrResearches: 0,
    pvsResearches: 0,
    nullMovePrunes: 0,
    nullMoveVerifications: 0,
    nullMoveVerificationFailures: 0,
    countermoveStores: 0,
    countermoveHits: 0,
    historyMaluses: 0,
    rootScoreOrderHits: 0,
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
    ttHits: total.ttHits + next.ttHits,
    ttStores: total.ttStores + next.ttStores,
    ttReplacements: total.ttReplacements + next.ttReplacements,
    ttEvictions: total.ttEvictions + next.ttEvictions,
    ttSkips: total.ttSkips + next.ttSkips,
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
    mateDistancePrunes: total.mateDistancePrunes + next.mateDistancePrunes,
    mateDistanceWindows: total.mateDistanceWindows + next.mateDistanceWindows,
    razorPrunes: total.razorPrunes + next.razorPrunes,
    razorResearches: total.razorResearches + next.razorResearches,
    probCutPrunes: total.probCutPrunes + next.probCutPrunes,
    probCutSearches: total.probCutSearches + next.probCutSearches,
    futilityPrunes: total.futilityPrunes + next.futilityPrunes,
    deltaPrunes: total.deltaPrunes + next.deltaPrunes,
    reductions: total.reductions + next.reductions,
    reductionPlies: total.reductionPlies + next.reductionPlies,
    deepReductions: total.deepReductions + next.deepReductions,
    lmrResearches: total.lmrResearches + next.lmrResearches,
    pvsResearches: total.pvsResearches + next.pvsResearches,
    nullMovePrunes: total.nullMovePrunes + next.nullMovePrunes,
    nullMoveVerifications: total.nullMoveVerifications + next.nullMoveVerifications,
    nullMoveVerificationFailures: total.nullMoveVerificationFailures + next.nullMoveVerificationFailures,
    countermoveStores: total.countermoveStores + next.countermoveStores,
    countermoveHits: total.countermoveHits + next.countermoveHits,
    historyMaluses: total.historyMaluses + next.historyMaluses,
    rootScoreOrderHits: total.rootScoreOrderHits + next.rootScoreOrderHits,
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
