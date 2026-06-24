import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TUNABLE_VALUES,
  buildTuningDataset,
  createInitialPosition,
  findOptimalK,
  materialEval,
  texelLoss,
  tunePieceValues,
  toFen,
  winExpectancy
} from "../src/index.js";
import { PIECES, SIDES } from "../src/constants.js";

// Build a synthetic position with the given per-side piece counts placed on
// distinct squares. Material-only eval doesn't care about exact placement.
function syntheticPosition(redCounts, blackCounts) {
  const board = new Array(90).fill(null);
  let square = 0;
  const place = (side, type, n) => {
    for (let i = 0; i < n; i += 1) {
      board[square] = { side, type };
      square += 3; // spread out; keep within 90
    }
  };
  board[0] = { side: SIDES.RED, type: PIECES.KING };
  board[89] = { side: SIDES.BLACK, type: PIECES.KING };
  square = 3;
  for (const [type, n] of Object.entries(redCounts)) place(SIDES.RED, type, n);
  for (const [type, n] of Object.entries(blackCounts)) place(SIDES.BLACK, type, n);
  return { board, turn: SIDES.RED };
}

function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("winExpectancy is a monotonic sigmoid centered at 0", () => {
  assert.equal(winExpectancy(0, 1), 0.5);
  assert.ok(winExpectancy(300, 1) > 0.5);
  assert.ok(winExpectancy(-300, 1) < 0.5);
  assert.ok(winExpectancy(900, 1) > winExpectancy(300, 1));
});

test("materialEval sums signed material from red's perspective", () => {
  const pos = syntheticPosition({ [PIECES.ROOK]: 1 }, {});
  assert.equal(materialEval(pos, DEFAULT_TUNABLE_VALUES), DEFAULT_TUNABLE_VALUES[PIECES.ROOK]);
  const down = syntheticPosition({}, { [PIECES.CANNON]: 1 });
  assert.equal(materialEval(down, DEFAULT_TUNABLE_VALUES), -DEFAULT_TUNABLE_VALUES[PIECES.CANNON]);
});

test("texelLoss is lower at the data-generating values than at wrong ones", () => {
  const truth = { ...DEFAULT_TUNABLE_VALUES, [PIECES.ADVISOR]: 260, [PIECES.ELEPHANT]: 240 };
  const rng = makeRng(7);
  const data = [];
  for (let i = 0; i < 300; i += 1) {
    const pos = syntheticPosition(
      { [PIECES.ROOK]: Math.floor(rng() * 3), [PIECES.HORSE]: Math.floor(rng() * 3), [PIECES.ADVISOR]: Math.floor(rng() * 3) },
      { [PIECES.ROOK]: Math.floor(rng() * 3), [PIECES.CANNON]: Math.floor(rng() * 3), [PIECES.ADVISOR]: Math.floor(rng() * 3) }
    );
    data.push({ position: pos, result: winExpectancy(materialEval(pos, truth), 1.0) });
  }
  const lossAtTruth = texelLoss(data, truth, 1.0);
  const lossAtWrong = texelLoss(data, DEFAULT_TUNABLE_VALUES, 1.0);
  assert.ok(lossAtTruth < lossAtWrong, `truth loss ${lossAtTruth} should beat default ${lossAtWrong}`);
  assert.ok(lossAtTruth < 1e-6, "loss at the generating values should be ~0");
});

test("tunePieceValues recovers a deliberately mistuned piece and lowers loss", () => {
  // Generate data where advisors are worth far more than the default.
  const truth = { ...DEFAULT_TUNABLE_VALUES, [PIECES.ADVISOR]: 280 };
  const rng = makeRng(42);
  const data = [];
  for (let i = 0; i < 600; i += 1) {
    const pos = syntheticPosition(
      {
        [PIECES.ROOK]: Math.floor(rng() * 3),
        [PIECES.HORSE]: Math.floor(rng() * 3),
        [PIECES.CANNON]: Math.floor(rng() * 3),
        [PIECES.ADVISOR]: Math.floor(rng() * 3)
      },
      {
        [PIECES.ROOK]: Math.floor(rng() * 3),
        [PIECES.HORSE]: Math.floor(rng() * 3),
        [PIECES.ADVISOR]: Math.floor(rng() * 3)
      }
    );
    data.push({ position: pos, result: winExpectancy(materialEval(pos, truth), 1.0) });
  }

  const result = tunePieceValues(data, { steps: [64, 16, 4, 1] });
  assert.ok(result.improvement > 0, "tuning should reduce loss");
  assert.ok(result.loss < result.startLoss, "final loss < start loss");
  // Advisor should move substantially up toward 280 from the default 120.
  assert.ok(
    result.values[PIECES.ADVISOR] > 200,
    `advisor should rise toward 280, got ${result.values[PIECES.ADVISOR]}`
  );
});

test("findOptimalK returns a finite positive scaling", () => {
  const data = [
    { position: syntheticPosition({ [PIECES.ROOK]: 1 }, {}), result: 0.9 },
    { position: syntheticPosition({}, { [PIECES.ROOK]: 1 }), result: 0.1 }
  ];
  const { k, loss } = findOptimalK(data, DEFAULT_TUNABLE_VALUES);
  assert.ok(k > 0 && Number.isFinite(k));
  assert.ok(loss >= 0);
});

test("buildTuningDataset drops early plies, in-check positions, and duplicates", () => {
  const startFen = toFen(createInitialPosition());
  const samples = [
    { fen: startFen, result: 1, ply: 2 }, // dropped: early ply
    { fen: startFen, result: 1, ply: 20 }, // kept
    { fen: startFen, result: 1, ply: 24 }, // dropped: duplicate FEN
    // Red general in check from the black rook on the open e-file.
    { fen: "4k4/9/9/9/9/9/9/9/4r4/4K4 r", result: 0, ply: 30 } // dropped: in check
  ];
  const dataset = buildTuningDataset(samples, { minPly: 8 });
  assert.equal(dataset.length, 1);
  assert.equal(dataset[0].fen, startFen);
});
