#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import {
  createBenchmarkSuite,
  compareEngineToOracle,
  createJavaScriptEngineBackend,
  createUcciEngineBackend,
  formatOracleComparisonReport,
  resolveBenchmarkSuite,
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
applyCandidatePreset(options);

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

try {
  const report = await runOracleBenchmarkIterations(options, benchmarks);

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatOracleComparisonReport(report));
    if (report.repeat) {
      console.log("");
      console.log(formatOracleRepeatSummary(report.repeat));
    }
  }

  if (options.failOnReview && (report.failed > 0 || report.repeat?.failedRuns > 0)) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

async function runOracleBenchmarkIterations(options, benchmarks) {
  const reports = [];
  for (let iteration = 0; iteration < options.repeat; iteration += 1) {
    reports.push(await runOracleBenchmarkOnce(options, benchmarks));
  }

  const report = reports.at(-1);
  if (reports.length <= 1) return report;

  return {
    ...report,
    repeat: summarizeOracleRepeats(reports)
  };
}

async function runOracleBenchmarkOnce(options, benchmarks) {
  const candidate = createCandidateBackend(options);
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
    return await compareEngineToOracle(candidate, oracle, {
      benchmarks,
      tag: options.tag,
      id: options.id,
      acceptableLossCp: options.acceptableLossCp,
      searchOptions: {
        depth: options.candidateDepth,
        timeLimitMs: options.candidateTimeLimitMs,
        ...(options.candidateUseBookExplicit ? { useBook: options.candidateUseBook } : {})
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
  } finally {
    await closeBackend(candidate);
    await oracle.close();
  }
}

function summarizeOracleRepeats(reports) {
  const samples = reports.map((report, index) => ({
    iteration: index + 1,
    acceptable: report.acceptable,
    failed: report.failed,
    exactMatches: report.exactMatches,
    reviewed: report.reviewed,
    elapsedMs: report.elapsedMs,
    averageCentipawnLoss: report.aggregate?.averageCentipawnLoss ?? null
  }));
  const elapsedMs = samples.map((sample) => sample.elapsedMs);
  const averageLosses = samples
    .map((sample) => sample.averageCentipawnLoss)
    .filter((value) => typeof value === "number");

  return {
    count: reports.length,
    failedRuns: samples.filter((sample) => sample.failed > 0).length,
    samples,
    aggregate: {
      acceptableMin: Math.min(...samples.map((sample) => sample.acceptable)),
      acceptableMax: Math.max(...samples.map((sample) => sample.acceptable)),
      exactMatchesMin: Math.min(...samples.map((sample) => sample.exactMatches)),
      exactMatchesMax: Math.max(...samples.map((sample) => sample.exactMatches)),
      averageCentipawnLossAvg: averageLosses.length > 0 ? roundOne(average(averageLosses)) : null,
      averageCentipawnLossMin: averageLosses.length > 0 ? Math.min(...averageLosses) : null,
      averageCentipawnLossMax: averageLosses.length > 0 ? Math.max(...averageLosses) : null,
      elapsedMsAvg: Math.round(average(elapsedMs)),
      elapsedMsMin: Math.min(...elapsedMs),
      elapsedMsMax: Math.max(...elapsedMs)
    }
  };
}

function formatOracleRepeatSummary(repeat) {
  const aggregate = repeat.aggregate;
  const loss = aggregate.averageCentipawnLossAvg === null
    ? "n/a"
    : `${aggregate.averageCentipawnLossAvg} cp`;
  const lines = [
    `Repeat summary: ${repeat.count} runs, ${repeat.failedRuns} failed, ` +
      `acceptable ${aggregate.acceptableMin}-${aggregate.acceptableMax}, ` +
      `exact ${aggregate.exactMatchesMin}-${aggregate.exactMatchesMax}, ` +
      `avg loss ${loss}, avg ${formatInteger(aggregate.elapsedMsAvg)}ms`
  ];
  for (const sample of repeat.samples) {
    const sampleLoss = sample.averageCentipawnLoss === null ? "n/a" : `${sample.averageCentipawnLoss} cp`;
    lines.push(
      `  run ${sample.iteration}: ${sample.acceptable}/${sample.acceptable + sample.failed} within threshold, ` +
        `${sample.exactMatches} exact, avg loss ${sampleLoss}, ${formatInteger(sample.elapsedMs)}ms`
    );
  }
  return lines.join("\n");
}

function average(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundOne(value) {
  return Math.round(value * 10) / 10;
}

function formatInteger(value) {
  return Number(value ?? 0).toLocaleString("en-US");
}

function parseArgs(args) {
  const options = {
    candidateName: "JavaScript Candidate",
    candidateNameExplicit: false,
    candidateProfile: process.env.XIANGQI_CANDIDATE_PROFILE ?? "balanced",
    candidateDepth: numberFromEnv(process.env.XIANGQI_CANDIDATE_DEPTH, 2),
    candidateTimeLimitMs: numberFromEnv(process.env.XIANGQI_CANDIDATE_TIME_MS, 1000),
    candidateUseBook: true,
    candidateUseBookExplicit: false,
    candidateCommand: process.env.XIANGQI_CANDIDATE_ENGINE_COMMAND,
    candidateArgs: splitEnvArgs(process.env.XIANGQI_CANDIDATE_ENGINE_ARGS),
    candidateProtocol: process.env.XIANGQI_CANDIDATE_ENGINE_PROTOCOL ?? "uci",
    candidatePreset: process.env.XIANGQI_CANDIDATE_ENGINE_PRESET,
    candidateEvalFile: process.env.XIANGQI_CANDIDATE_ENGINE_EVAL_FILE,
    candidateOptions: parseNativeEngineOptions(
      process.env.XIANGQI_CANDIDATE_ENGINE_OPTIONS,
      "XIANGQI_CANDIDATE_ENGINE_OPTIONS"
    ),
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
    suite: process.env.XIANGQI_BENCHMARK_SUITE,
    id: process.env.XIANGQI_BENCHMARK_ID,
    lines: numberFromEnv(process.env.XIANGQI_ORACLE_LINES, 3),
    startupTimeoutMs: numberFromEnv(process.env.XIANGQI_ORACLE_STARTUP_TIMEOUT_MS, 5000),
    commandTimeoutMs: numberFromEnv(process.env.XIANGQI_ORACLE_COMMAND_TIMEOUT_MS, 30000),
    repeat: numberFromEnv(process.env.XIANGQI_ORACLE_REPEAT ?? process.env.XIANGQI_BENCHMARK_REPEAT, 1),
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
      options.candidateUseBookExplicit = true;
      continue;
    }
    if (arg === "--candidate-name") {
      options.candidateName = args[++index];
      options.candidateNameExplicit = true;
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
    if (arg === "--candidate-command") {
      options.candidateCommand = args[++index];
      continue;
    }
    if (arg === "--candidate-arg") {
      options.candidateArgs.push(args[++index]);
      continue;
    }
    if (arg === "--candidate-args") {
      options.candidateArgs.push(...splitEnvArgs(args[++index]));
      continue;
    }
    if (arg === "--candidate-protocol") {
      options.candidateProtocol = args[++index];
      continue;
    }
    if (arg === "--candidate-preset") {
      options.candidatePreset = args[++index];
      continue;
    }
    if (arg === "--candidate-eval-file") {
      options.candidateEvalFile = args[++index];
      continue;
    }
    if (arg === "--candidate-option") {
      options.candidateOptions.push(parseNativeEngineOption(args[++index], "--candidate-option"));
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
    if (arg === "--repeat") {
      options.repeat = Number(args[++index]);
      continue;
    }
    if (arg === "--tag") {
      options.tag = args[++index];
      continue;
    }
    if (arg === "--id") {
      options.id = args[++index];
      continue;
    }
    if (arg === "--benchmarks" || arg === "--file") {
      options.benchmarkPath = args[++index];
      continue;
    }
    if (arg === "--suite") {
      options.suite = args[++index];
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
  assertProtocol(options.candidateProtocol, "--candidate-protocol");
  assertPositiveInteger(options.candidateDepth, "candidate-depth");
  assertPositiveInteger(options.candidateTimeLimitMs, "candidate-time");
  assertPositiveInteger(options.oracleDepth, "oracle-depth");
  assertPositiveInteger(options.oracleTimeLimitMs, "oracle-time");
  assertPositiveInteger(options.acceptableLossCp, "acceptable-loss");
  assertPositiveInteger(options.lines, "lines");
  assertPositiveInteger(options.startupTimeoutMs, "startup-timeout");
  assertPositiveInteger(options.commandTimeoutMs, "command-timeout");
  assertPositiveInteger(options.repeat, "repeat");
  return options;
}

function createCandidateBackend(options) {
  if (usesNativeCandidate(options)) {
    return createUcciEngineBackend({
      name: options.candidateName,
      command: options.candidateCommand,
      args: options.candidateArgs,
      protocol: options.candidateProtocol,
      depth: options.candidateDepth,
      timeLimitMs: options.candidateTimeLimitMs,
      startupTimeoutMs: options.startupTimeoutMs,
      commandTimeoutMs: options.commandTimeoutMs,
      evalFile: options.candidateEvalFile,
      engineOptions: options.candidateOptions
    });
  }

  return createJavaScriptEngineBackend({
    name: options.candidateName,
    profile: options.candidateProfile,
    depth: options.candidateDepth,
    timeLimitMs: options.candidateTimeLimitMs
  });
}

function usesNativeCandidate(options) {
  return Boolean(options.candidateCommand || options.candidatePreset);
}

async function closeBackend(backend) {
  if (typeof backend?.close !== "function") return;
  await backend.close();
}

function applyCandidatePreset(options) {
  if (!options.candidatePreset) return;

  const preset = resolveNativeEnginePreset(options.candidatePreset, {
    command: options.candidateCommand,
    args: options.candidateArgs,
    protocol: options.candidateProtocol,
    evalFile: options.candidateEvalFile,
    engineOptions: options.candidateOptions,
    env: process.env
  });

  options.candidatePreset = preset.preset;
  options.candidateCommand = preset.command;
  options.candidateArgs = preset.args;
  options.candidateProtocol = preset.protocol;
  options.candidateOptions = preset.engineOptions;
  if (!options.candidateNameExplicit) {
    options.candidateName = preset.name;
  }
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
  if (options.benchmarkPath) {
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

  if (!options.suite) return undefined;
  try {
    return resolveBenchmarkSuite(options.suite);
  } catch (error) {
    throw new Error(error.message);
  }
}

function numberFromEnv(value, fallback) {
  if (value === undefined || value === "") return fallback;
  return Number(value);
}

function assertProtocol(value, optionName = "--oracle-protocol") {
  if (value !== "uci" && value !== "ucci") {
    throw new Error(`${optionName} must be uci or ucci.`);
  }
}

function assertPositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--${name} must be a positive integer.`);
  }
}

function printUsage() {
  console.log(`Usage: node examples/oracle-benchmark.mjs [options]

Compares a JavaScript or native candidate against a configured native UCI/UCCI
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
  --candidate-command CMD    Native UCI/UCCI candidate executable
  --candidate-arg VALUE      Append one candidate process argument
  --candidate-args VALUES    Append whitespace-separated candidate args
  --candidate-protocol P     Candidate protocol: uci or ucci (default: uci)
  --candidate-preset NAME    Apply a native candidate preset, e.g. local-cpp
  --candidate-eval-file FILE NNUE/eval file for candidate presets that support one
  --candidate-option OPT     Set a candidate native option (name=value or button)
  --candidate-name NAME      Candidate label in reports
  --candidate-profile ID     JavaScript profile (default: balanced)
  --candidate-depth N        JavaScript search depth (default: 2)
  --candidate-time MS        JavaScript movetime in ms (default: 1000)
  --no-candidate-book        Disable candidate opening-book moves
  --acceptable-loss CP       Passing loss threshold in centipawns (default: 60)
  --benchmarks FILE          Load a JSON benchmark suite.
  --file FILE                Alias for --benchmarks.
  --suite NAME               Built-in suite: starter or opening-oracle.
  --tag TAG                  Only run benchmarks with a tag
  --id ID                    Only run one benchmark id, or comma-separated ids.
  --lines N                  Oracle MultiPV lines to request (default: 3)
  --repeat N                 Run cold repeated oracle comparisons and summarize noise.
  --fail-on-review           Exit nonzero if any benchmark exceeds threshold
  --json                     Print machine-readable JSON

Environment:
  XIANGQI_CANDIDATE_ENGINE_COMMAND, XIANGQI_CANDIDATE_ENGINE_ARGS,
  XIANGQI_CANDIDATE_ENGINE_PROTOCOL, XIANGQI_CANDIDATE_ENGINE_PRESET,
  XIANGQI_CANDIDATE_ENGINE_EVAL_FILE, XIANGQI_CANDIDATE_ENGINE_OPTIONS,
  XIANGQI_CANDIDATE_DEPTH, XIANGQI_CANDIDATE_TIME_MS,
  XIANGQI_ORACLE_ENGINE_COMMAND, XIANGQI_ORACLE_ENGINE_ARGS,
  XIANGQI_ORACLE_ENGINE_PROTOCOL, XIANGQI_ORACLE_ENGINE_PRESET,
  XIANGQI_ORACLE_ENGINE_EVAL_FILE, XIANGQI_ORACLE_ENGINE_OPTIONS,
  XIANGQI_ORACLE_DEPTH, XIANGQI_ORACLE_TIME_MS, XIANGQI_BENCHMARK_SUITE,
  XIANGQI_BENCHMARK_TAG, XIANGQI_BENCHMARK_ID, XIANGQI_ORACLE_REPEAT,
  XIANGQI_BENCHMARK_REPEAT
`);
}
