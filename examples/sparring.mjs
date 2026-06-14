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
            timeLimitMs: options.refereeTimeLimitMs
          }
        }
      : undefined,
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
  await referee?.engine.close?.();
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
      engineOptions: engineOptionsFor(side, options),
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

function createRefereeBackend(options) {
  const command = options.refereeCommand;
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
      args: options.refereeArgs,
      engineOptions: engineOptionsFor("referee", options),
      profile: options.refereeProtocol === "uci" ? "native-uci" : "native-ucci",
      protocol: options.refereeProtocol,
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
    maxPlies: 20,
    maxMoves: 40,
    useBook: true,
    protocol: "ucci",
    nativeCommand: process.env.XIANGQI_ENGINE_COMMAND,
    redCommand: process.env.XIANGQI_RED_ENGINE_COMMAND,
    blackCommand: process.env.XIANGQI_BLACK_ENGINE_COMMAND,
    referee: Boolean(process.env.XIANGQI_REFEREE_ENGINE_COMMAND),
    refereeCommand: process.env.XIANGQI_REFEREE_ENGINE_COMMAND,
    refereeProtocol: process.env.XIANGQI_REFEREE_ENGINE_PROTOCOL ?? "ucci",
    redArgs: splitEnvArgs(process.env.XIANGQI_RED_ENGINE_ARGS ?? process.env.XIANGQI_ENGINE_ARGS),
    blackArgs: splitEnvArgs(process.env.XIANGQI_BLACK_ENGINE_ARGS ?? process.env.XIANGQI_ENGINE_ARGS),
    refereeArgs: splitEnvArgs(process.env.XIANGQI_REFEREE_ENGINE_ARGS),
    nativeOptions: parseEngineOptions(process.env.XIANGQI_ENGINE_OPTIONS, "XIANGQI_ENGINE_OPTIONS"),
    redOptions: parseEngineOptions(process.env.XIANGQI_RED_ENGINE_OPTIONS, "XIANGQI_RED_ENGINE_OPTIONS"),
    blackOptions: parseEngineOptions(process.env.XIANGQI_BLACK_ENGINE_OPTIONS, "XIANGQI_BLACK_ENGINE_OPTIONS"),
    refereeOptions: parseEngineOptions(process.env.XIANGQI_REFEREE_ENGINE_OPTIONS, "XIANGQI_REFEREE_ENGINE_OPTIONS")
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
      options.nativeOptions.push(parseEngineOption(args[++index], "--native-option"));
      continue;
    }
    if (arg === "--red-option") {
      options.redOptions.push(parseEngineOption(args[++index], "--red-option"));
      continue;
    }
    if (arg === "--black-option") {
      options.blackOptions.push(parseEngineOption(args[++index], "--black-option"));
      continue;
    }
    if (arg === "--referee-option") {
      options.refereeOptions.push(parseEngineOption(args[++index], "--referee-option"));
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
    if (arg === "--referee-depth") {
      options.refereeDepth = Number(args[++index]);
      options.referee = true;
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
    if (arg === "--referee-time") {
      options.refereeTimeLimitMs = Number(args[++index]);
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
    if (arg === "--referee-protocol") {
      options.refereeProtocol = args[++index];
      options.referee = true;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  options.refereeDepth ??= options.nativeDepth ?? Math.max(options.depth, 2);
  options.refereeTimeLimitMs ??= options.nativeTimeLimitMs ?? Math.max(options.timeLimitMs, 1000);

  assertPositiveInteger(options.depth, "depth");
  assertPositiveInteger(options.timeLimitMs, "time");
  assertPositiveInteger(options.refereeDepth, "referee-depth");
  assertPositiveInteger(options.refereeTimeLimitMs, "referee-time");
  assertNonNegativeInteger(options.maxPlies, "plies");
  assertNonNegativeInteger(options.maxMoves, "moves");
  if (options.protocol !== "uci" && options.protocol !== "ucci") {
    throw new Error("--protocol must be uci or ucci.");
  }
  if (options.refereeProtocol !== "uci" && options.refereeProtocol !== "ucci") {
    throw new Error("--referee-protocol must be uci or ucci.");
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

function engineOptionsFor(side, options) {
  const sideOptions = side === "red"
    ? options.redOptions
    : side === "black"
      ? options.blackOptions
      : options.refereeOptions;
  return [...options.nativeOptions, ...sideOptions];
}

function parseEngineOptions(value, source) {
  if (!value?.trim()) return [];
  const text = value.trim();

  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      return jsonEngineOptions(JSON.parse(text), source);
    } catch (error) {
      throw new Error(`${source} must be JSON engine options or comma-separated name=value entries: ${error.message}`);
    }
  }

  return text
    .split(/[,\n;]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => parseEngineOption(entry, source));
}

function jsonEngineOptions(value, source) {
  if (Array.isArray(value)) {
    return value.map((entry, index) => normalizeJsonEngineOption(entry, `${source}[${index}]`));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).map(([name, optionValue]) => ({ name, value: optionValue }));
  }

  throw new Error(`${source} must be an object or array.`);
}

function normalizeJsonEngineOption(entry, source) {
  if (typeof entry === "string") return { name: entry, value: null };
  if (Array.isArray(entry)) {
    const [name, value = null] = entry;
    return { name: assertEngineOptionName(name, source), value };
  }
  if (entry && typeof entry === "object") {
    return {
      name: assertEngineOptionName(entry.name ?? entry.key ?? entry.option, source),
      value: Object.prototype.hasOwnProperty.call(entry, "value") ? entry.value : null
    };
  }

  throw new Error(`${source} must be a string, [name, value], or { name, value } entry.`);
}

function parseEngineOption(text, source) {
  if (!text) throw new Error(`${source} requires an option name.`);
  const separatorIndex = text.indexOf("=");
  const name = separatorIndex === -1 ? text : text.slice(0, separatorIndex);
  const value = separatorIndex === -1 ? null : parseEngineOptionValue(text.slice(separatorIndex + 1));
  return { name: assertEngineOptionName(name, source), value };
}

function assertEngineOptionName(name, source) {
  if (typeof name !== "string" && typeof name !== "number") {
    throw new Error(`${source} requires an option name.`);
  }

  const normalized = String(name).trim();
  if (!normalized) throw new Error(`${source} requires an option name.`);
  return normalized;
}

function parseEngineOptionValue(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase() === "true";
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed;
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
  --referee              Review moves with a JS referee after the match
  --referee-depth N      Referee review depth (default: max(depth, 2))
  --referee-time MS      Referee review movetime (default: max(time, 1000))
  --fen FEN              Start from a custom FEN
  --native-command CMD   Use the same native UCI/UCCI command for both sides
  --red-command CMD      Use a native command only for Red
  --black-command CMD    Use a native command only for Black
  --referee-command CMD  Use a native UCI/UCCI command as the referee
  --protocol uci|ucci    Native protocol (default: ucci)
  --referee-protocol P   Referee protocol, uci or ucci (default: ucci)
  --native-option OPT    Set a native option for all native backends (name=value)
  --red-option OPT       Set a Red native option, after --native-option values
  --black-option OPT     Set a Black native option, after --native-option values
  --referee-option OPT   Set a referee native option, after --native-option values

Environment:
  XIANGQI_ENGINE_COMMAND, XIANGQI_RED_ENGINE_COMMAND, XIANGQI_BLACK_ENGINE_COMMAND,
  XIANGQI_REFEREE_ENGINE_COMMAND, XIANGQI_ENGINE_OPTIONS,
  XIANGQI_RED_ENGINE_OPTIONS, XIANGQI_BLACK_ENGINE_OPTIONS,
  XIANGQI_REFEREE_ENGINE_OPTIONS
`);
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
