import { hasCrossedRiver, parseFen, rankOf } from "./board.js";
import { PIECES, SIDES } from "./constants.js";
import { isInCheck } from "./movegen.js";

// Texel tuning of piece values. The method (Peter Österlund's "Texel tuning"):
// label many positions by their eventual game result (1/0.5/0 from red's view),
// then choose the eval parameters that minimize the mean-squared error between a
// sigmoid of the static eval and the result. Here the static eval is material
// only — the classic first target — which recovers the relative piece values that
// best predict outcomes. Pure functions; unit-testable; no engine search.

export const DEFAULT_TUNABLE_VALUES = Object.freeze({
  [PIECES.ROOK]: 900,
  [PIECES.CANNON]: 470,
  [PIECES.HORSE]: 430,
  [PIECES.ADVISOR]: 120,
  [PIECES.ELEPHANT]: 120,
  [PIECES.PAWN]: 90,
  pawnRiverBonus: 45
});

// Piece types tuned by default. PAWN is the anchor (held fixed) so the value
// scale is pinned and doesn't drift freely with the sigmoid's K.
export const DEFAULT_TUNED_TYPES = Object.freeze([
  PIECES.ROOK,
  PIECES.CANNON,
  PIECES.HORSE,
  PIECES.ADVISOR,
  PIECES.ELEPHANT
]);

/** Material eval in centipawns from red's perspective. */
export function materialEval(position, values) {
  const board = position.board;
  let score = 0;
  for (let square = 0; square < board.length; square += 1) {
    const piece = board[square];
    if (!piece || piece.type === PIECES.KING) continue;
    let value = values[piece.type] ?? 0;
    if (piece.type === PIECES.PAWN && hasCrossedRiver(piece.side, rankOf(square))) {
      value += values.pawnRiverBonus ?? 0;
    }
    score += piece.side === SIDES.RED ? value : -value;
  }
  return score;
}

/** Logistic map from a centipawn eval to an expected score in (0,1). */
export function winExpectancy(evalCp, k) {
  return 1 / (1 + Math.pow(10, (-k * evalCp) / 400));
}

/** Mean-squared Texel error of `values` (with scaling `k`) over the dataset. */
export function texelLoss(dataset, values, k) {
  if (dataset.length === 0) return 0;
  let sum = 0;
  for (const sample of dataset) {
    const diff = sample.result - winExpectancy(materialEval(sample.position, values), k);
    sum += diff * diff;
  }
  return sum / dataset.length;
}

/** Find the sigmoid scaling K that minimizes loss for fixed `values`. */
export function findOptimalK(dataset, values, options = {}) {
  const lo = options.lo ?? 0.05;
  const hi = options.hi ?? 3.0;
  let bestK = lo;
  let bestLoss = Infinity;
  // Coarse scan then a local refine.
  for (let k = lo; k <= hi + 1e-9; k += 0.05) {
    const loss = texelLoss(dataset, values, k);
    if (loss < bestLoss) {
      bestLoss = loss;
      bestK = k;
    }
  }
  for (let k = Math.max(lo, bestK - 0.05); k <= bestK + 0.05; k += 0.005) {
    const loss = texelLoss(dataset, values, k);
    if (loss < bestLoss) {
      bestLoss = loss;
      bestK = k;
    }
  }
  return { k: Number(bestK.toFixed(3)), loss: bestLoss };
}

/**
 * Coordinate-descent Texel tuning of piece values. Returns the tuned values, the
 * fitted K, and before/after loss. Holds PAWN fixed as the value-scale anchor.
 */
export function tunePieceValues(dataset, options = {}) {
  const startValues = { ...DEFAULT_TUNABLE_VALUES, ...(options.startValues ?? {}) };
  const tunedTypes = options.tunedTypes ?? DEFAULT_TUNED_TYPES;
  const steps = options.steps ?? [64, 16, 4, 1];
  // L2 pull toward the prior (start) values, as a fraction of the MSE scale.
  // Without it, sparse/drawish data drives lightly-constrained values to absurd
  // extremes (e.g. horse → 1). Penalty per type = ((v − prior)/prior)^2.
  const lambda = options.regularization ?? 0;

  const penalty = (vals) => {
    if (lambda === 0) return 0;
    let sum = 0;
    for (const type of tunedTypes) {
      const rel = (vals[type] - startValues[type]) / startValues[type];
      sum += rel * rel;
    }
    return (lambda * sum) / tunedTypes.length;
  };
  const objective = (vals, k) => texelLoss(dataset, vals, k) + penalty(vals);

  let values = { ...startValues };
  let { k } = findOptimalK(dataset, values);
  const startLoss = texelLoss(dataset, values, k);
  let bestObjective = objective(values, k);

  for (const step of steps) {
    let improved = true;
    while (improved) {
      improved = false;
      for (const type of tunedTypes) {
        for (const direction of [1, -1]) {
          const candidate = values[type] + direction * step;
          if (candidate <= 0) continue;
          const trial = { ...values, [type]: candidate };
          const trialObjective = objective(trial, k);
          if (trialObjective < bestObjective - 1e-12) {
            values = trial;
            bestObjective = trialObjective;
            improved = true;
            break;
          }
        }
      }
    }
    // Re-fit K after each step size — values and scale interact.
    k = findOptimalK(dataset, values).k;
    bestObjective = objective(values, k);
  }

  const loss = texelLoss(dataset, values, k);
  return { values, k, startLoss, loss, improvement: startLoss - loss };
}

/**
 * Turn raw {fen,result,ply} samples into tuning data: parse FENs, drop noisy
 * positions (in-check, or within the opening/endgame fringe), and de-duplicate.
 */
export function buildTuningDataset(samples, options = {}) {
  const minPly = options.minPly ?? 8;
  const skipInCheck = options.skipInCheck ?? true;
  const dataset = [];
  const seen = new Set();

  for (const sample of samples) {
    if (sample.ply !== undefined && sample.ply < minPly) continue;
    if (seen.has(sample.fen)) continue;
    seen.add(sample.fen);

    let position;
    try {
      position = parseFen(sample.fen);
    } catch {
      continue;
    }
    if (skipInCheck && (isInCheck(position, SIDES.RED) || isInCheck(position, SIDES.BLACK))) continue;

    dataset.push({ position, result: sample.result, fen: sample.fen });
  }

  return dataset;
}
