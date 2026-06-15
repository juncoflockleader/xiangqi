#!/usr/bin/env node
import {
  createInitialPosition,
  createLearningEngineBackend,
  createOracleReviewEngineBackend,
  createUcciEngineBackend,
  describeEngineBackend,
  formatPositionStudy,
  parseFen,
  resolveNativeEnginePreset,
  studyPositionWithBackend
} from "../src/index.js";
import {
  parseNativeEngineOption,
  parseNativeEngineOptions,
  splitEnvArgs
} from "./native-cli-options.mjs";
import { loadOpeningBook, resolveBookFormat } from "./opening-book-loader.mjs";

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

let openingBook;
try {
  openingBook = await loadOpeningBook(options);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

let backend;
try {
  backend = createStudyBackend(options, openingBook);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

try {
  const position = options.fen ? parseFen(options.fen) : createInitialPosition();
  const study = await studyPositionWithBackend(backend, position, {
    depth: options.depth,
    timeLimitMs: options.timeLimitMs,
    lines: options.lines,
    useBook: options.useBook,
    playedMove: options.playedMove,
    oracleReviewOptions: options.oracleCommand
      ? {
          depth: options.oracleDepth,
          timeLimitMs: options.oracleTimeLimitMs
        }
      : undefined
  });
  const report = {
    ok: true,
    backend: describeEngineBackend(backend),
    options: reportOptions(options),
    study
  };

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatStudyReport(report));
  }
} finally {
  await backend.close?.();
}

function createStudyBackend(options, openingBook) {
  applyNativePresets(options);

  const base = createLearningEngineBackend({
    profile: options.profile,
    depth: options.depth,
    timeLimitMs: options.timeLimitMs,
    ...(openingBook ? { book: openingBook } : {}),
    command: options.engineCommand,
    args: options.engineArgs,
    protocol: options.engineProtocol,
    engineOptions: options.engineOptions,
    native: options.engineName ? { name: options.engineName } : undefined,
    startupTimeoutMs: options.startupTimeoutMs,
    commandTimeoutMs: options.commandTimeoutMs,
    fallbackOnNativeError: !options.strictNative
  });

  if (!options.oracleCommand) {
    if (options.oraclePreset) {
      throw new Error(`--oracle-preset ${options.oraclePreset} did not resolve a native command. Run npm run install:pikafish, or set --oracle-command, XIANGQI_ORACLE_ENGINE_COMMAND, PIKAFISH_COMMAND, or PIKAFISH_HOME.`);
    }
    return base;
  }

  const oracle = createUcciEngineBackend({
    id: "study-oracle",
    name: options.oracleName,
    command: options.oracleCommand,
    args: options.oracleArgs,
    protocol: options.oracleProtocol,
    profile: options.oracleProtocol === "uci" ? "native-uci" : "native-ucci",
    depth: options.oracleDepth,
    timeLimitMs: options.oracleTimeLimitMs,
    startupTimeoutMs: options.oracleStartupTimeoutMs,
    commandTimeoutMs: options.oracleCommandTimeoutMs,
    engineOptions: options.oracleEngineOptions
  });

  return createOracleReviewEngineBackend(base, oracle, {
    name: `${base.name} with Oracle Review`,
    oracleReviewOptions: {
      depth: options.oracleDepth,
      timeLimitMs: options.oracleTimeLimitMs
    }
  });
}

function formatStudyReport(report) {
  const { backend, study } = report;
  const locale = normalizeLocale(report.options.locale);
  const lines = [
    locale === "zh"
      ? `研習引擎：${backend.name} (${backend.kind})`
      : `Study backend: ${backend.name} (${backend.kind})`,
    `FEN: ${study.fen}`,
    formatPositionStudy(study, { locale })
  ];

  if (locale !== "zh" && study.decision?.reasons?.length) {
    lines.push("Reasons:");
    for (const reason of study.decision.reasons.slice(0, 5)) {
      lines.push(`  - ${reason}`);
    }
  }

  const principalVariation = locale === "zh" && study.decision?.zhPrincipalVariation?.length
    ? study.decision.zhPrincipalVariation
    : study.decision?.principalVariation;
  if (principalVariation?.length) {
    lines.push(`${locale === "zh" ? "主線" : "Line"}: ${principalVariation.join(" ")}`);
  }

  if (study.pressure?.threats?.length) {
    lines.push(locale === "zh" ? "壓力：" : "Pressure:");
    for (const threat of study.pressure.threats.slice(0, 3)) {
      const text = locale === "zh" ? threat.zhSummary ?? threat.summary : threat.summary;
      lines.push(`  - ${text}`);
    }
  }

  const nextSteps = locale === "zh" ? study.zhNextSteps ?? study.nextSteps : study.nextSteps;
  if (nextSteps.length > 0) {
    lines.push(locale === "zh" ? "下一步：" : "Next steps:");
    for (const step of nextSteps.slice(0, 4)) {
      lines.push(`  - ${step.text}`);
    }
  }

  return lines.join("\n");
}

function parseArgs(args) {
  const parsed = {
    profile: process.env.XIANGQI_STUDY_PROFILE ?? "balanced",
    depth: numberFromEnv(process.env.XIANGQI_STUDY_DEPTH, 3),
    timeLimitMs: numberFromEnv(process.env.XIANGQI_STUDY_TIME_MS, 1000),
    lines: numberFromEnv(process.env.XIANGQI_STUDY_LINES, 3),
    bookPath: process.env.XIANGQI_OPENING_BOOK,
    bookFormat: process.env.XIANGQI_OPENING_BOOK_FORMAT ?? "auto",
    fen: process.env.XIANGQI_STUDY_FEN,
    playedMove: process.env.XIANGQI_STUDY_MOVE,
    locale: process.env.XIANGQI_STUDY_LOCALE ?? "en",
    engineCommand: process.env.XIANGQI_ENGINE_COMMAND,
    engineArgs: splitEnvArgs(process.env.XIANGQI_ENGINE_ARGS),
    engineProtocol: process.env.XIANGQI_ENGINE_PROTOCOL ?? "uci",
    enginePreset: process.env.XIANGQI_ENGINE_PRESET,
    engineEvalFile: process.env.XIANGQI_ENGINE_EVAL_FILE,
    engineOptions: parseNativeEngineOptions(process.env.XIANGQI_ENGINE_OPTIONS, "XIANGQI_ENGINE_OPTIONS"),
    startupTimeoutMs: numberFromEnv(process.env.XIANGQI_ENGINE_STARTUP_TIMEOUT_MS, 5000),
    commandTimeoutMs: numberFromEnv(process.env.XIANGQI_ENGINE_COMMAND_TIMEOUT_MS, 30000),
    strictNative: false,
    oracleName: "Study Oracle",
    oracleCommand: process.env.XIANGQI_ORACLE_ENGINE_COMMAND,
    oracleArgs: splitEnvArgs(process.env.XIANGQI_ORACLE_ENGINE_ARGS),
    oracleProtocol: process.env.XIANGQI_ORACLE_ENGINE_PROTOCOL ?? process.env.XIANGQI_ENGINE_PROTOCOL ?? "uci",
    oraclePreset: process.env.XIANGQI_ORACLE_ENGINE_PRESET,
    oracleEvalFile: process.env.XIANGQI_ORACLE_ENGINE_EVAL_FILE,
    oracleEngineOptions: parseNativeEngineOptions(
      process.env.XIANGQI_ORACLE_ENGINE_OPTIONS,
      "XIANGQI_ORACLE_ENGINE_OPTIONS"
    ),
    oracleDepth: numberFromEnv(process.env.XIANGQI_ORACLE_DEPTH, null),
    oracleTimeLimitMs: numberFromEnv(process.env.XIANGQI_ORACLE_TIME_MS, null),
    oracleStartupTimeoutMs: numberFromEnv(process.env.XIANGQI_ORACLE_STARTUP_TIMEOUT_MS, null),
    oracleCommandTimeoutMs: numberFromEnv(process.env.XIANGQI_ORACLE_COMMAND_TIMEOUT_MS, null),
    useBook: true,
    json: false,
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
    if (arg === "--locale" || arg === "--lang" || arg === "--language") {
      parsed.locale = parseLocale(requireValue(args, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--no-book") {
      parsed.useBook = false;
      continue;
    }
    if (arg === "--book") {
      parsed.bookPath = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--book-format") {
      parsed.bookFormat = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--profile") {
      parsed.profile = requireValue(args, index, arg);
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
    if (arg === "--lines") {
      parsed.lines = parsePositiveInteger(requireValue(args, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--fen") {
      parsed.fen = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--move" || arg === "--played-move" || arg === "--review") {
      parsed.playedMove = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--engine-command" || arg === "--native-command") {
      parsed.engineCommand = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--engine-arg" || arg === "--native-arg") {
      parsed.engineArgs.push(requireValue(args, index, arg));
      index += 1;
      continue;
    }
    if (arg === "--engine-args" || arg === "--native-args") {
      parsed.engineArgs.push(...splitEnvArgs(requireValue(args, index, arg)));
      index += 1;
      continue;
    }
    if (arg === "--engine-protocol" || arg === "--native-protocol") {
      parsed.engineProtocol = parseProtocol(requireValue(args, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--engine-preset" || arg === "--native-preset") {
      parsed.enginePreset = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--engine-eval-file" || arg === "--native-eval-file") {
      parsed.engineEvalFile = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--engine-option" || arg === "--native-option") {
      parsed.engineOptions.push(parseNativeEngineOption(requireValue(args, index, arg), arg));
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
    if (arg === "--strict-native") {
      parsed.strictNative = true;
      continue;
    }
    if (arg === "--oracle-command") {
      parsed.oracleCommand = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--oracle-arg") {
      parsed.oracleArgs.push(requireValue(args, index, arg));
      index += 1;
      continue;
    }
    if (arg === "--oracle-args") {
      parsed.oracleArgs.push(...splitEnvArgs(requireValue(args, index, arg)));
      index += 1;
      continue;
    }
    if (arg === "--oracle-protocol") {
      parsed.oracleProtocol = parseProtocol(requireValue(args, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--oracle-preset") {
      parsed.oraclePreset = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--oracle-eval-file") {
      parsed.oracleEvalFile = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--oracle-option") {
      parsed.oracleEngineOptions.push(parseNativeEngineOption(requireValue(args, index, arg), arg));
      index += 1;
      continue;
    }
    if (arg === "--oracle-depth") {
      parsed.oracleDepth = parsePositiveInteger(requireValue(args, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--oracle-time") {
      parsed.oracleTimeLimitMs = parsePositiveInteger(requireValue(args, index, arg), arg);
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  parsed.engineProtocol = parseProtocol(parsed.engineProtocol, "XIANGQI_ENGINE_PROTOCOL");
  parsed.oracleProtocol = parseProtocol(parsed.oracleProtocol, "XIANGQI_ORACLE_ENGINE_PROTOCOL");
  parsed.locale = parseLocale(parsed.locale, "XIANGQI_STUDY_LOCALE");
  resolveBookFormat(parsed.bookPath ?? "", parsed.bookFormat);
  parsed.depth = assertPositiveInteger(parsed.depth, "depth");
  parsed.timeLimitMs = assertPositiveInteger(parsed.timeLimitMs, "time");
  parsed.lines = assertPositiveInteger(parsed.lines, "lines");
  parsed.startupTimeoutMs = assertPositiveInteger(parsed.startupTimeoutMs, "startup timeout");
  parsed.commandTimeoutMs = assertPositiveInteger(parsed.commandTimeoutMs, "command timeout");
  parsed.oracleDepth ??= Math.max(parsed.depth, 2);
  parsed.oracleTimeLimitMs ??= Math.max(parsed.timeLimitMs, 1000);
  parsed.oracleStartupTimeoutMs ??= parsed.startupTimeoutMs;
  parsed.oracleCommandTimeoutMs ??= parsed.commandTimeoutMs;
  parsed.oracleDepth = assertPositiveInteger(parsed.oracleDepth, "oracle depth");
  parsed.oracleTimeLimitMs = assertPositiveInteger(parsed.oracleTimeLimitMs, "oracle time");
  parsed.oracleStartupTimeoutMs = assertPositiveInteger(parsed.oracleStartupTimeoutMs, "oracle startup timeout");
  parsed.oracleCommandTimeoutMs = assertPositiveInteger(parsed.oracleCommandTimeoutMs, "oracle command timeout");
  return parsed;
}

function applyNativePresets(options) {
  if (options.enginePreset) {
    const preset = resolveNativeEnginePreset(options.enginePreset, {
      command: options.engineCommand,
      args: options.engineArgs,
      protocol: options.engineProtocol,
      evalFile: options.engineEvalFile,
      engineOptions: options.engineOptions,
      env: process.env
    });
    options.enginePreset = preset.preset;
    options.engineName = preset.name;
    options.engineCommand = preset.command;
    options.engineArgs = preset.args;
    options.engineProtocol = preset.protocol;
    options.engineOptions = preset.engineOptions;
  }

  if (options.oraclePreset) {
    const preset = resolveNativeEnginePreset(options.oraclePreset, {
      command: options.oracleCommand,
      args: options.oracleArgs,
      protocol: options.oracleProtocol,
      evalFile: options.oracleEvalFile,
      engineOptions: options.oracleEngineOptions,
      env: process.env
    });
    options.oraclePreset = preset.preset;
    options.oracleName = preset.name;
    options.oracleCommand = preset.command;
    options.oracleArgs = preset.args;
    options.oracleProtocol = preset.protocol;
    options.oracleEngineOptions = preset.engineOptions;
  }
}

function reportOptions(options) {
  return {
    profile: options.profile,
    depth: options.depth,
    timeLimitMs: options.timeLimitMs,
    lines: options.lines,
    useBook: options.useBook,
    bookPath: options.bookPath ?? null,
    bookFormat: options.bookPath ? resolveBookFormat(options.bookPath, options.bookFormat) : null,
    fen: options.fen ?? null,
    playedMove: options.playedMove ?? null,
    locale: options.locale,
    enginePreset: options.enginePreset ?? null,
    engineCommand: options.engineCommand ?? null,
    engineProtocol: options.engineProtocol,
    oraclePreset: options.oraclePreset ?? null,
    oracleCommand: options.oracleCommand ?? null,
    oracleProtocol: options.oracleProtocol
  };
}

function printUsage() {
  console.log(`
Usage:
  npm run study
  npm run study -- --fen "4k4/9/4r4/9/9/9/9/9/9/3KR4 r" --move e9-f9
  npm run study -- --engine-preset pikafish
  npm run study -- --oracle-preset pikafish
  npm run study -- --json

Options:
  --profile name        Engine profile. Default: balanced.
  --depth n             Search depth. Default: 3.
  --time ms             Move time budget. Default: 1000.
  --lines n             Candidate lines to report. Default: 3.
  --book file           Load opening book data from JSON, CSV/TSV, or text.
  --book-format format  Book format: auto, json, games, csv, tsv, text, oracle, records.
  --fen fen             Study a FEN position. Default: initial position.
  --move move           Review a played move from the studied position.
  --played-move move    Alias for --move.
  --review move         Alias for --move.
  --locale en|zh        Report language. Default: en.
  --engine-command cmd  Use a native UCI/UCCI engine, with JS fallback.
  --engine-arg value    Append one native engine argument.
  --engine-args values  Append whitespace-separated native engine arguments.
  --engine-protocol p   Native play protocol: uci or ucci. Default: uci.
  --engine-preset name  Apply a native play preset, e.g. pikafish.
  --engine-eval-file f  NNUE/eval file for native play presets.
  --engine-option opt   Set native play option, name=value.
  --strict-native       Report native process errors instead of falling back.
  --oracle-command cmd  Ask a native oracle to review candidate and played moves.
  --oracle-arg value    Append one oracle process argument.
  --oracle-args values  Append whitespace-separated oracle process arguments.
  --oracle-protocol p   Oracle protocol: uci or ucci. Default: uci.
  --oracle-preset name  Apply a native oracle preset, e.g. pikafish.
  --oracle-eval-file f  NNUE/eval file for native oracle presets.
  --oracle-option opt   Set native oracle option, name=value.
  --oracle-depth n      Oracle review depth. Default: max(depth, 2).
  --oracle-time ms      Oracle review time. Default: max(time, 1000).
  --no-book             Disable opening book moves.
  --json                Print a machine-readable report.
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

function parseProtocol(value, source) {
  const protocol = String(value).toLowerCase();
  if (protocol === "uci" || protocol === "ucci") return protocol;
  throw new Error(`${source} must be uci or ucci.`);
}

function parseLocale(value, source) {
  const locale = normalizeLocale(value);
  if (locale === "en" || locale === "zh") return locale;
  throw new Error(`${source} must be en or zh.`);
}

function normalizeLocale(value) {
  const locale = String(value || "en").toLowerCase();
  if (locale === "en" || locale.startsWith("en-")) return "en";
  if (locale === "zh" || locale.startsWith("zh-") || locale === "cn") return "zh";
  return locale;
}

function numberFromEnv(value, fallback) {
  if (value === undefined || value === "") return fallback;
  return Number(value);
}
