#!/usr/bin/env node
import {
  createUcciEngineBackend,
  formatOracleOpeningBookReport,
  generateOracleOpeningBookRecords
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

if (!options.command) {
  console.error("Oracle opening generation requires --command, XIANGQI_ORACLE_ENGINE_COMMAND, or XIANGQI_ENGINE_COMMAND.");
  console.error("");
  printUsage();
  process.exit(1);
}

const oracle = createUcciEngineBackend({
  name: options.source,
  command: options.command,
  args: options.args,
  protocol: options.protocol,
  depth: options.depth,
  timeLimitMs: options.timeLimitMs,
  startupTimeoutMs: options.startupTimeoutMs,
  commandTimeoutMs: options.commandTimeoutMs,
  engineOptions: options.engineOptions
});

try {
  const report = await generateOracleOpeningBookRecords(oracle, {
    plies: options.plies,
    lines: options.lines,
    source: options.source,
    initialFen: options.initialFen,
    includeBook: false,
    searchOptions: {
      depth: options.depth,
      timeLimitMs: options.timeLimitMs
    }
  });

  if (options.recordsOnly) {
    console.log(JSON.stringify(report.records, null, 2));
  } else if (options.json) {
    console.log(JSON.stringify({
      ...report,
      book: undefined
    }, null, 2));
  } else {
    console.log(formatOracleOpeningBookReport(report, {
      maxRecords: options.maxRecords
    }));
  }
} finally {
  await oracle.close();
}

function parseArgs(args) {
  const options = {
    command: process.env.XIANGQI_ORACLE_ENGINE_COMMAND ?? process.env.XIANGQI_ENGINE_COMMAND,
    args: splitEnvArgs(process.env.XIANGQI_ORACLE_ENGINE_ARGS ?? process.env.XIANGQI_ENGINE_ARGS),
    protocol: process.env.XIANGQI_ORACLE_ENGINE_PROTOCOL ?? process.env.XIANGQI_ENGINE_PROTOCOL ?? "uci",
    engineOptions: parseNativeEngineOptions(
      process.env.XIANGQI_ORACLE_ENGINE_OPTIONS ?? process.env.XIANGQI_ENGINE_OPTIONS,
      "XIANGQI_ORACLE_ENGINE_OPTIONS"
    ),
    source: process.env.XIANGQI_ORACLE_SOURCE ?? "Native Oracle",
    plies: numberFromEnv(process.env.XIANGQI_ORACLE_OPENING_PLIES, 12),
    lines: numberFromEnv(process.env.XIANGQI_ORACLE_LINES, 3),
    depth: numberFromEnv(process.env.XIANGQI_ORACLE_DEPTH, 6),
    timeLimitMs: numberFromEnv(process.env.XIANGQI_ORACLE_TIME_MS, 2000),
    startupTimeoutMs: numberFromEnv(process.env.XIANGQI_ORACLE_STARTUP_TIMEOUT_MS, 5000),
    commandTimeoutMs: numberFromEnv(process.env.XIANGQI_ORACLE_COMMAND_TIMEOUT_MS, 30000),
    initialFen: process.env.XIANGQI_ORACLE_INITIAL_FEN,
    maxRecords: 20,
    json: false,
    recordsOnly: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--records-only") {
      options.recordsOnly = true;
      options.json = true;
      continue;
    }
    if (arg === "--command") {
      options.command = args[++index];
      continue;
    }
    if (arg === "--arg") {
      options.args.push(args[++index]);
      continue;
    }
    if (arg === "--args") {
      options.args.push(...splitEnvArgs(args[++index]));
      continue;
    }
    if (arg === "--protocol") {
      options.protocol = args[++index];
      continue;
    }
    if (arg === "--option") {
      options.engineOptions.push(parseNativeEngineOption(args[++index], "--option"));
      continue;
    }
    if (arg === "--source") {
      options.source = args[++index];
      continue;
    }
    if (arg === "--plies") {
      options.plies = Number(args[++index]);
      continue;
    }
    if (arg === "--lines") {
      options.lines = Number(args[++index]);
      continue;
    }
    if (arg === "--depth") {
      options.depth = Number(args[++index]);
      continue;
    }
    if (arg === "--time") {
      options.timeLimitMs = Number(args[++index]);
      continue;
    }
    if (arg === "--fen") {
      options.initialFen = args[++index];
      continue;
    }
    if (arg === "--max-records") {
      options.maxRecords = Number(args[++index]);
      continue;
    }
    if (arg === "--startup-timeout") {
      options.startupTimeoutMs = Number(args[++index]);
      continue;
    }
    if (arg === "--command-timeout") {
      options.commandTimeoutMs = Number(args[++index]);
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  assertProtocol(options.protocol);
  assertPositiveInteger(options.plies, "plies");
  assertPositiveInteger(options.lines, "lines");
  assertPositiveInteger(options.depth, "depth");
  assertPositiveInteger(options.timeLimitMs, "time");
  assertPositiveInteger(options.maxRecords, "max-records");
  assertPositiveInteger(options.startupTimeoutMs, "startup-timeout");
  assertPositiveInteger(options.commandTimeoutMs, "command-timeout");
  return options;
}

function numberFromEnv(value, fallback) {
  if (value === undefined || value === "") return fallback;
  return Number(value);
}

function assertProtocol(value) {
  if (value !== "uci" && value !== "ucci") {
    throw new Error("--protocol must be uci or ucci.");
  }
}

function assertPositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--${name} must be a positive integer.`);
  }
}

function printUsage() {
  console.log(`Usage: node examples/oracle-opening.mjs [options]

Generates structured opening-book records by following a native oracle's best
line for the first N plies and recording MultiPV alternatives at each visited
position. The JSON records can be passed to createOpeningBookFromRecords.

Options:
  --command CMD        Native UCI/UCCI executable
  --arg VALUE          Append one native process argument
  --args VALUES        Append whitespace-separated native process arguments
  --protocol uci|ucci  Native protocol (default: uci)
  --option OPT         Set a native option (name=value or button name)
  --source NAME        Source label written into generated records
  --plies N            Main-line plies to follow (default: 12)
  --lines N            MultiPV candidates per position (default: 3)
  --depth N            Oracle search depth (default: 6)
  --time MS            Oracle movetime in ms (default: 2000)
  --fen FEN            Start from a custom FEN
  --json               Print full machine-readable report
  --records-only       Print only the importable records array

Environment:
  XIANGQI_ORACLE_ENGINE_COMMAND, XIANGQI_ORACLE_ENGINE_ARGS,
  XIANGQI_ORACLE_ENGINE_PROTOCOL, XIANGQI_ORACLE_ENGINE_OPTIONS,
  XIANGQI_ORACLE_OPENING_PLIES, XIANGQI_ORACLE_LINES,
  XIANGQI_ORACLE_DEPTH, XIANGQI_ORACLE_TIME_MS
`);
}
