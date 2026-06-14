#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import {
  createBenchmarkSuite,
  compareEngineToOracle,
  createJavaScriptEngineBackend,
  createUcciEngineBackend,
  formatOracleComparisonReport,
  resolveNativeEnginePreset
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

applyOraclePreset(options);

if (!options.oracleCommand) {
  console.error("Oracle benchmark requires --oracle-command, XIANGQI_ORACLE_ENGINE_COMMAND, XIANGQI_ENGINE_COMMAND, or a preset/env combination that resolves a command.");
  console.error("");
  printUsage();
  process.exit(1);
}

let benchmarks;
try {
  benchmarks = await loadBenchmarkSuite(options);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const candidate = createJavaScriptEngineBackend({
  name: options.candidateName,
  profile: options.candidateProfile,
  depth: options.candidateDepth,
  timeLimitMs: options.candidateTimeLimitMs
});
const oracle = createUcciEngineBackend({
  name: options.oracleName,
  command: options.oracleCommand,
  args: options.oracleArgs,
  protocol: options.oracleProtocol,
  depth: options.oracleDepth,
  timeLimitMs: options.oracleTimeLimitMs,
  startupTimeoutMs: options.startupTimeoutMs,
  commandTimeoutMs: options.commandTimeoutMs,
  engineOptions: options.oracleOptions
});

try {
  const report = await compareEngineToOracle(candidate, oracle, {
    benchmarks,
    tag: options.tag,
    acceptableLossCp: options.acceptableLossCp,
    searchOptions: {
      depth: options.candidateDepth,
      timeLimitMs: options.candidateTimeLimitMs,
      useBook: options.candidateUseBook
    },
    oracleSearchOptions: {
      depth: options.oracleDepth,
      timeLimitMs: options.oracleTimeLimitMs,
      useBook: false,
      lines: options.lines
    },
    oracleReviewOptions: {
      depth: options.oracleDepth,
      timeLimitMs: options.oracleTimeLimitMs,
      useBook: false
    }
  });

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatOracleComparisonReport(report));
  }

  if (options.failOnReview && report.failed > 0) {
    process.exitCode = 1;
  }
} finally {
  await oracle.close();
}

function parseArgs(args) {
  const options = {
    candidateName: "JavaScript Candidate",
    candidateProfile: process.env.XIANGQI_CANDIDATE_PROFILE ?? "balanced",
    candidateDepth: numberFromEnv(process.env.XIANGQI_CANDIDATE_DEPTH, 2),
    candidateTimeLimitMs: numberFromEnv(process.env.XIANGQI_CANDIDATE_TIME_MS, 1000),
    candidateUseBook: true,
    oracleName: "Native Oracle",
    oracleCommand: process.env.XIANGQI_ORACLE_ENGINE_COMMAND ?? process.env.XIANGQI_ENGINE_COMMAND,
    oracleArgs: splitEnvArgs(process.env.XIANGQI_ORACLE_ENGINE_ARGS ?? process.env.XIANGQI_ENGINE_ARGS),
    oracleProtocol: process.env.XIANGQI_ORACLE_ENGINE_PROTOCOL ?? process.env.XIANGQI_ENGINE_PROTOCOL ?? "uci",
    oraclePreset: process.env.XIANGQI_ORACLE_ENGINE_PRESET ?? process.env.XIANGQI_ENGINE_PRESET,
    oracleEvalFile: process.env.XIANGQI_ORACLE_ENGINE_EVAL_FILE ?? process.env.XIANGQI_ENGINE_EVAL_FILE,
    oracleNameExplicit: false,
    oracleDepth: numberFromEnv(process.env.XIANGQI_ORACLE_DEPTH, 6),
    oracleTimeLimitMs: numberFromEnv(process.env.XIANGQI_ORACLE_TIME_MS, 2000),
    oracleOptions: parseNativeEngineOptions(
      process.env.XIANGQI_ORACLE_ENGINE_OPTIONS ?? process.env.XIANGQI_ENGINE_OPTIONS,
      "XIANGQI_ORACLE_ENGINE_OPTIONS"
    ),
    acceptableLossCp: numberFromEnv(process.env.XIANGQI_ORACLE_ACCEPTABLE_LOSS_CP, 60),
    benchmarkPath: process.env.XIANGQI_BENCHMARK_FILE,
    lines: numberFromEnv(process.env.XIANGQI_ORACLE_LINES, 3),
    startupTimeoutMs: numberFromEnv(process.env.XIANGQI_ORACLE_STARTUP_TIMEOUT_MS, 5000),
    commandTimeoutMs: numberFromEnv(process.env.XIANGQI_ORACLE_COMMAND_TIMEOUT_MS, 30000),
    tag: process.env.XIANGQI_BENCHMARK_TAG,
    failOnReview: false,
    json: false
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
    if (arg === "--fail-on-review") {
      options.failOnReview = true;
      continue;
    }
    if (arg === "--no-candidate-book") {
      options.candidateUseBook = false;
      continue;
    }
    if (arg === "--candidate-profile") {
      options.candidateProfile = args[++index];
      continue;
    }
    if (arg === "--candidate-depth") {
      options.candidateDepth = Number(args[++index]);
      continue;
    }
    if (arg === "--candidate-time") {
      options.candidateTimeLimitMs = Number(args[++index]);
      continue;
    }
    if (arg === "--oracle-command") {
      options.oracleCommand = args[++index];
      continue;
    }
    if (arg === "--oracle-arg") {
      options.oracleArgs.push(args[++index]);
      continue;
    }
    if (arg === "--oracle-args") {
      options.oracleArgs.push(...splitEnvArgs(args[++index]));
      continue;
    }
    if (arg === "--oracle-protocol") {
      options.oracleProtocol = args[++index];
      continue;
    }
    if (arg === "--oracle-preset") {
      options.oraclePreset = args[++index];
      continue;
    }
    if (arg === "--oracle-eval-file") {
      options.oracleEvalFile = args[++index];
      continue;
    }
    if (arg === "--oracle-option") {
      options.oracleOptions.push(parseNativeEngineOption(args[++index], "--oracle-option"));
      continue;
    }
    if (arg === "--oracle-depth") {
      options.oracleDepth = Number(args[++index]);
      continue;
    }
    if (arg === "--oracle-time") {
      options.oracleTimeLimitMs = Number(args[++index]);
      continue;
    }
    if (arg === "--acceptable-loss") {
      options.acceptableLossCp = Number(args[++index]);
      continue;
    }
    if (arg === "--lines") {
      options.lines = Number(args[++index]);
      continue;
    }
    if (arg === "--tag") {
      options.tag = args[++index];
      continue;
    }
    if (arg === "--benchmarks" || arg === "--file") {
      options.benchmarkPath = args[++index];
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

  assertProtocol(options.oracleProtocol);
  assertPositiveInteger(options.candidateDepth, "candidate-depth");
  assertPositiveInteger(options.candidateTimeLimitMs, "candidate-time");
  assertPositiveInteger(options.oracleDepth, "oracle-depth");
  assertPositiveInteger(options.oracleTimeLimitMs, "oracle-time");
  assertPositiveInteger(options.acceptableLossCp, "acceptable-loss");
  assertPositiveInteger(options.lines, "lines");
  assertPositiveInteger(options.startupTimeoutMs, "startup-timeout");
  assertPositiveInteger(options.commandTimeoutMs, "command-timeout");
  return options;
}

function applyOraclePreset(options) {
  if (!options.oraclePreset) return;

  const preset = resolveNativeEnginePreset(options.oraclePreset, {
    command: options.oracleCommand,
    args: options.oracleArgs,
    protocol: options.oracleProtocol,
    evalFile: options.oracleEvalFile,
    engineOptions: options.oracleOptions,
    env: process.env
  });

  options.oraclePreset = preset.preset;
  options.oracleCommand = preset.command;
  options.oracleArgs = preset.args;
  options.oracleProtocol = preset.protocol;
  options.oracleOptions = preset.engineOptions;
  if (!options.oracleNameExplicit) {
    options.oracleName = preset.name;
  }
}

async function loadBenchmarkSuite(options) {
  if (!options.benchmarkPath) return undefined;

  let text;
  try {
    text = await readFile(options.benchmarkPath, "utf8");
  } catch (error) {
    throw new Error(`Could not read benchmark suite ${options.benchmarkPath}: ${error.message}`);
  }

  try {
    return createBenchmarkSuite(text, { requireExpectedMoves: false });
  } catch (error) {
    throw new Error(`Could not load benchmark suite ${options.benchmarkPath}: ${error.message}`);
  }
}

function numberFromEnv(value, fallback) {
  if (value === undefined || value === "") return fallback;
  return Number(value);
}

function assertProtocol(value) {
  if (value !== "uci" && value !== "ucci") {
    throw new Error("--oracle-protocol must be uci or ucci.");
  }
}

function assertPositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--${name} must be a positive integer.`);
  }
}

function printUsage() {
  console.log(`Usage: node examples/oracle-benchmark.mjs [options]

Compares the JavaScript learning engine against a configured native UCI/UCCI
oracle on the benchmark suite. The oracle independently chooses a move, then
reviews the candidate move to estimate centipawn loss.

Options:
  --oracle-command CMD       Native UCI/UCCI executable
  --oracle-arg VALUE         Append one oracle process argument
  --oracle-args VALUES       Append whitespace-separated oracle process args
  --oracle-protocol uci|ucci Oracle protocol (default: uci)
  --oracle-preset NAME       Apply a native oracle preset, e.g. pikafish
  --oracle-eval-file FILE    NNUE/eval file for oracle presets that support one
  --oracle-option OPT        Set an oracle option (name=value or button name)
  --oracle-depth N           Oracle search/review depth (default: 6)
  --oracle-time MS           Oracle movetime in ms (default: 2000)
  --candidate-profile ID     JavaScript profile (default: balanced)
  --candidate-depth N        JavaScript search depth (default: 2)
  --candidate-time MS        JavaScript movetime in ms (default: 1000)
  --no-candidate-book        Disable candidate opening-book moves
  --acceptable-loss CP       Passing loss threshold in centipawns (default: 60)
  --benchmarks FILE          Load a JSON benchmark suite.
  --file FILE                Alias for --benchmarks.
  --tag TAG                  Only run benchmarks with a tag
  --lines N                  Oracle MultiPV lines to request (default: 3)
  --fail-on-review           Exit nonzero if any benchmark exceeds threshold
  --json                     Print machine-readable JSON

Environment:
  XIANGQI_ORACLE_ENGINE_COMMAND, XIANGQI_ORACLE_ENGINE_ARGS,
  XIANGQI_ORACLE_ENGINE_PROTOCOL, XIANGQI_ORACLE_ENGINE_PRESET,
  XIANGQI_ORACLE_ENGINE_EVAL_FILE, XIANGQI_ORACLE_ENGINE_OPTIONS,
  XIANGQI_ORACLE_DEPTH, XIANGQI_ORACLE_TIME_MS, XIANGQI_BENCHMARK_TAG
`);
}
