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
  positionKey,
  sameMove
} from "./board.js";
import { hashPosition } from "./hash.js";
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
const NULL_MOVE_MIN_DEPTH = 3;

export function searchBestMove(position, options = {}) {
  const depthLimit = options.depth ?? 4;
  const timeLimitMs = options.timeLimitMs ?? 2000;
  const startedAt = performanceNow();
  const deadline = startedAt + timeLimitMs;
  const table = options.transpositionTable ?? new Map();
  const history = new Map();
  const killers = new Map();
  const candidateLimit = options.candidateLimit ?? 8;
  const bannedMoveKeys = new Set((options.bannedMoves ?? []).map(moveKey));
  const repetitionCounts = buildRepetitionCounts(options.history ?? options.positionHistory ?? []);
  const rootMoves = generateLegalMoves(position, position.turn)
    .filter((move) => !bannedMoveKeys.has(moveKey(move)));

  if (rootMoves.length === 0) {
    return {
      bestMove: null,
      score: isInCheck(position, position.turn) ? -MATE_SCORE : DRAW_SCORE,
      depth: 0,
      nodes: 0,
      principalVariation: [],
      candidates: [],
      timedOut: false,
      tableSize: table.size,
      stats: createSearchStats()
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

  for (let depth = 1; depth <= depthLimit; depth += 1) {
    const context = {
      startedAt,
      deadline,
      table,
      history,
      killers,
      candidateLimit,
      repetitionCounts: new Map(repetitionCounts),
      pathCounts: new Map(),
      maxExtensions: options.maxExtensions ?? DEFAULT_MAX_EXTENSIONS,
      maxPly: options.maxPly ?? DEFAULT_MAX_PLY,
      useNullMove: options.useNullMove !== false,
      usePvs: options.usePvs !== false,
      tacticalCache: new Map(),
      stats: createSearchStats(),
      nodes: 0,
      timedOut: false
    };

    const root = searchRoot(position, depth, previousBest, context, rootMoves);
    nodes += context.nodes;
    stats = mergeSearchStats(stats, context.stats);

    if (context.timedOut) {
      timedOut = true;
      break;
    }

    bestMove = root.bestMove;
    bestScore = root.score;
    bestLine = root.principalVariation;
    candidates = root.candidates;
    completedDepth = depth;
    previousBest = bestMove;
  }

  return {
    bestMove: bestMove ? annotateMove(position, bestMove) : null,
    score: bestScore,
    depth: completedDepth,
    nodes,
    principalVariation: bestLine,
    candidates,
    timedOut,
    tableSize: table.size,
    stats
  };
}

function searchRoot(position, depth, previousBest, context, rootMoves) {
  let alpha = -INFINITY_SCORE;
  const beta = INFINITY_SCORE;
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
    const line = [];
    const score = normalizeScore(-negamax(next, depth - 1, -INFINITY_SCORE, INFINITY_SCORE, 1, context, line, context.maxExtensions, true));
    const annotated = annotateMove(position, move);

    candidates.push({
      move: annotated,
      score,
      principalVariation: [annotated, ...line]
    });

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
      bestLine = [annotated, ...line];
    }

    alpha = Math.max(alpha, score);
  }

  candidates.sort((a, b) => b.score - a.score);

  return {
    bestMove: bestMove ?? moves[0],
    score: bestScore,
    principalVariation: bestLine,
    candidates: candidates.slice(0, context.candidateLimit)
  };
}

function negamax(position, depth, alpha, beta, ply, context, lineOut, extensionsRemaining, allowNullMove) {
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

  const alphaOriginal = alpha;
  const transpositionKey = hashPosition(position);
  const tt = context.table.get(transpositionKey);

  if (tt && tt.depth >= depth) {
    context.stats.ttHits += 1;
    if (tt.flag === EXACT) {
      if (lineOut && tt.bestMove) lineOut.splice(0, lineOut.length, annotateMove(position, tt.bestMove));
      leavePosition(context, repetitionKey);
      return tt.score;
    }
    if (tt.flag === LOWER) alpha = Math.max(alpha, tt.score);
    if (tt.flag === UPPER) beta = Math.min(beta, tt.score);
    if (alpha >= beta) {
      leavePosition(context, repetitionKey);
      return tt.score;
    }
  }

  const inCheck = isInCheck(position, position.turn);
  if (depth <= 0) {
    if (inCheck && extensionsRemaining > 0) {
      depth = 1;
      extensionsRemaining -= 1;
      context.stats.extensions += 1;
    } else {
      const score = quiescence(position, alpha, beta, ply, context);
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
      false
    ));

    if (context.timedOut) {
      leavePosition(context, repetitionKey);
      return nullScore;
    }

    if (nullScore >= beta) {
      context.stats.nullMovePrunes += 1;
      leavePosition(context, repetitionKey);
      return beta;
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
  const ordered = orderMoves(position, legalMoves, tt?.bestMove, context, ply);

  for (let index = 0; index < ordered.length; index += 1) {
    const move = ordered[index];
    const next = makeMove(position, move);
    let childLine = [];
    const givesCheck = isInCheck(next, next.turn);
    const extension = shouldExtend({ inCheck, givesCheck, move, extensionsRemaining }) ? 1 : 0;
    const childExtensions = extensionsRemaining - extension;
    if (extension > 0) context.stats.extensions += 1;

    let reduction = shouldReduce({ depth, index, move, inCheck, givesCheck }) ? 1 : 0;
    if (reduction > 0) context.stats.reductions += 1;

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
        true
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
        true
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
        true
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
        true
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
        rememberKiller(context.killers, ply, move);
        bumpHistory(context.history, move, depth * depth);
      }
      break;
    }
  }

  const flag = bestScore <= alphaOriginal ? UPPER : bestScore >= beta ? LOWER : EXACT;
  context.table.set(transpositionKey, { depth, score: bestScore, flag, bestMove });

  if (lineOut) lineOut.splice(0, lineOut.length, ...bestChildLine);
  leavePosition(context, repetitionKey);
  return bestScore;
}

function quiescence(position, alpha, beta, ply, context) {
  context.nodes += 1;
  context.stats.nodes += 1;
  context.stats.qnodes += 1;
  const standPat = evaluatePosition(position, position.turn).score;

  if (standPat >= beta) {
    context.stats.cutoffs += 1;
    return beta;
  }
  if (standPat > alpha) alpha = standPat;

  const captures = orderMoves(position, generateCaptures(position), null, context, ply)
    .filter((move) => isGoodCapture(position, move, context));

  for (const move of captures) {
    if (isTimedOut(context)) {
      context.timedOut = true;
      break;
    }

    const next = makeMove(position, move);
    const score = normalizeScore(-quiescence(next, -beta, -alpha, ply + 1, context));
    if (score >= beta) {
      context.stats.cutoffs += 1;
      return beta;
    }
    if (score > alpha) alpha = score;
  }

  return alpha;
}

function orderMoves(position, moves, principalMove, context, ply) {
  return [...moves].sort((a, b) => moveOrderingScore(position, b, principalMove, context, ply) - moveOrderingScore(position, a, principalMove, context, ply));
}

function moveOrderingScore(position, move, principalMove, context, ply) {
  let score = 0;

  if (sameMove(move, principalMove)) score += 1_000_000;
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

function shouldExtend({ inCheck, givesCheck, move, extensionsRemaining }) {
  if (extensionsRemaining <= 0) return false;
  if (inCheck) return true;
  if (givesCheck) return true;
  return Boolean(move.captured && PIECE_VALUES[move.captured.type] >= PIECE_VALUES[move.piece.type] * 2);
}

function shouldReduce({ depth, index, move, inCheck, givesCheck }) {
  if (depth < 3) return false;
  if (index < 4) return false;
  if (inCheck || givesCheck) return false;
  if (move.captured) return false;
  return true;
}

function shouldTryNullMove(position, depth, beta, inCheck, context, allowNullMove) {
  if (!context.useNullMove || !allowNullMove) return false;
  if (inCheck || depth < NULL_MOVE_MIN_DEPTH) return false;
  if (beta >= MATE_SCORE - 1000 || beta <= -MATE_SCORE + 1000) return false;
  if (!hasNullMoveMaterial(position, position.turn)) return false;
  return true;
}

function nullMoveReduction(depth) {
  return depth >= 5 ? 3 : 2;
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

function bumpHistory(history, move, amount) {
  const key = moveKey(move);
  history.set(key, (history.get(key) ?? 0) + amount);
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

function isRepetition(context, key) {
  const previous = context.repetitionCounts.get(key) ?? 0;
  const currentPath = context.pathCounts.get(key) ?? 0;
  return previous + currentPath >= 2;
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
    ttHits: 0,
    cutoffs: 0,
    extensions: 0,
    reductions: 0,
    lmrResearches: 0,
    pvsResearches: 0,
    nullMovePrunes: 0,
    repetitions: 0
  };
}

function mergeSearchStats(total, next) {
  return {
    nodes: total.nodes + next.nodes,
    qnodes: total.qnodes + next.qnodes,
    ttHits: total.ttHits + next.ttHits,
    cutoffs: total.cutoffs + next.cutoffs,
    extensions: total.extensions + next.extensions,
    reductions: total.reductions + next.reductions,
    lmrResearches: total.lmrResearches + next.lmrResearches,
    pvsResearches: total.pvsResearches + next.pvsResearches,
    nullMovePrunes: total.nullMovePrunes + next.nullMovePrunes,
    repetitions: total.repetitions + next.repetitions
  };
}

function performanceNow() {
  if (globalThis.performance?.now) return globalThis.performance.now();
  return Date.now();
}

function normalizeScore(score) {
  return Object.is(score, -0) ? 0 : score;
}

export function formatPrincipalVariation(line) {
  return line.map((move) => move.notation ?? moveToNotation(move)).join(" ");
}
