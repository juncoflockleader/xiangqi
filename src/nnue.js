import { rankOf } from "./board.js";
import { PIECES, SIDES } from "./constants.js";

// A small NNUE-style evaluator for xiangqi, kept deliberately simple so the whole
// pipeline (features → train → evaluate → port to C++) is transparent and
// testable. This is the foundation an accumulator-based, quantized, SIMD net
// would build on; here weights are plain floats and the forward pass is dense.
//
// Architecture: piece-square features (red's perspective) → 1 hidden layer with
// clipped ReLU → scalar output interpreted directly as centipawns (red POV).
//   inputs  = 2 colors × 7 piece types × 90 squares = 1260
//   hidden  = H (default 32)
//   output  = 1
//
// Feature index for a piece of `color`/`type` on `square`:
//   ((color===red ? 0 : 1) * 7 + TYPE_INDEX[type]) * 90 + square

export const NNUE_PIECE_TYPES = Object.freeze([
  PIECES.KING,
  PIECES.ADVISOR,
  PIECES.ELEPHANT,
  PIECES.HORSE,
  PIECES.ROOK,
  PIECES.CANNON,
  PIECES.PAWN
]);

const TYPE_INDEX = Object.freeze(
  Object.fromEntries(NNUE_PIECE_TYPES.map((type, index) => [type, index]))
);

export const NNUE_INPUT_SIZE = 2 * NNUE_PIECE_TYPES.length * 90; // 1260
export const NNUE_DEFAULT_HIDDEN = 32;

/** Active feature indices for a position, from red's perspective. */
export function nnueFeatures(position) {
  const board = position.board;
  const features = [];
  for (let square = 0; square < board.length; square += 1) {
    const piece = board[square];
    if (!piece) continue;
    const colorBlock = piece.side === SIDES.RED ? 0 : 1;
    const typeIndex = TYPE_INDEX[piece.type];
    if (typeIndex === undefined) continue;
    features.push((colorBlock * NNUE_PIECE_TYPES.length + typeIndex) * 90 + square);
  }
  return features;
}

/** Create a network with small random weights (seeded for reproducibility). */
export function createNnueNetwork(options = {}) {
  const hidden = options.hidden ?? NNUE_DEFAULT_HIDDEN;
  const inputSize = options.inputSize ?? NNUE_INPUT_SIZE;
  const rng = makeRng(options.seed ?? 0x51ed270b);
  const scale1 = 1 / Math.sqrt(32); // fan-in is ~#pieces, not inputSize
  const scale2 = 1 / Math.sqrt(hidden);

  // w1 stored feature-major: w1[feature * hidden + h]
  const w1 = new Float64Array(inputSize * hidden);
  for (let i = 0; i < w1.length; i += 1) w1[i] = (rng() * 2 - 1) * scale1;
  const b1 = new Float64Array(hidden);
  const w2 = new Float64Array(hidden);
  for (let i = 0; i < hidden; i += 1) w2[i] = (rng() * 2 - 1) * scale2;

  return { inputSize, hidden, w1, b1, w2, b2: 0, outputScale: options.outputScale ?? 400 };
}

function clippedRelu(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Forward pass from active feature indices. Returns intermediates for training. */
export function nnueForwardFeatures(net, features) {
  const { hidden, w1, b1, w2, b2, outputScale } = net;
  const acc = new Float64Array(hidden);
  acc.set(b1);
  for (const f of features) {
    const base = f * hidden;
    for (let h = 0; h < hidden; h += 1) acc[h] += w1[base + h];
  }
  const activated = new Float64Array(hidden);
  let out = b2;
  for (let h = 0; h < hidden; h += 1) {
    const a = clippedRelu(acc[h]);
    activated[h] = a;
    out += w2[h] * a;
  }
  return { acc, activated, raw: out, cp: out * outputScale };
}

/** Centipawn evaluation of a position from red's perspective. */
export function evaluateNnue(net, position) {
  return nnueForwardFeatures(net, nnueFeatures(position)).cp;
}

function winExpectancyRaw(raw) {
  // raw is already in "logit/400" units via outputScale; map to (0,1).
  return 1 / (1 + Math.exp(-raw));
}

/** Mean-squared error between predicted win prob and result over a dataset. */
export function nnueLoss(net, dataset) {
  if (dataset.length === 0) return 0;
  let sum = 0;
  for (const sample of dataset) {
    const { raw } = nnueForwardFeatures(net, sample.features ?? nnueFeatures(sample.position));
    const diff = sample.result - winExpectancyRaw(raw);
    sum += diff * diff;
  }
  return sum / dataset.length;
}

/**
 * Train the network in place with Adam on the MSE of (sigmoid(raw) − result).
 * dataset entries: { features:number[] (or position), result:number in [0,1] }.
 * Returns { lossHistory, finalLoss }.
 */
export function trainNnue(net, dataset, options = {}) {
  const epochs = options.epochs ?? 40;
  const lr = options.lr ?? 0.05;
  const batchSize = options.batchSize ?? 128;
  const l2 = options.l2 ?? 1e-7;
  const rng = makeRng(options.seed ?? 12345);
  const { hidden, inputSize } = net;

  // Precompute features.
  const data = dataset.map((s) => ({
    features: s.features ?? nnueFeatures(s.position),
    result: s.result
  }));

  // Adam state.
  const mW1 = new Float64Array(inputSize * hidden);
  const vW1 = new Float64Array(inputSize * hidden);
  const mB1 = new Float64Array(hidden);
  const vB1 = new Float64Array(hidden);
  const mW2 = new Float64Array(hidden);
  const vW2 = new Float64Array(hidden);
  let mB2 = 0;
  let vB2 = 0;
  const beta1 = 0.9;
  const beta2 = 0.999;
  const eps = 1e-8;
  let t = 0;

  const lossHistory = [];
  const indices = data.map((_, i) => i);

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    shuffle(indices, rng);
    for (let start = 0; start < indices.length; start += batchSize) {
      const batch = indices.slice(start, start + batchSize);
      t += 1;

      // Gradient accumulators for this batch.
      const gW1 = new Map(); // sparse: featureBase+h → grad
      const gB1 = new Float64Array(hidden);
      const gW2 = new Float64Array(hidden);
      let gB2 = 0;
      const invN = 1 / batch.length;

      for (const idx of batch) {
        const { features, result } = data[idx];
        const { acc, activated, raw } = nnueForwardFeatures(net, features);
        const pred = winExpectancyRaw(raw);
        // d(MSE)/d(raw) = 2*(pred-result)*pred*(1-pred)
        const dRaw = 2 * (pred - result) * pred * (1 - pred) * invN;

        gB2 += dRaw;
        for (let h = 0; h < hidden; h += 1) {
          gW2[h] += dRaw * activated[h];
          // through clipped relu: derivative 1 only when 0 < acc < 1
          const drelu = acc[h] > 0 && acc[h] < 1 ? 1 : 0;
          const dAcc = dRaw * net.w2[h] * drelu;
          if (dAcc !== 0) {
            gB1[h] += dAcc;
            for (const f of features) {
              const key = f * hidden + h;
              gW1.set(key, (gW1.get(key) ?? 0) + dAcc);
            }
          }
        }
      }

      // Adam updates (t already incremented above).
      const bc1 = 1 - Math.pow(beta1, t);
      const bc2 = 1 - Math.pow(beta2, t);
      const adam = (g, m, v, i, w) => {
        m[i] = beta1 * m[i] + (1 - beta1) * g;
        v[i] = beta2 * v[i] + (1 - beta2) * g * g;
        const mhat = m[i] / bc1;
        const vhat = v[i] / bc2;
        return w - lr * (mhat / (Math.sqrt(vhat) + eps) + l2 * w);
      };

      for (const [key, g] of gW1) net.w1[key] = adam(g, mW1, vW1, key, net.w1[key]);
      for (let h = 0; h < hidden; h += 1) {
        net.b1[h] = adam(gB1[h], mB1, vB1, h, net.b1[h]);
        net.w2[h] = adam(gW2[h], mW2, vW2, h, net.w2[h]);
      }
      // bias b2 (scalar Adam)
      mB2 = beta1 * mB2 + (1 - beta1) * gB2;
      vB2 = beta2 * vB2 + (1 - beta2) * gB2 * gB2;
      net.b2 -= lr * (mB2 / bc1) / (Math.sqrt(vB2 / bc2) + eps);
    }

    const loss = nnueLoss(net, data);
    lossHistory.push(loss);
    options.onEpoch?.(epoch, loss);
  }

  return { lossHistory, finalLoss: lossHistory[lossHistory.length - 1] ?? 0 };
}

export function serializeNnue(net) {
  return JSON.stringify({
    inputSize: net.inputSize,
    hidden: net.hidden,
    outputScale: net.outputScale,
    w1: Array.from(net.w1),
    b1: Array.from(net.b1),
    w2: Array.from(net.w2),
    b2: net.b2
  });
}

// Flat whitespace-separated text format the C++ engine can read with `>>`:
//   line 1: NNUE <inputSize> <hidden> <outputScale>
//   then:   w1 (inputSize*hidden, feature-major), b1 (hidden), w2 (hidden), b2 (1)
export function serializeNnueText(net) {
  const lines = [`NNUE ${net.inputSize} ${net.hidden} ${net.outputScale}`];
  lines.push(Array.from(net.w1).join(" "));
  lines.push(Array.from(net.b1).join(" "));
  lines.push(Array.from(net.w2).join(" "));
  lines.push(String(net.b2));
  return lines.join("\n");
}

export function deserializeNnueText(text) {
  const tokens = text.split(/\s+/).filter(Boolean);
  let i = 0;
  if (tokens[i++] !== "NNUE") throw new Error("Not an NNUE text weight file.");
  const inputSize = Number(tokens[i++]);
  const hidden = Number(tokens[i++]);
  const outputScale = Number(tokens[i++]);
  const take = (n) => Float64Array.from({ length: n }, () => Number(tokens[i++]));
  const w1 = take(inputSize * hidden);
  const b1 = take(hidden);
  const w2 = take(hidden);
  const b2 = Number(tokens[i++]);
  return { inputSize, hidden, outputScale, w1, b1, w2, b2 };
}

export function deserializeNnue(json) {
  const obj = typeof json === "string" ? JSON.parse(json) : json;
  return {
    inputSize: obj.inputSize,
    hidden: obj.hidden,
    outputScale: obj.outputScale ?? 400,
    w1: Float64Array.from(obj.w1),
    b1: Float64Array.from(obj.b1),
    w2: Float64Array.from(obj.w2),
    b2: obj.b2
  };
}

function shuffle(array, rng) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
