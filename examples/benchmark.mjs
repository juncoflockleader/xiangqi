#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import {
  createBenchmarkSuite,
  createUcciEngineBackend,
  formatBenchmarkReport,
  resolveBenchmarkSuite,
  resolveNativeEnginePreset,
  runBenchmarkSuite
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

let benchmarks;
try {
  benchmarks = await loadBenchmarkSuite(options);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

try {
  applyEnginePreset(options);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

try {
  const report = await runBenchmarkIterations(options, benchmarks);

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatBenchmarkReport(report));
    if (report.repeat) {
      console.log("");
      console.log(formatBenchmarkRepeatSummary(report.repeat));
    }
  }

  if (options.failOnFailure && (report.failed > 0 || report.repeat?.failedRuns > 0)) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

async function runBenchmarkIterations(options, benchmarks) {
  const reports = [];
  for (let iteration = 0; iteration < options.repeat; iteration += 1) {
    let engine;
    try {
      engine = createBenchmarkEngine(options);
      reports.push(await runBenchmarkSuite(engine, {
        tag: options.tag,
        id: options.id,
        benchmarks,
        searchOptions: searchOptions(options)
      }));
    } finally {
      await engine?.close?.();
    }
  }

  const report = reports.at(-1);
  if (reports.length <= 1) return report;

  return {
    ...report,
    repeat: summarizeBenchmarkRepeats(reports)
  };
}

function summarizeBenchmarkRepeats(reports) {
  const samples = reports.map((report, index) => ({
    iteration: index + 1,
    solved: report.solved,
    failed: report.failed,
    elapsedMs: report.elapsedMs,
    nodes: report.aggregate?.nodes ?? 0,
    nodesPerSecond: report.aggregate?.nodesPerSecond ?? 0
  }));
  const nodesPerSecond = samples.map((sample) => sample.nodesPerSecond);
  const elapsedMs = samples.map((sample) => sample.elapsedMs);
  return {
    count: reports.length,
    failedRuns: samples.filter((sample) => sample.failed > 0).length,
    samples,
    aggregate: {
      nodesPerSecondAvg: Math.round(average(nodesPerSecond)),
      nodesPerSecondMin: Math.min(...nodesPerSecond),
      nodesPerSecondMax: Math.max(...nodesPerSecond),
      elapsedMsAvg: Math.round(average(elapsedMs)),
      elapsedMsMin: Math.min(...elapsedMs),
      elapsedMsMax: Math.max(...elapsedMs)
    }
  };
}

function formatBenchmarkRepeatSummary(repeat) {
  const aggregate = repeat.aggregate;
  const lines = [
    `Repeat summary: ${repeat.count} runs, ${repeat.failedRuns} failed, avg ${formatInteger(aggregate.nodesPerSecondAvg)}/s ` +
      `(min ${formatInteger(aggregate.nodesPerSecondMin)}/s, max ${formatInteger(aggregate.nodesPerSecondMax)}/s), ` +
      `avg ${formatInteger(aggregate.elapsedMsAvg)}ms`
  ];
  for (const sample of repeat.samples) {
    lines.push(
      `  run ${sample.iteration}: ${sample.solved}/${sample.solved + sample.failed} solved, ` +
        `${formatInteger(sample.nodesPerSecond)}/s, ${formatInteger(sample.elapsedMs)}ms`
    );
  }
  return lines.join("\n");
}

function average(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatInteger(value) {
  return Number(value ?? 0).toLocaleString("en-US");
}

function parseArgs(args) {
  const parsed = {
    benchmarkPath: process.env.XIANGQI_BENCHMARK_FILE,
    suite: process.env.XIANGQI_BENCHMARK_SUITE,
    id: process.env.XIANGQI_BENCHMARK_ID,
    tag: process.env.XIANGQI_BENCHMARK_TAG,
    depth: numberFromEnv(process.env.XIANGQI_BENCHMARK_DEPTH, null),
    timeLimitMs: numberFromEnv(process.env.XIANGQI_BENCHMARK_TIME_MS, null),
    engineName: "Benchmark Engine",
    engineNameExplicit: false,
    engineCommand: process.env.XIANGQI_ENGINE_COMMAND,
    engineArgs: splitEnvArgs(process.env.XIANGQI_ENGINE_ARGS),
    engineProtocol: process.env.XIANGQI_ENGINE_PROTOCOL ?? "uci",
    enginePreset: process.env.XIANGQI_ENGINE_PRESET,
    engineEvalFile: process.env.XIANGQI_ENGINE_EVAL_FILE,
    engineOptions: parseNativeEngineOptions(process.env.XIANGQI_ENGINE_OPTIONS, "XIANGQI_ENGINE_OPTIONS"),
    startupTimeoutMs: numberFromEnv(process.env.XIANGQI_ENGINE_STARTUP_TIMEOUT_MS, 5000),
    commandTimeoutMs: numberFromEnv(process.env.XIANGQI_ENGINE_COMMAND_TIMEOUT_MS, 30000),
    repeat: numberFromEnv(process.env.XIANGQI_BENCHMARK_REPEAT, 1),
    json: false,
    failOnFailure: true,
    help: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--json") {
      parsed.json = true;
      continue;
    }
    if (arg === "--no-fail") {
      parsed.failOnFailure = false;
      continue;
    }
    if (arg === "--benchmarks" || arg === "--file") {
      parsed.benchmarkPath = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--suite") {
      parsed.suite = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--tag") {
      parsed.tag = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--id") {
      parsed.id = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--depth") {
      parsed.depth = parsePositiveInteger(requireValue(args, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--time") {
      parsed.timeLimitMs = parsePositiveInteger(requireValue(args, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--repeat") {
      parsed.repeat = parsePositiveInteger(requireValue(args, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--engine-name") {
      parsed.engineName = requireValue(args, index, arg);
      parsed.engineNameExplicit = true;
      index += 1;
      continue;
    }
    if (arg === "--engine-command") {
      parsed.engineCommand = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--engine-arg") {
      parsed.engineArgs.push(requireValue(args, index, arg));
      index += 1;
      continue;
    }
    if (arg === "--engine-args") {
      parsed.engineArgs.push(...splitEnvArgs(requireValue(args, index, arg)));
      index += 1;
      continue;
    }
    if (arg === "--engine-protocol") {
      parsed.engineProtocol = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--engine-preset") {
      parsed.enginePreset = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--engine-eval-file") {
      parsed.engineEvalFile = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--engine-option") {
      parsed.engineOptions.push(parseNativeEngineOption(requireValue(args, index, arg), "--engine-option"));
      index += 1;
      continue;
    }
    if (arg === "--startup-timeout") {
      parsed.startupTimeoutMs = parsePositiveInteger(requireValue(args, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--command-timeout") {
      parsed.commandTimeoutMs = parsePositiveInteger(requireValue(args, index, arg), arg);
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  if (parsed.depth !== null) parsed.depth = assertPositiveInteger(parsed.depth, "depth");
  if (parsed.timeLimitMs !== null) parsed.timeLimitMs = assertPositiveInteger(parsed.timeLimitMs, "time");
  parsed.repeat = assertPositiveInteger(parsed.repeat, "repeat");
  assertProtocol(parsed.engineProtocol);
  assertPositiveInteger(parsed.startupTimeoutMs, "startup-timeout");
  assertPositiveInteger(parsed.commandTimeoutMs, "command-timeout");
  return parsed;
}

function createBenchmarkEngine(options) {
  if (!usesNativeEngine(options)) return null;
  if (!options.engineCommand) {
    throw new Error("Native benchmark engine requires --engine-command, --engine-preset, XIANGQI_ENGINE_COMMAND, or XIANGQI_ENGINE_PRESET.");
  }

  return createUcciEngineBackend({
    name: options.engineName,
    command: options.engineCommand,
    args: options.engineArgs,
    protocol: options.engineProtocol,
    depth: options.depth ?? 4,
    timeLimitMs: options.timeLimitMs ?? 1000,
    startupTimeoutMs: options.startupTimeoutMs,
    commandTimeoutMs: options.commandTimeoutMs,
    evalFile: options.engineEvalFile,
    engineOptions: options.engineOptions
  });
}

function usesNativeEngine(options) {
  return Boolean(options.engineCommand || options.enginePreset);
}

function applyEnginePreset(options) {
  if (!options.enginePreset) return;

  const preset = resolveNativeEnginePreset(options.enginePreset, {
    command: options.engineCommand,
    args: options.engineArgs,
    protocol: options.engineProtocol,
    evalFile: options.engineEvalFile,
    engineOptions: options.engineOptions,
    env: process.env
  });

  options.enginePreset = preset.preset;
  options.engineCommand = preset.command;
  options.engineArgs = preset.args;
  options.engineProtocol = preset.protocol;
  options.engineOptions = preset.engineOptions;
  if (!options.engineNameExplicit) {
    options.engineName = preset.name;
  }
}

async function loadBenchmarkSuite(options) {
  if (options.benchmarkPath) {
    let text;
    try {
      text = await readFile(options.benchmarkPath, "utf8");
    } catch (error) {
      throw new Error(`Could not read benchmark suite ${options.benchmarkPath}: ${error.message}`);
    }

    try {
      return createBenchmarkSuite(text);
    } catch (error) {
      throw new Error(`Could not load benchmark suite ${options.benchmarkPath}: ${error.message}`);
    }
  }

  if (!options.suite) return undefined;
  try {
    return resolveBenchmarkSuite(options.suite);
  } catch (error) {
    throw new Error(error.message);
  }
}

function searchOptions(options) {
  return {
    ...(options.depth !== null ? { depth: options.depth } : {}),
    ...(options.timeLimitMs !== null ? { timeLimitMs: options.timeLimitMs } : {})
  };
}

function printUsage() {
  console.log(`
Usage:
  node examples/benchmark.mjs
  node examples/benchmark.mjs --tag tactic
  node examples/benchmark.mjs --suite opening-oracle --tag regression
  node examples/benchmark.mjs --suite opening-oracle --engine-preset local-cpp
  node examples/benchmark.mjs --benchmarks ./benchmarks.json --json

Options:
  --benchmarks file  Load a JSON benchmark suite.
  --file file        Alias for --benchmarks.
  --suite name       Built-in suite: starter or opening-oracle.
  --tag tag          Only run positions tagged with tag.
  --id id            Only run one benchmark id, or comma-separated ids.
  --depth n          Override search depth for every benchmark.
  --time ms          Override movetime for every benchmark.
  --repeat n         Run the same benchmark selection n times and summarize speed.
  --engine-preset n  Run a native preset, e.g. local-cpp or pikafish.
  --engine-command c Run a native UCI/UCCI executable.
  --engine-arg v     Append one native engine argument.
  --engine-args v    Append whitespace-separated native engine args.
  --engine-protocol  Native protocol: uci or ucci.
  --engine-option o  Set a native option, name=value or button name.
  --json             Print machine-readable JSON.
  --no-fail          Exit zero even when benchmark positions fail.
`.trim());
}

function requireValue(args, index, option) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function parsePositiveInteger(value, option) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${option} must be a positive integer.`);
  }
  return parsed;
}

function assertPositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function assertProtocol(value) {
  if (value !== "uci" && value !== "ucci") {
    throw new Error("engine protocol must be uci or ucci.");
  }
}

function numberFromEnv(value, fallback) {
  if (value === undefined || value === "") return fallback;
  return Number(value);
}
