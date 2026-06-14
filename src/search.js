import {
  DRAW_SCORE,
  INFINITY_SCORE,
  MATE_SCORE,
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
import {
  annotateMove,
  generateCaptures,
  generateLegalMoves,
  isInCheck
} from "./movegen.js";
import { evaluatePosition } from "./evaluate.js";

const EXACT = "exact";
const LOWER = "lower";
const UPPER = "upper";

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
      tableSize: table.size
    };
  }

  let bestMove = rootMoves[0];
  let bestScore = evaluatePosition(position, position.turn).score;
  let bestLine = [];
  let completedDepth = 0;
  let timedOut = false;
  let nodes = 0;
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
      nodes: 0,
      timedOut: false
    };

    const root = searchRoot(position, depth, previousBest, context, rootMoves);
    nodes += context.nodes;

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
    tableSize: table.size
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
    const score = -negamax(next, depth - 1, -INFINITY_SCORE, INFINITY_SCORE, 1, context, line);
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

function negamax(position, depth, alpha, beta, ply, context, lineOut) {
  context.nodes += 1;
  if (isTimedOut(context)) {
    context.timedOut = true;
    return evaluatePosition(position, position.turn).score;
  }

  const alphaOriginal = alpha;
  const key = positionKey(position);
  const tt = context.table.get(key);

  if (tt && tt.depth >= depth) {
    if (tt.flag === EXACT) {
      if (lineOut && tt.bestMove) lineOut.splice(0, lineOut.length, annotateMove(position, tt.bestMove));
      return tt.score;
    }
    if (tt.flag === LOWER) alpha = Math.max(alpha, tt.score);
    if (tt.flag === UPPER) beta = Math.min(beta, tt.score);
    if (alpha >= beta) return tt.score;
  }

  const inCheck = isInCheck(position, position.turn);
  if (depth <= 0) {
    return quiescence(position, alpha, beta, ply, context);
  }

  const legalMoves = generateLegalMoves(position, position.turn);

  if (legalMoves.length === 0) {
    return inCheck ? -MATE_SCORE + ply : -MATE_SCORE + ply;
  }

  let bestScore = -INFINITY_SCORE;
  let bestMove = null;
  let bestChildLine = [];
  const ordered = orderMoves(position, legalMoves, tt?.bestMove, context, ply);

  for (const move of ordered) {
    const next = makeMove(position, move);
    const childLine = [];
    const extension = move.captured || inCheck ? 0 : 0;
    const score = -negamax(next, depth - 1 + extension, -beta, -alpha, ply + 1, context, childLine);

    if (context.timedOut) return score;

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
      bestChildLine = [annotateMove(position, move), ...childLine];
    }

    alpha = Math.max(alpha, score);

    if (alpha >= beta) {
      if (!move.captured) {
        rememberKiller(context.killers, ply, move);
        bumpHistory(context.history, move, depth * depth);
      }
      break;
    }
  }

  const flag = bestScore <= alphaOriginal ? UPPER : bestScore >= beta ? LOWER : EXACT;
  context.table.set(key, { depth, score: bestScore, flag, bestMove });

  if (lineOut) lineOut.splice(0, lineOut.length, ...bestChildLine);
  return bestScore;
}

function quiescence(position, alpha, beta, ply, context) {
  context.nodes += 1;
  const standPat = evaluatePosition(position, position.turn).score;

  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;

  const captures = orderMoves(position, generateCaptures(position), null, context, ply)
    .filter((move) => isGoodCapture(move));

  for (const move of captures) {
    if (isTimedOut(context)) {
      context.timedOut = true;
      break;
    }

    const next = makeMove(position, move);
    const score = -quiescence(next, -beta, -alpha, ply + 1, context);
    if (score >= beta) return beta;
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
    score += 100_000 + (PIECE_VALUES[move.captured.type] * 10 - PIECE_VALUES[move.piece.type]);
  }

  const next = makeMove(position, move);
  if (isInCheck(next, opponent(position.turn))) score += 40_000;

  if (isKiller(context.killers, ply, move)) score += 25_000;
  score += context.history.get(moveKey(move)) ?? 0;

  return score;
}

function isGoodCapture(move) {
  if (!move.captured) return false;
  return PIECE_VALUES[move.captured.type] >= PIECE_VALUES[move.piece.type] * 0.55;
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

function performanceNow() {
  if (globalThis.performance?.now) return globalThis.performance.now();
  return Date.now();
}

export function formatPrincipalVariation(line) {
  return line.map((move) => move.notation ?? moveToNotation(move)).join(" ");
}
