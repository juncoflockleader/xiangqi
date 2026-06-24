import test from "node:test";
import assert from "node:assert/strict";
import {
  NNUE_INPUT_SIZE,
  createInitialPosition,
  createNnueNetwork,
  deserializeNnue,
  evaluateNnue,
  nnueFeatures,
  nnueForwardFeatures,
  nnueLoss,
  serializeNnue,
  trainNnue
} from "../src/index.js";
import { PIECES, SIDES } from "../src/constants.js";

test("nnueFeatures encodes one active feature per piece, in range", () => {
  const pos = createInitialPosition();
  const features = nnueFeatures(pos);
  assert.equal(features.length, 32, "full board has 32 pieces");
  assert.ok(features.every((f) => f >= 0 && f < NNUE_INPUT_SIZE));
  assert.equal(new Set(features).size, features.length, "features are distinct");
});

test("evaluateNnue runs a dense forward pass and returns a finite cp score", () => {
  const net = createNnueNetwork({ hidden: 16, seed: 1 });
  const cp = evaluateNnue(net, createInitialPosition());
  assert.ok(Number.isFinite(cp));
});

test("serialize/deserialize round-trips the network exactly", () => {
  const net = createNnueNetwork({ hidden: 8, seed: 2 });
  const pos = createInitialPosition();
  const before = evaluateNnue(net, pos);
  const restored = deserializeNnue(serializeNnue(net));
  const after = evaluateNnue(restored, pos);
  assert.equal(after, before);
  assert.equal(restored.hidden, net.hidden);
});

test("trainNnue learns a material-driven target (more red material → higher score)", () => {
  // Synthetic dataset: result correlates with red's extra rook count. A working
  // trainer must learn to score red-up positions higher than red-down ones.
  const positions = [];
  for (let extra = -2; extra <= 2; extra += 1) {
    const board = new Array(90).fill(null);
    board[0] = { side: SIDES.RED, type: PIECES.KING };
    board[89] = { side: SIDES.BLACK, type: PIECES.KING };
    let sq = 3;
    const n = Math.abs(extra);
    for (let i = 0; i < n; i += 1) {
      board[sq] = { side: extra > 0 ? SIDES.RED : SIDES.BLACK, type: PIECES.ROOK };
      sq += 3;
    }
    // result from red POV: more red rooks → closer to a win.
    const result = 0.5 + extra * 0.2;
    positions.push({ position: { board, turn: SIDES.RED }, result });
  }
  // Replicate for a denser dataset.
  const dataset = [];
  for (let i = 0; i < 200; i += 1) dataset.push(positions[i % positions.length]);

  const net = createNnueNetwork({ hidden: 16, seed: 3 });
  const startLoss = nnueLoss(net, dataset);
  const { finalLoss } = trainNnue(net, dataset, { epochs: 60, lr: 0.1, batchSize: 32 });

  assert.ok(finalLoss < startLoss, `loss should drop (${startLoss} → ${finalLoss})`);

  const redUp = evaluateNnue(net, positions[4].position); // +2 rooks
  const redDown = evaluateNnue(net, positions[0].position); // -2 rooks
  assert.ok(redUp > redDown, `red-up (${redUp}) should score above red-down (${redDown})`);
});

test("nnueForwardFeatures intermediates are consistent with evaluateNnue", () => {
  const net = createNnueNetwork({ hidden: 8, seed: 5 });
  const pos = createInitialPosition();
  const fwd = nnueForwardFeatures(net, nnueFeatures(pos));
  assert.ok(Math.abs(fwd.cp - evaluateNnue(net, pos)) < 1e-9);
});
