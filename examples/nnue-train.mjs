#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import {
  DEFAULT_TUNABLE_VALUES,
  buildTuningDataset,
  createJavaScriptEngineBackend,
  createLearningEngineBackend,
  createNnueNetwork,
  findOptimalK,
  nnueLoss,
  runEngineMatch,
  serializeNnue,
  serializeNnueText,
  texelLoss,
  trainNnue
} from "../src/index.js";

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

let a = null;
let b = null;

try {
  let rawPositions;
  if (options.data) {
    rawPositions = JSON.parse(readFileSync(options.data, "utf8"));
    console.error(`Loaded ${rawPositions.length} raw positions from ${options.data} (skipping self-play)`);
  } else {
    a = createEngine("genA", options.engine, options);
    b = createEngine("genB", options.engine, options);
    console.error(`Generating self-play data: ${options.games} games of ${options.engine} @ ${options.time}ms ...`);
    const match = await runEngineMatch(a, b, {
      games: options.games,
      maxPlies: options.maxPlies,
      openingPlies: options.openingPlies,
      seed: options.seed,
      searchOptions: { timeLimitMs: options.time, useBook: false },
      collectPositions: true
    });
    console.error(`Games: A ${match.tally.winsA}/B ${match.tally.winsB}/draws ${match.tally.draws} — raw ${match.positions.length}`);
    rawPositions = match.positions;
    if (options.saveData) {
      writeFileSync(options.saveData, JSON.stringify(rawPositions));
      console.error(`Saved raw positions to ${options.saveData}`);
    }
  }

  const dataset = buildTuningDataset(rawPositions, { minPly: options.minPly });
  console.error(`Dataset (quiet, deduped): ${dataset.length} positions`);
  if (dataset.length < 200) console.error("WARNING: small dataset; increase --games.");

  const split = Math.floor(dataset.length * 0.85);
  const train = dataset.slice(0, split);
  const test = dataset.slice(split);

  const net = createNnueNetwork({ hidden: options.hidden, seed: 7 });
  console.error(`Training NNUE (hidden=${options.hidden}, epochs=${options.epochs}) on ${train.length} positions ...`);
  const { finalLoss } = trainNnue(net, train, {
    epochs: options.epochs,
    lr: options.lr,
    l2: options.l2,
    batchSize: 128,
    onEpoch: (epoch, loss) => {
      if (epoch % 5 === 0 || epoch === options.epochs - 1) {
        process.stderr.write(`  epoch ${String(epoch).padStart(3)}  train-loss ${loss.toFixed(6)}\r`);
      }
    }
  });
  process.stderr.write("\n");

  // The viability test: does the LEARNED eval predict held-out results better
  // than a tuned material-only baseline? If yes, the NNUE path is worth scaling.
  const nnueTest = nnueLoss(net, test);
  const matK = findOptimalK(test, DEFAULT_TUNABLE_VALUES).k;
  const materialTest = texelLoss(test, DEFAULT_TUNABLE_VALUES, matK);

  console.log("\n=== NNUE viability (held-out) ===");
  console.log(`  train positions: ${train.length}   test positions: ${test.length}`);
  console.log(`  NNUE train loss:     ${finalLoss.toFixed(6)}`);
  console.log(`  NNUE  test loss:     ${nnueTest.toFixed(6)}`);
  console.log(`  material test loss:  ${materialTest.toFixed(6)}`);
  const better = nnueTest < materialTest;
  console.log(`  → learned eval ${better ? "BEATS" : "does NOT beat"} material-only on held-out data` +
    ` (${better ? "" : "needs more data/capacity"})`);

  const outFile = options.out ?? "nnue-weights.json";
  writeFileSync(outFile, serializeNnue(net));
  const textFile = outFile.replace(/\.json$/, "") + ".txt";
  writeFileSync(textFile, serializeNnueText(net));
  console.log(`\nWrote weights to ${outFile} and ${textFile} (${net.inputSize}→${net.hidden}→1)`);
} finally {
  await a?.engine.close?.();
  await b?.engine.close?.();
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
    games: 60,
    time: 50,
    maxPlies: 160,
    openingPlies: 6,
    minPly: 10,
    seed: 1,
    hidden: 32,
    epochs: 40,
    lr: 0.05,
    l2: 1e-7
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
    else if (arg === "--hidden") options.hidden = Number(args[++i]);
    else if (arg === "--epochs") options.epochs = Number(args[++i]);
    else if (arg === "--lr") options.lr = Number(args[++i]);
    else if (arg === "--l2") options.l2 = Number(args[++i]);
    else if (arg === "--out") options.out = args[++i];
    else if (arg === "--save-data") options.saveData = args[++i];
    else if (arg === "--data") options.data = args[++i];
    else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

function printUsage() {
  console.log(`Usage: node examples/nnue-train.mjs [options]

Generates self-play data, trains a small NNUE-style network to predict game
results, and reports whether the LEARNED eval beats a tuned material-only
baseline on held-out positions. Exports weights as JSON.

Options:
  --engine SPEC   js | local-cpp | pikafish | <command>  (default: local-cpp)
  --games N       Self-play games (default: 60)
  --time MS       Movetime for data generation (default: 50)
  --hidden N      Hidden-layer width (default: 32)
  --epochs N      Training epochs (default: 40)
  --lr F          Learning rate (default: 0.05)
  --min-ply N     Drop positions before this ply (default: 10)
  --out FILE      Weights output (default: nnue-weights.json)

Example:
  node examples/nnue-train.mjs --engine local-cpp --games 80 --hidden 32 --epochs 60
`);
}
