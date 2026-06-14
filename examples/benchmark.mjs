#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import {
  createBenchmarkSuite,
  formatBenchmarkReport,
  runBenchmarkSuite
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

let benchmarks;
try {
  benchmarks = await loadBenchmarkSuite(options);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const report = await runBenchmarkSuite(null, {
  tag: options.tag,
  benchmarks,
  searchOptions: searchOptions(options)
});

if (options.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(formatBenchmarkReport(report));
}

if (options.failOnFailure && report.failed > 0) {
  process.exitCode = 1;
}

function parseArgs(args) {
  const parsed = {
    benchmarkPath: process.env.XIANGQI_BENCHMARK_FILE,
    tag: process.env.XIANGQI_BENCHMARK_TAG,
    depth: numberFromEnv(process.env.XIANGQI_BENCHMARK_DEPTH, null),
    timeLimitMs: numberFromEnv(process.env.XIANGQI_BENCHMARK_TIME_MS, null),
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
    if (arg === "--tag") {
      parsed.tag = requireValue(args, index, arg);
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

    throw new Error(`Unknown option: ${arg}`);
  }

  if (parsed.depth !== null) parsed.depth = assertPositiveInteger(parsed.depth, "depth");
  if (parsed.timeLimitMs !== null) parsed.timeLimitMs = assertPositiveInteger(parsed.timeLimitMs, "time");
  return parsed;
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
    return createBenchmarkSuite(text);
  } catch (error) {
    throw new Error(`Could not load benchmark suite ${options.benchmarkPath}: ${error.message}`);
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
  node examples/benchmark.mjs --benchmarks ./benchmarks.json --json

Options:
  --benchmarks file  Load a JSON benchmark suite.
  --file file        Alias for --benchmarks.
  --tag tag          Only run positions tagged with tag.
  --depth n          Override search depth for every benchmark.
  --time ms          Override movetime for every benchmark.
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

function numberFromEnv(value, fallback) {
  if (value === undefined || value === "") return fallback;
  return Number(value);
}
