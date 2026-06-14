#!/usr/bin/env node
import {
  createJavaScriptEngineBackend,
  createLearningEngineBackend,
  formatSparringReport,
  resolveNativeEnginePreset,
  runSparringMatch
} from "../src/index.js";
import {
  parseNativeEngineOption,
  parseNativeEngineOptions,
  splitEnvArgs
} from "./native-cli-options.mjs";

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
const referee = createRefereeBackend(options);

try {
  const report = await runSparringMatch({ red, black }, {
    maxPlies: options.maxPlies,
    initialFen: options.initialFen,
    referee,
    refereeOptions: referee
      ? {
          reviewOptions: {
            depth: options.refereeDepth,
            timeLimitMs: options.refereeTimeLimitMs,
            lines: options.refereeLines
          }
        }
      : undefined,
    searchOptions: {
      depth: options.depth,
      timeLimitMs: options.timeLimitMs,
      lines: options.lines,
      useBook: options.useBook
    },
    redSearchOptions: {
      depth: searchDepthFor("red", options, hasNativeCommand("red", options)),
      timeLimitMs: searchTimeFor("red", options, hasNativeCommand("red", options)),
      lines: options.lines
    },
    blackSearchOptions: {
      depth: searchDepthFor("black", options, hasNativeCommand("black", options)),
      timeLimitMs: searchTimeFor("black", options, hasNativeCommand("black", options)),
      lines: options.lines
    }
  });

  console.log(formatSparringReport(report, { maxMoves: options.maxMoves }));
  console.log("");
  console.log(`Final FEN: ${report.finalFen}`);
} finally {
  await red.engine.close?.();
  await black.engine.close?.();
  await referee?.engine.close?.();
}

function createBackend(side, options) {
  const preset = resolvePresetForSide(side, options);
  const command = side === "red"
    ? options.redCommand ?? options.nativeCommand ?? preset?.command
    : options.blackCommand ?? options.nativeCommand ?? preset?.command;
  const depth = searchDepthFor(side, options, Boolean(command));
  const timeLimitMs = searchTimeFor(side, options, Boolean(command));

  if (!command) {
    return {
      id: `${side}-js`,
      name: `${capitalize(side)} JS`,
      searchOptions: {
        depth,
        timeLimitMs
      },
      engine: createJavaScriptEngineBackend({
        profile: "fast",
        depth,
        timeLimitMs
      })
    };
  }

  const protocol = protocolFor(side, options);
  return {
    id: `${side}-native`,
    name: `${capitalize(side)} Native`,
    searchOptions: {
      depth,
      timeLimitMs
    },
    engine: createLearningEngineBackend({
      command,
      args: side === "red" ? nonEmptyArgs(options.redArgs, preset?.args) : nonEmptyArgs(options.blackArgs, preset?.args),
      engineOptions: engineOptionsFor(side, options),
      profile: protocol === "uci" ? "native-uci" : "native-ucci",
      protocol,
      depth,
      timeLimitMs,
      javascript: {
        profile: "fast",
        depth: searchDepthFor(side, options, false),
        timeLimitMs: searchTimeFor(side, options, false)
      }
    })
  };
}

function createRefereeBackend(options) {
  const preset = resolvePresetForSide("referee", options);
  const command = options.refereeCommand ?? preset?.command;
  if (!options.referee && !command) return null;

  if (!command) {
    return {
      id: "referee-js",
      name: "Referee JS",
      engine: createJavaScriptEngineBackend({
        profile: "balanced",
        depth: options.refereeDepth,
        timeLimitMs: options.refereeTimeLimitMs
      })
    };
  }

  return {
    id: "referee-native",
    name: "Referee Native",
    engine: createLearningEngineBackend({
      command,
      args: nonEmptyArgs(options.refereeArgs, preset?.args),
      engineOptions: engineOptionsFor("referee", options),
      profile: protocolFor("referee", options) === "uci" ? "native-uci" : "native-ucci",
      protocol: protocolFor("referee", options),
      depth: options.refereeDepth,
      timeLimitMs: options.refereeTimeLimitMs,
      javascript: {
        profile: "balanced",
        depth: options.refereeDepth,
        timeLimitMs: options.refereeTimeLimitMs
      }
    })
  };
}

function parseArgs(args) {
  const options = {
    depth: 1,
    timeLimitMs: 500,
    lines: numberFromEnv(process.env.XIANGQI_ENGINE_LINES, 3),
    maxPlies: 20,
    maxMoves: 40,
    useBook: true,
    protocol: process.env.XIANGQI_ENGINE_PROTOCOL,
    nativePreset: process.env.XIANGQI_ENGINE_PRESET,
    redPreset: process.env.XIANGQI_RED_ENGINE_PRESET,
    blackPreset: process.env.XIANGQI_BLACK_ENGINE_PRESET,
    refereePreset: process.env.XIANGQI_REFEREE_ENGINE_PRESET,
    nativeEvalFile: process.env.XIANGQI_ENGINE_EVAL_FILE,
    redEvalFile: process.env.XIANGQI_RED_ENGINE_EVAL_FILE,
    blackEvalFile: process.env.XIANGQI_BLACK_ENGINE_EVAL_FILE,
    refereeEvalFile: process.env.XIANGQI_REFEREE_ENGINE_EVAL_FILE,
    redProtocol: process.env.XIANGQI_RED_ENGINE_PROTOCOL,
    blackProtocol: process.env.XIANGQI_BLACK_ENGINE_PROTOCOL,
    nativeCommand: process.env.XIANGQI_ENGINE_COMMAND,
    redCommand: process.env.XIANGQI_RED_ENGINE_COMMAND,
    blackCommand: process.env.XIANGQI_BLACK_ENGINE_COMMAND,
    referee: Boolean(process.env.XIANGQI_REFEREE_ENGINE_COMMAND),
    refereeCommand: process.env.XIANGQI_REFEREE_ENGINE_COMMAND,
    refereeProtocol: process.env.XIANGQI_REFEREE_ENGINE_PROTOCOL,
    redArgs: splitEnvArgs(process.env.XIANGQI_RED_ENGINE_ARGS ?? process.env.XIANGQI_ENGINE_ARGS),
    blackArgs: splitEnvArgs(process.env.XIANGQI_BLACK_ENGINE_ARGS ?? process.env.XIANGQI_ENGINE_ARGS),
    refereeArgs: splitEnvArgs(process.env.XIANGQI_REFEREE_ENGINE_ARGS),
    nativeOptions: parseNativeEngineOptions(process.env.XIANGQI_ENGINE_OPTIONS, "XIANGQI_ENGINE_OPTIONS"),
    redOptions: parseNativeEngineOptions(process.env.XIANGQI_RED_ENGINE_OPTIONS, "XIANGQI_RED_ENGINE_OPTIONS"),
    blackOptions: parseNativeEngineOptions(process.env.XIANGQI_BLACK_ENGINE_OPTIONS, "XIANGQI_BLACK_ENGINE_OPTIONS"),
    refereeOptions: parseNativeEngineOptions(process.env.XIANGQI_REFEREE_ENGINE_OPTIONS, "XIANGQI_REFEREE_ENGINE_OPTIONS"),
    redDepth: numberFromEnv(process.env.XIANGQI_RED_DEPTH, undefined),
    blackDepth: numberFromEnv(process.env.XIANGQI_BLACK_DEPTH, undefined),
    redTimeLimitMs: numberFromEnv(process.env.XIANGQI_RED_TIME_MS, undefined),
    blackTimeLimitMs: numberFromEnv(process.env.XIANGQI_BLACK_TIME_MS, undefined),
    refereeLines: numberFromEnv(process.env.XIANGQI_REFEREE_LINES, undefined)
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
    if (arg === "--referee") {
      options.referee = true;
      continue;
    }
    if (arg === "--native-option") {
      options.nativeOptions.push(parseNativeEngineOption(args[++index], "--native-option"));
      continue;
    }
    if (arg === "--preset" || arg === "--native-preset") {
      options.nativePreset = args[++index];
      continue;
    }
    if (arg === "--red-preset") {
      options.redPreset = args[++index];
      continue;
    }
    if (arg === "--black-preset") {
      options.blackPreset = args[++index];
      continue;
    }
    if (arg === "--referee-preset") {
      options.refereePreset = args[++index];
      options.referee = true;
      continue;
    }
    if (arg === "--eval-file" || arg === "--native-eval-file") {
      options.nativeEvalFile = args[++index];
      continue;
    }
    if (arg === "--red-eval-file") {
      options.redEvalFile = args[++index];
      continue;
    }
    if (arg === "--black-eval-file") {
      options.blackEvalFile = args[++index];
      continue;
    }
    if (arg === "--referee-eval-file") {
      options.refereeEvalFile = args[++index];
      options.referee = true;
      continue;
    }
    if (arg === "--red-option") {
      options.redOptions.push(parseNativeEngineOption(args[++index], "--red-option"));
      continue;
    }
    if (arg === "--black-option") {
      options.blackOptions.push(parseNativeEngineOption(args[++index], "--black-option"));
      continue;
    }
    if (arg === "--referee-option") {
      options.refereeOptions.push(parseNativeEngineOption(args[++index], "--referee-option"));
      options.referee = true;
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
    if (arg === "--red-depth") {
      options.redDepth = Number(args[++index]);
      continue;
    }
    if (arg === "--black-depth") {
      options.blackDepth = Number(args[++index]);
      continue;
    }
    if (arg === "--referee-depth") {
      options.refereeDepth = Number(args[++index]);
      options.referee = true;
      continue;
    }
    if (arg === "--time") {
      options.timeLimitMs = Number(args[++index]);
      continue;
    }
    if (arg === "--lines") {
      options.lines = Number(args[++index]);
      continue;
    }
    if (arg === "--native-time") {
      options.nativeTimeLimitMs = Number(args[++index]);
      continue;
    }
    if (arg === "--red-time") {
      options.redTimeLimitMs = Number(args[++index]);
      continue;
    }
    if (arg === "--black-time") {
      options.blackTimeLimitMs = Number(args[++index]);
      continue;
    }
    if (arg === "--referee-time") {
      options.refereeTimeLimitMs = Number(args[++index]);
      options.referee = true;
      continue;
    }
    if (arg === "--referee-lines") {
      options.refereeLines = Number(args[++index]);
      options.referee = true;
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
    if (arg === "--referee-command") {
      options.refereeCommand = args[++index];
      options.referee = true;
      continue;
    }
    if (arg === "--protocol") {
      options.protocol = args[++index];
      continue;
    }
    if (arg === "--red-protocol") {
      options.redProtocol = args[++index];
      continue;
    }
    if (arg === "--black-protocol") {
      options.blackProtocol = args[++index];
      continue;
    }
    if (arg === "--referee-protocol") {
      options.refereeProtocol = args[++index];
      options.referee = true;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  options.refereeDepth ??= options.nativeDepth ?? Math.max(options.depth, 2);
  options.refereeTimeLimitMs ??= options.nativeTimeLimitMs ?? Math.max(options.timeLimitMs, 1000);
  options.refereeLines ??= options.lines;

  assertPositiveInteger(options.depth, "depth");
  assertPositiveInteger(options.timeLimitMs, "time");
  assertPositiveInteger(options.lines, "lines");
  assertOptionalPositiveInteger(options.nativeDepth, "native-depth");
  assertOptionalPositiveInteger(options.nativeTimeLimitMs, "native-time");
  assertOptionalPositiveInteger(options.redDepth, "red-depth");
  assertOptionalPositiveInteger(options.blackDepth, "black-depth");
  assertOptionalPositiveInteger(options.redTimeLimitMs, "red-time");
  assertOptionalPositiveInteger(options.blackTimeLimitMs, "black-time");
  assertPositiveInteger(options.refereeDepth, "referee-depth");
  assertPositiveInteger(options.refereeTimeLimitMs, "referee-time");
  assertPositiveInteger(options.refereeLines, "referee-lines");
  assertNonNegativeInteger(options.maxPlies, "plies");
  assertNonNegativeInteger(options.maxMoves, "moves");
  assertProtocol(options.protocol ?? "ucci", "protocol");
  assertOptionalProtocol(options.redProtocol, "red-protocol");
  assertOptionalProtocol(options.blackProtocol, "black-protocol");
  assertProtocol(options.refereeProtocol ?? "ucci", "referee-protocol");
  assertPresetResolved("red", options);
  assertPresetResolved("black", options);
  assertPresetResolved("referee", options);

  return options;
}

function numberFromEnv(value, fallback) {
  if (value === undefined || value === "") return fallback;
  return Number(value);
}

function assertPositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--${name} must be a positive integer.`);
  }
}

function assertOptionalPositiveInteger(value, name) {
  if (value !== undefined) {
    assertPositiveInteger(value, name);
  }
}

function assertNonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`--${name} must be a non-negative integer.`);
  }
}

function assertProtocol(value, name) {
  if (value !== "uci" && value !== "ucci") {
    throw new Error(`--${name} must be uci or ucci.`);
  }
}

function assertOptionalProtocol(value, name) {
  if (value !== undefined) {
    assertProtocol(value, name);
  }
}

function engineOptionsFor(side, options) {
  const preset = resolvePresetForSide(side, options);
  const sideOptions = side === "red"
    ? options.redOptions
    : side === "black"
      ? options.blackOptions
      : options.refereeOptions;
  return [...(preset?.engineOptions ?? []), ...options.nativeOptions, ...sideOptions];
}

function hasNativeCommand(side, options) {
  const preset = resolvePresetForSide(side, options);
  return Boolean(side === "red"
    ? options.redCommand ?? options.nativeCommand ?? preset?.command
    : options.blackCommand ?? options.nativeCommand ?? preset?.command);
}

function protocolFor(side, options) {
  const preset = resolvePresetForSide(side, options);
  if (side === "referee") return options.refereeProtocol ?? preset?.protocol ?? "ucci";
  return side === "red"
    ? options.redProtocol ?? options.protocol ?? preset?.protocol ?? "ucci"
    : options.blackProtocol ?? options.protocol ?? preset?.protocol ?? "ucci";
}

function searchDepthFor(side, options, native) {
  const sideDepth = side === "red" ? options.redDepth : options.blackDepth;
  if (sideDepth !== undefined) return sideDepth;
  if (native && options.nativeDepth !== undefined) return options.nativeDepth;
  return options.depth;
}

function searchTimeFor(side, options, native) {
  const sideTime = side === "red" ? options.redTimeLimitMs : options.blackTimeLimitMs;
  if (sideTime !== undefined) return sideTime;
  if (native && options.nativeTimeLimitMs !== undefined) return options.nativeTimeLimitMs;
  return options.timeLimitMs;
}

function printUsage() {
  console.log(`Usage: node examples/sparring.mjs [options]

Runs a local engine-vs-engine Xiangqi sparring match and prints each move's
decision summary.

Options:
  --plies N              Maximum plies to play (default: 20)
  --depth N              JavaScript search depth (default: 1)
  --time MS              JavaScript movetime in ms (default: 500)
  --lines N              Candidate lines to compare (default: 3)
  --red-depth N          Override Red search depth
  --black-depth N        Override Black search depth
  --red-time MS          Override Red movetime
  --black-time MS        Override Black movetime
  --no-book              Disable opening-book moves
  --referee              Review moves with a JS referee after the match
  --referee-depth N      Referee review depth (default: max(depth, 2))
  --referee-time MS      Referee review movetime (default: max(time, 1000))
  --referee-lines N      Referee candidate lines to compare (default: --lines)
  --fen FEN              Start from a custom FEN
  --native-command CMD   Use the same native UCI/UCCI command for both sides
  --red-command CMD      Use a native command only for Red
  --black-command CMD    Use a native command only for Black
  --referee-command CMD  Use a native UCI/UCCI command as the referee
  --protocol uci|ucci    Native protocol (default: ucci unless preset overrides)
  --red-protocol P       Red native protocol, uci or ucci
  --black-protocol P     Black native protocol, uci or ucci
  --referee-protocol P   Referee protocol, uci or ucci (default: ucci)
  --preset NAME          Apply a native preset to all native players, e.g. pikafish
  --red-preset NAME      Apply a native preset only to Red
  --black-preset NAME    Apply a native preset only to Black
  --referee-preset NAME  Apply a native preset to the referee
  --eval-file FILE       NNUE/eval file for presets that support one
  --red-eval-file FILE   Red NNUE/eval file override
  --black-eval-file FILE Black NNUE/eval file override
  --referee-eval-file F  Referee NNUE/eval file override
  --native-option OPT    Set a native option for all native backends (name=value)
  --red-option OPT       Set a Red native option, after --native-option values
  --black-option OPT     Set a Black native option, after --native-option values
  --referee-option OPT   Set a referee native option, after --native-option values

Environment:
  XIANGQI_ENGINE_COMMAND, XIANGQI_RED_ENGINE_COMMAND, XIANGQI_BLACK_ENGINE_COMMAND,
  XIANGQI_REFEREE_ENGINE_COMMAND, XIANGQI_ENGINE_PRESET,
  XIANGQI_RED_ENGINE_PRESET, XIANGQI_BLACK_ENGINE_PRESET,
  XIANGQI_REFEREE_ENGINE_PRESET, XIANGQI_ENGINE_EVAL_FILE,
  XIANGQI_ENGINE_OPTIONS,
  XIANGQI_RED_ENGINE_OPTIONS, XIANGQI_BLACK_ENGINE_OPTIONS,
  XIANGQI_RED_ENGINE_PROTOCOL, XIANGQI_BLACK_ENGINE_PROTOCOL,
  XIANGQI_RED_DEPTH, XIANGQI_BLACK_DEPTH, XIANGQI_RED_TIME_MS, XIANGQI_BLACK_TIME_MS,
  XIANGQI_ENGINE_LINES, XIANGQI_REFEREE_LINES, XIANGQI_REFEREE_ENGINE_OPTIONS
`);
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function resolvePresetForSide(side, options) {
  const presetName = side === "red"
    ? options.redPreset ?? options.nativePreset
    : side === "black"
      ? options.blackPreset ?? options.nativePreset
      : options.refereePreset;
  if (!presetName) return null;

  return resolveNativeEnginePreset(presetName, {
    command: commandForPresetSide(side, options),
    args: argsForPresetSide(side, options),
    protocol: protocolOverrideForPresetSide(side, options),
    evalFile: evalFileForPresetSide(side, options),
    engineOptions: [],
    env: process.env
  });
}

function assertPresetResolved(side, options) {
  const presetName = side === "red"
    ? options.redPreset ?? options.nativePreset
    : side === "black"
      ? options.blackPreset ?? options.nativePreset
      : options.refereePreset;
  if (!presetName) return;

  const preset = resolvePresetForSide(side, options);
  if (preset?.command) return;

  const flag = side === "referee" ? "--referee-preset" : `--${side}-preset`;
  const commandFlag = side === "referee" ? "--referee-command" : `--${side}-command`;
  throw new Error(`${flag} ${presetName} did not resolve a native command. Run npm run install:pikafish, or set ${commandFlag}, --native-command, XIANGQI_${side.toUpperCase()}_ENGINE_COMMAND, PIKAFISH_COMMAND, or PIKAFISH_HOME.`);
}

function commandForPresetSide(side, options) {
  if (side === "red") return options.redCommand ?? options.nativeCommand;
  if (side === "black") return options.blackCommand ?? options.nativeCommand;
  return options.refereeCommand;
}

function argsForPresetSide(side, options) {
  if (side === "red") return options.redArgs;
  if (side === "black") return options.blackArgs;
  return options.refereeArgs;
}

function protocolOverrideForPresetSide(side, options) {
  if (side === "red") return options.redProtocol ?? options.protocol;
  if (side === "black") return options.blackProtocol ?? options.protocol;
  return options.refereeProtocol;
}

function evalFileForPresetSide(side, options) {
  if (side === "red") return options.redEvalFile ?? options.nativeEvalFile;
  if (side === "black") return options.blackEvalFile ?? options.nativeEvalFile;
  return options.refereeEvalFile ?? options.nativeEvalFile;
}

function nonEmptyArgs(primary, fallback) {
  return primary.length > 0 ? primary : fallback ?? [];
}
