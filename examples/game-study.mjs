#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import {
  createGameStudyWithBackend,
  createLearningEngineBackend,
  createOracleReviewEngineBackend,
  createUcciEngineBackend,
  describeEngineBackend,
  formatGameStudy,
  importGameMoveText,
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

let importedGame;
try {
  importedGame = await loadMoves(options);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

let backend;
try {
  backend = createGameStudyBackend(options);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

try {
  const study = await createGameStudyWithBackend(backend, importedGame.moves, {
    maxKeyMoments: options.maxKeyMoments,
    maxPositionStudies: options.maxPositionStudies,
    ...(options.positionStudyPlies.length > 0 ? { positionStudyPlies: options.positionStudyPlies } : {}),
    includePlayedMoveReview: options.includePlayedMoveReview,
    reviewOptions: {
      depth: options.depth,
      timeLimitMs: options.timeLimitMs,
      useBook: options.useBook,
      oracleReviewOptions: options.oracleCommand
        ? {
            depth: options.oracleDepth,
            timeLimitMs: options.oracleTimeLimitMs
          }
        : undefined
    },
    studyOptions: {
      depth: options.studyDepth,
      timeLimitMs: options.studyTimeLimitMs,
      lines: options.lines,
      useBook: options.useBook,
      includePressure: options.includePressure,
      oracleReviewOptions: options.oracleCommand
        ? {
            depth: options.oracleDepth,
            timeLimitMs: options.oracleTimeLimitMs
          }
        : undefined
    },
    lessonOptions: {
      maxCards: options.maxCards
    }
  });
  const report = {
    ok: true,
    backend: describeEngineBackend(backend),
    options: reportOptions(options, importedGame),
    import: importSummary(importedGame),
    study
  };

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatGameStudyReport(report));
  }
} finally {
  await backend.close?.();
}

function createGameStudyBackend(options) {
  applyNativePresets(options);

  const base = createLearningEngineBackend({
    profile: options.profile,
    depth: options.depth,
    timeLimitMs: options.timeLimitMs,
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
    id: "game-study-oracle",
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

function formatGameStudyReport(report) {
  const { backend, study } = report;
  const lines = [
    `Game study backend: ${backend.name} (${backend.kind})`,
    `Moves: ${report.options.moveCount}`,
    formatGameStudy(study)
  ];

  const metadataKeys = Object.keys(report.import.metadata);
  if (metadataKeys.length > 0) {
    lines.push(`Imported metadata: ${metadataKeys.map((key) => `${key}=${report.import.metadata[key]}`).join(", ")}`);
  }

  if (report.import.diagnostics.length > 0) {
    lines.push(`Import diagnostics: ${report.import.diagnostics.length}`);
    for (const diagnostic of report.import.diagnostics.slice(0, 4)) {
      lines.push(`  - ${diagnostic.kind}: ${diagnostic.token ?? diagnostic.text}`);
    }
  }

  if (study.nextSteps.length > 0) {
    lines.push("Next steps:");
    for (const step of study.nextSteps.slice(0, 4)) {
      lines.push(`  - ${step.text}`);
    }
  }

  const firstStudy = study.positionStudies[0];
  if (firstStudy) {
    lines.push(`First study: ply ${firstStudy.gameMoment.ply}, ${firstStudy.summary}`);
    if (firstStudy.decision?.principalVariation?.length) {
      lines.push(`Line: ${firstStudy.decision.principalVariation.join(" ")}`);
    }
  }

  return lines.join("\n");
}

function parseArgs(args) {
  const parsed = {
    profile: process.env.XIANGQI_GAME_STUDY_PROFILE ?? "balanced",
    depth: numberFromEnv(process.env.XIANGQI_GAME_STUDY_DEPTH, 2),
    timeLimitMs: numberFromEnv(process.env.XIANGQI_GAME_STUDY_TIME_MS, 1000),
    studyDepth: numberFromEnv(process.env.XIANGQI_GAME_STUDY_POSITION_DEPTH, null),
    studyTimeLimitMs: numberFromEnv(process.env.XIANGQI_GAME_STUDY_POSITION_TIME_MS, null),
    lines: numberFromEnv(process.env.XIANGQI_GAME_STUDY_LINES, 3),
    maxKeyMoments: numberFromEnv(process.env.XIANGQI_GAME_STUDY_KEY_MOMENTS, 5),
    maxCards: numberFromEnv(process.env.XIANGQI_GAME_STUDY_CARDS, 4),
    maxPositionStudies: numberFromEnv(process.env.XIANGQI_GAME_STUDY_POSITIONS, 3),
    positionStudyPlies: parsePlyList(process.env.XIANGQI_GAME_STUDY_PLIES),
    movesText: process.env.XIANGQI_GAME_STUDY_MOVES,
    movesFile: process.env.XIANGQI_GAME_STUDY_FILE,
    positionalMoves: [],
    engineCommand: process.env.XIANGQI_ENGINE_COMMAND,
    engineArgs: splitEnvArgs(process.env.XIANGQI_ENGINE_ARGS),
    engineProtocol: process.env.XIANGQI_ENGINE_PROTOCOL ?? "uci",
    enginePreset: process.env.XIANGQI_ENGINE_PRESET,
    engineEvalFile: process.env.XIANGQI_ENGINE_EVAL_FILE,
    engineOptions: parseNativeEngineOptions(process.env.XIANGQI_ENGINE_OPTIONS, "XIANGQI_ENGINE_OPTIONS"),
    startupTimeoutMs: numberFromEnv(process.env.XIANGQI_ENGINE_STARTUP_TIMEOUT_MS, 5000),
    commandTimeoutMs: numberFromEnv(process.env.XIANGQI_ENGINE_COMMAND_TIMEOUT_MS, 30000),
    strictNative: false,
    oracleName: "Game Study Oracle",
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
    includePressure: true,
    includePlayedMoveReview: true,
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
    if (arg === "--no-book") {
      parsed.useBook = false;
      continue;
    }
    if (arg === "--no-pressure") {
      parsed.includePressure = false;
      continue;
    }
    if (arg === "--no-played-review") {
      parsed.includePlayedMoveReview = false;
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
    if (arg === "--study-depth" || arg === "--position-depth") {
      parsed.studyDepth = parsePositiveInteger(requireValue(args, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--study-time" || arg === "--position-time") {
      parsed.studyTimeLimitMs = parsePositiveInteger(requireValue(args, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--lines") {
      parsed.lines = parsePositiveInteger(requireValue(args, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--moves") {
      parsed.movesText = `${parsed.movesText ?? ""} ${requireValue(args, index, arg)}`.trim();
      index += 1;
      continue;
    }
    if (arg === "--file" || arg === "--moves-file") {
      parsed.movesFile = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--max-key-moments") {
      parsed.maxKeyMoments = parsePositiveInteger(requireValue(args, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--max-cards") {
      parsed.maxCards = parsePositiveInteger(requireValue(args, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--max-position-studies" || arg === "--max-studies") {
      parsed.maxPositionStudies = parseNonNegativeInteger(requireValue(args, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--study-plies") {
      parsed.positionStudyPlies = parsePlyList(requireValue(args, index, arg));
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
    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    parsed.positionalMoves.push(arg);
  }

  parsed.engineProtocol = parseProtocol(parsed.engineProtocol, "XIANGQI_ENGINE_PROTOCOL");
  parsed.oracleProtocol = parseProtocol(parsed.oracleProtocol, "XIANGQI_ORACLE_ENGINE_PROTOCOL");
  parsed.depth = assertPositiveInteger(parsed.depth, "depth");
  parsed.timeLimitMs = assertPositiveInteger(parsed.timeLimitMs, "time");
  parsed.studyDepth ??= parsed.depth;
  parsed.studyTimeLimitMs ??= parsed.timeLimitMs;
  parsed.studyDepth = assertPositiveInteger(parsed.studyDepth, "study depth");
  parsed.studyTimeLimitMs = assertPositiveInteger(parsed.studyTimeLimitMs, "study time");
  parsed.lines = assertPositiveInteger(parsed.lines, "lines");
  parsed.maxKeyMoments = assertPositiveInteger(parsed.maxKeyMoments, "max key moments");
  parsed.maxCards = assertPositiveInteger(parsed.maxCards, "max cards");
  parsed.maxPositionStudies = assertNonNegativeInteger(parsed.maxPositionStudies, "max position studies");
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

async function loadMoves(options) {
  const parts = [];
  if (options.movesText) parts.push(options.movesText);
  if (options.movesFile) {
    try {
      parts.push(await readFile(options.movesFile, "utf8"));
    } catch (error) {
      throw new Error(`Could not read move file ${options.movesFile}: ${error.message}`);
    }
  }
  if (options.positionalMoves.length > 0) parts.push(options.positionalMoves.join(" "));

  const imported = importGameMoveText(parts.join(" "));
  if (imported.moves.length === 0) {
    throw new Error("Game study requires moves. Pass coordinate moves as args, --moves, or --file.");
  }
  return imported;
}

function reportOptions(options, importedGame) {
  return {
    profile: options.profile,
    depth: options.depth,
    timeLimitMs: options.timeLimitMs,
    studyDepth: options.studyDepth,
    studyTimeLimitMs: options.studyTimeLimitMs,
    lines: options.lines,
    useBook: options.useBook,
    maxKeyMoments: options.maxKeyMoments,
    maxCards: options.maxCards,
    maxPositionStudies: options.maxPositionStudies,
    positionStudyPlies: [...options.positionStudyPlies],
    includePlayedMoveReview: options.includePlayedMoveReview,
    includePressure: options.includePressure,
    moveCount: importedGame.moves.length,
    moves: importedGame.moves,
    movesFile: options.movesFile ?? null,
    enginePreset: options.enginePreset ?? null,
    engineCommand: options.engineCommand ?? null,
    engineProtocol: options.engineProtocol,
    oraclePreset: options.oraclePreset ?? null,
    oracleCommand: options.oracleCommand ?? null,
    oracleProtocol: options.oracleProtocol
  };
}

function importSummary(importedGame) {
  return {
    type: importedGame.type,
    metadata: { ...importedGame.metadata },
    diagnostics: importedGame.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    tokens: importedGame.tokens.map((token) => ({
      ply: token.ply,
      token: token.token,
      notation: token.notation,
      side: token.side
    })),
    initialFen: importedGame.initialFen,
    finalFen: importedGame.finalFen
  };
}

function printUsage() {
  console.log(`
Usage:
  npm run study:game -- h7-e7 h0-g2 h9-g7
  npm run study:game -- --moves "1.C2=5 n8+7 2.N2+3 p7+1"
  npm run study:game -- --moves "h7-e7 h0-g2 h9-g7" --json
  npm run study:game -- --file ./game.json --max-position-studies 3
  npm run study:game -- --engine-preset pikafish --file ./game.txt

Options:
  --moves text             Coordinate or western Xiangqi moves.
  --file file              Load moves from text, JSON array, or {"moves":[...]}.
  --moves-file file        Alias for --file.
  --profile name           Engine profile. Default: balanced.
  --depth n                Game review depth. Default: 2.
  --time ms                Game review move time. Default: 1000.
  --study-depth n          Position-study depth. Default: depth.
  --study-time ms          Position-study move time. Default: time.
  --lines n                Candidate lines in position studies. Default: 3.
  --max-key-moments n      Key reviewed moments to keep. Default: 5.
  --max-cards n            Lesson cards to create. Default: 4.
  --max-position-studies n Key moments to expand into studies. Default: 3.
  --study-plies list       Comma-separated plies to study instead of key moments.
  --no-book                Disable opening book moves.
  --no-pressure            Omit pressure/threat sections from position studies.
  --no-played-review       Do not re-review played moves inside position studies.
  --engine-command cmd     Use a native UCI/UCCI engine, with JS fallback.
  --engine-arg value       Append one native engine argument.
  --engine-args values     Append whitespace-separated native engine arguments.
  --engine-protocol p      Native play protocol: uci or ucci. Default: uci.
  --engine-preset name     Apply a native play preset, e.g. pikafish.
  --engine-eval-file f     NNUE/eval file for native play presets.
  --engine-option opt      Set native play option, name=value.
  --strict-native          Report native process errors instead of falling back.
  --oracle-command cmd     Ask a native oracle to review moves and candidate picks.
  --oracle-arg value       Append one oracle process argument.
  --oracle-args values     Append whitespace-separated oracle process arguments.
  --oracle-protocol p      Oracle protocol: uci or ucci. Default: uci.
  --oracle-preset name     Apply a native oracle preset, e.g. pikafish.
  --oracle-eval-file f     NNUE/eval file for native oracle presets.
  --oracle-option opt      Set native oracle option, name=value.
  --oracle-depth n         Oracle review depth. Default: max(depth, 2).
  --oracle-time ms         Oracle review time. Default: max(time, 1000).
  --json                   Print a machine-readable report.
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

function parseNonNegativeInteger(value, option) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${option} must be a non-negative integer.`);
  }
  return parsed;
}

function assertPositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function assertNonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return value;
}

function parseProtocol(value, source) {
  const protocol = String(value).toLowerCase();
  if (protocol === "uci" || protocol === "ucci") return protocol;
  throw new Error(`${source} must be uci or ucci.`);
}

function parsePlyList(value) {
  if (value === undefined || value === null || value === "") return [];
  return String(value)
    .split(",")
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function numberFromEnv(value, fallback) {
  if (value === undefined || value === "") return fallback;
  return Number(value);
}
