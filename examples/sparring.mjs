#!/usr/bin/env node
import {
  createJavaScriptEngineBackend,
  createLearningEngineBackend,
  formatSparringReport,
  runSparringMatch
} from "../src/index.js";

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  console.error("");
  printUsage();
  process.exit(1);
}

if (options.help) {
  printUsage();
  process.exit(0);
}

const red = createBackend("red", options);
const black = createBackend("black", options);

try {
  const report = await runSparringMatch({ red, black }, {
    maxPlies: options.maxPlies,
    initialFen: options.initialFen,
    searchOptions: {
      depth: options.depth,
      timeLimitMs: options.timeLimitMs,
      useBook: options.useBook
    }
  });

  console.log(formatSparringReport(report, { maxMoves: options.maxMoves }));
  console.log("");
  console.log(`Final FEN: ${report.finalFen}`);
} finally {
  await red.engine.close?.();
  await black.engine.close?.();
}

function createBackend(side, options) {
  const command = side === "red"
    ? options.redCommand ?? options.nativeCommand
    : options.blackCommand ?? options.nativeCommand;

  if (!command) {
    return {
      id: `${side}-js`,
      name: `${capitalize(side)} JS`,
      engine: createJavaScriptEngineBackend({
        profile: "fast",
        depth: options.depth,
        timeLimitMs: options.timeLimitMs
      })
    };
  }

  return {
    id: `${side}-native`,
    name: `${capitalize(side)} Native`,
    engine: createLearningEngineBackend({
      command,
      args: side === "red" ? options.redArgs : options.blackArgs,
      profile: options.protocol === "uci" ? "native-uci" : "native-ucci",
      protocol: options.protocol,
      depth: options.nativeDepth ?? options.depth,
      timeLimitMs: options.nativeTimeLimitMs ?? options.timeLimitMs,
      javascript: {
        profile: "fast",
        depth: options.depth,
        timeLimitMs: options.timeLimitMs
      }
    })
  };
}

function parseArgs(args) {
  const options = {
    depth: 1,
    timeLimitMs: 500,
    maxPlies: 20,
    maxMoves: 40,
    useBook: true,
    protocol: "ucci",
    nativeCommand: process.env.XIANGQI_ENGINE_COMMAND,
    redCommand: process.env.XIANGQI_RED_ENGINE_COMMAND,
    blackCommand: process.env.XIANGQI_BLACK_ENGINE_COMMAND,
    redArgs: splitEnvArgs(process.env.XIANGQI_RED_ENGINE_ARGS ?? process.env.XIANGQI_ENGINE_ARGS),
    blackArgs: splitEnvArgs(process.env.XIANGQI_BLACK_ENGINE_ARGS ?? process.env.XIANGQI_ENGINE_ARGS)
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--no-book") {
      options.useBook = false;
      continue;
    }
    if (arg === "--depth") {
      options.depth = Number(args[++index]);
      continue;
    }
    if (arg === "--native-depth") {
      options.nativeDepth = Number(args[++index]);
      continue;
    }
    if (arg === "--time") {
      options.timeLimitMs = Number(args[++index]);
      continue;
    }
    if (arg === "--native-time") {
      options.nativeTimeLimitMs = Number(args[++index]);
      continue;
    }
    if (arg === "--plies") {
      options.maxPlies = Number(args[++index]);
      continue;
    }
    if (arg === "--moves") {
      options.maxMoves = Number(args[++index]);
      continue;
    }
    if (arg === "--fen") {
      options.initialFen = args[++index];
      continue;
    }
    if (arg === "--native-command") {
      options.nativeCommand = args[++index];
      continue;
    }
    if (arg === "--red-command") {
      options.redCommand = args[++index];
      continue;
    }
    if (arg === "--black-command") {
      options.blackCommand = args[++index];
      continue;
    }
    if (arg === "--protocol") {
      options.protocol = args[++index];
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  assertPositiveInteger(options.depth, "depth");
  assertPositiveInteger(options.timeLimitMs, "time");
  assertNonNegativeInteger(options.maxPlies, "plies");
  assertNonNegativeInteger(options.maxMoves, "moves");
  if (options.protocol !== "uci" && options.protocol !== "ucci") {
    throw new Error("--protocol must be uci or ucci.");
  }

  return options;
}

function assertPositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--${name} must be a positive integer.`);
  }
}

function assertNonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`--${name} must be a non-negative integer.`);
  }
}

function splitEnvArgs(value) {
  return value?.trim() ? value.trim().split(/\s+/) : [];
}

function printUsage() {
  console.log(`Usage: node examples/sparring.mjs [options]

Runs a local engine-vs-engine Xiangqi sparring match and prints each move's
decision summary.

Options:
  --plies N              Maximum plies to play (default: 20)
  --depth N              JavaScript search depth (default: 1)
  --time MS              JavaScript movetime in ms (default: 500)
  --no-book              Disable opening-book moves
  --fen FEN              Start from a custom FEN
  --native-command CMD   Use the same native UCI/UCCI command for both sides
  --red-command CMD      Use a native command only for Red
  --black-command CMD    Use a native command only for Black
  --protocol uci|ucci    Native protocol (default: ucci)

Environment:
  XIANGQI_ENGINE_COMMAND, XIANGQI_RED_ENGINE_COMMAND, XIANGQI_BLACK_ENGINE_COMMAND
`);
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
