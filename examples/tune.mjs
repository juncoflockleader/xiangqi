#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import {
  DEFAULT_TUNABLE_VALUES,
  buildTuningDataset,
  createJavaScriptEngineBackend,
  createLearningEngineBackend,
  findOptimalK,
  runEngineMatch,
  texelLoss,
  tunePieceValues
} from "../src/index.js";
import { PIECES } from "../src/constants.js";

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  printUsage();
  process.exit(1);
}
if (options.help) {
  printUsage();
  process.exit(0);
}

const a = createEngine("tuneA", options.engine, options);
const b = createEngine("tuneB", options.engine, options);

try {
  console.error(`Generating self-play data: ${options.games} games of ${options.engine} @ ${options.time}ms ...`);
  const match = await runEngineMatch(a, b, {
    games: options.games,
    maxPlies: options.maxPlies,
    openingPlies: options.openingPlies,
    seed: options.seed,
    searchOptions: { timeLimitMs: options.time, useBook: false },
    collectPositions: true
  });

  console.error(
    `Games: A ${match.tally.winsA} / B ${match.tally.winsB} / draws ${match.tally.draws}` +
      ` — raw positions ${match.positions.length}`
  );

  const dataset = buildTuningDataset(match.positions, { minPly: options.minPly });
  console.error(`Tuning dataset (quiet, deduped, ply>=${options.minPly}): ${dataset.length} positions`);
  if (dataset.length < 100) {
    console.error("WARNING: very few positions — increase --games for a meaningful fit.");
  }

  // Train/test split: tune on train, then check whether the improvement
  // GENERALIZES to held-out positions (vs. just overfitting the train set).
  const split = Math.floor(dataset.length * 0.8);
  const train = dataset.slice(0, split);
  const test = dataset.slice(split);

  const tuned = tunePieceValues(train, { regularization: options.reg });
  console.error(`Regularization (L2 toward priors): ${options.reg}`);
  report(tuned, train.length, match);

  if (test.length > 50) {
    const baseK = findOptimalK(test, DEFAULT_TUNABLE_VALUES).k;
    const tunedK = findOptimalK(test, tuned.values).k;
    const baseTestLoss = texelLoss(test, DEFAULT_TUNABLE_VALUES, baseK);
    const tunedTestLoss = texelLoss(test, tuned.values, tunedK);
    const generalizes = tunedTestLoss < baseTestLoss;
    console.log("\n=== Held-out generalization (the ship/no-ship test) ===");
    console.log(`  test positions: ${test.length}`);
    console.log(`  baseline test loss: ${baseTestLoss.toFixed(6)}`);
    console.log(`  tuned    test loss: ${tunedTestLoss.toFixed(6)}`);
    console.log(`  → tuned ${generalizes ? "GENERALIZES (improves held-out)" : "does NOT generalize (overfit) — do not ship"}`);
  }

  if (options.out) {
    writeFileSync(options.out, JSON.stringify({ tuned, datasetSize: dataset.length }, null, 2));
    console.log(`\nWrote tuning result to ${options.out}`);
  }
} finally {
  await a.engine.close?.();
  await b.engine.close?.();
}

function report(tuned, datasetSize, match) {
  const order = [PIECES.ROOK, PIECES.CANNON, PIECES.HORSE, PIECES.ADVISOR, PIECES.ELEPHANT, PIECES.PAWN];
  const start = { rook: 900, cannon: 470, horse: 430, advisor: 120, elephant: 120, pawn: 90 };

  console.log("\n=== Texel tuning result ===");
  console.log(`Dataset: ${datasetSize} positions | K=${tuned.k}`);
  console.log(`Loss: ${tuned.startLoss.toFixed(6)} → ${tuned.loss.toFixed(6)} (Δ ${tuned.improvement.toFixed(6)})`);
  console.log("");
  console.log("Piece     start →  tuned   (start/pawn → tuned/pawn)");
  const pawn = tuned.values[PIECES.PAWN];
  for (const type of order) {
    const s = start[type];
    const t = tuned.values[type];
    const sr = (s / start.pawn).toFixed(2);
    const tr = (t / pawn).toFixed(2);
    const arrow = t > s ? "↑" : t < s ? "↓" : "=";
    console.log(`  ${type.padEnd(9)} ${String(s).padStart(4)} → ${String(t).padStart(5)} ${arrow}   (${sr} → ${tr})`);
  }
  console.log("");
  console.log("Native kPieceValues port {Empty,King,Advisor,Elephant,Horse,Rook,Cannon,Pawn}:");
  // Scale tuned values to the native Rook=1000 convention for a direct port.
  const scale = 1000 / tuned.values[PIECES.ROOK];
  const sc = (type) => Math.round(tuned.values[type] * scale);
  console.log(
    `  {0, 20000, ${sc(PIECES.ADVISOR)}, ${sc(PIECES.ELEPHANT)}, ${sc(PIECES.HORSE)}, ` +
      `1000, ${sc(PIECES.CANNON)}, ${sc(PIECES.PAWN)}}`
  );
}

function createEngine(label, spec, options) {
  const name = String(spec ?? "").trim().toLowerCase();
  if (name === "" || name === "js" || name === "javascript") {
    return { id: `${label}-js`, name: `${label}:JS`, engine: createJavaScriptEngineBackend({ profile: "fast" }) };
  }
  const isPreset = name === "local-cpp" || name === "pikafish";
  return {
    id: `${label}-${name}`,
    name: `${label}:${spec}`,
    engine: createLearningEngineBackend({
      ...(isPreset ? { nativePreset: name } : { command: spec }),
      protocol: "uci",
      fallbackOnNativeError: false
    })
  };
}

function parseArgs(args) {
  const options = {
    engine: "local-cpp",
    games: 40,
    time: 100,
    maxPlies: 160,
    openingPlies: 6,
    minPly: 10,
    seed: 1,
    reg: 0.02
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") return { ...options, help: true };
    else if (arg === "--engine") options.engine = args[++i];
    else if (arg === "--games") options.games = Number(args[++i]);
    else if (arg === "--time") options.time = Number(args[++i]);
    else if (arg === "--plies") options.maxPlies = Number(args[++i]);
    else if (arg === "--opening-plies") options.openingPlies = Number(args[++i]);
    else if (arg === "--min-ply") options.minPly = Number(args[++i]);
    else if (arg === "--seed") options.seed = Number(args[++i]);
    else if (arg === "--reg") options.reg = Number(args[++i]);
    else if (arg === "--out") options.out = args[++i];
    else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

function printUsage() {
  console.log(`Usage: node examples/tune.mjs [options]

Generates self-play games, then Texel-tunes piece values against the game
results (minimizing logistic loss). Prints tuned values and a native-engine
port line. Validate the result with an A/B match before committing.

Options:
  --engine SPEC   js | local-cpp | pikafish | <command>  (default: local-cpp)
  --games N       Self-play games to generate (default: 40)
  --time MS       Movetime per move for data generation (default: 100)
  --plies N       Max plies per game (default: 160)
  --opening-plies N  Random opening plies for variety (default: 6)
  --min-ply N     Drop positions before this ply (default: 10)
  --seed N        Opening-suite seed (default: 1)
  --out FILE      Write the tuning result as JSON

Example:
  node examples/tune.mjs --engine local-cpp --games 60 --time 100 --out tune.json
`);
}
