#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  SIDES,
  chooseAndPlayGameMoveAsync,
  chooseGameMoveAsync,
  createLearningEngineBackend,
  createGame,
  createOracleReviewEngineBackend,
  createUcciEngineBackend,
  formatBoard,
  gameStatus,
  historyKeys,
  opponent,
  playGameMoveAsync,
  resolveNativeEnginePreset,
  toFen
} from "../src/index.js";
import {
  parseNativeEngineOption,
  parseNativeEngineOptions,
  splitEnvArgs
} from "./native-cli-options.mjs";
import { loadOpeningBook, parseBookFormat, resolveBookFormat } from "./opening-book-loader.mjs";

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

const engine = createPlayBackend(options, openingBook);
const rl = createInterface({ input, output });
const engineSide = opponent(options.playerSide);
let game = createGame();
let undoStack = [];
let lastEngineDecision = null;
let inputClosed = false;
rl.on("close", () => {
  inputClosed = true;
});

console.log("Xiangqi CLI demo");
console.log(`You are ${options.playerSide}; engine is ${engineSide}.`);
console.log(`Engine backend: ${engine.name} (${engine.kind}).`);
if (options.engineCommand) {
  console.log(`Native engine: ${options.engineProtocol} ${options.engineCommand}`);
}
if (options.enginePresetName) {
  console.log(`Engine preset: ${options.enginePresetName}`);
}
if (options.oracleCommand) {
  console.log(`Oracle reviewer: ${options.oracleProtocol} ${options.oracleCommand}`);
}
if (options.oraclePresetName) {
  console.log(`Oracle preset: ${options.oraclePresetName}`);
}
if (options.bookPath) {
  console.log(`Opening book: ${options.bookPath} (${resolveBookFormat(options.bookPath, options.bookFormat)})`);
}
console.log("Move notation uses board coordinates, for example h9-g7 or h9g7.");
console.log("Commands: moves, hint, best, why, fen, undo, help, quit.");
console.log("");
printPosition(game);

try {
  while (true) {
    const status = gameStatus(game);
    if (status.state !== "playing") {
      printGameOver(status);
      break;
    }

    if (game.position.turn === engineSide) {
      await playEngineTurn();
      continue;
    }

    const answer = await askQuestion(`${capitalize(options.playerSide)} to move > `);
    if (answer === null) break;
    const command = answer.trim();
    if (!command) continue;

    if (isQuitCommand(command)) break;
    if (await handleCommand(command)) continue;

    await playPlayerMove(command);
  }
} finally {
  rl.close();
  await engine.close?.();
}

async function playPlayerMove(command) {
  const before = game;
  try {
    game = await playGameMoveAsync(game, engine, command, {
      actor: "player",
      reviewOptions: searchOptions()
    });
    undoStack.push(before);

    const entry = game.moves.at(-1);
    console.log(`You played ${entry.notation}.`);
    printReview(entry.review);
    printPosition(game);
  } catch (error) {
    game = before;
    console.log(error.message);
    console.log("Try a coordinate move such as h9-g7, or type moves to list legal moves.");
  }
}

async function askQuestion(prompt) {
  if (inputClosed) return null;

  const controller = new AbortController();
  const onClose = () => controller.abort();
  rl.once("close", onClose);

  try {
    return await rl.question(prompt, { signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") return null;
    throw error;
  } finally {
    rl.off("close", onClose);
  }
}

async function playEngineTurn() {
  const before = game;
  const startedAt = Date.now();
  console.log(`Engine thinking as ${engineSide}...`);
  game = await chooseAndPlayGameMoveAsync(game, engine, {
    actor: "engine",
    review: false,
    searchOptions: searchOptions()
  });

  if (game === before || game.moves.length === before.moves.length) {
    printGameOver(gameStatus(game));
    return;
  }

  undoStack.push(before);
  const elapsedMs = Date.now() - startedAt;
  const entry = game.moves.at(-1);
  lastEngineDecision = entry.decision;

  console.log(`Engine played ${entry.notation} in ${elapsedMs} ms.`);
  printDecision(entry.decision);
  printPosition(game);
}

async function handleCommand(command) {
  const normalized = command.toLowerCase();

  if (normalized === "help" || normalized === "?") {
    printUsage();
    return true;
  }

  if (normalized === "moves") {
    printLegalMoves();
    return true;
  }

  if (normalized === "hint") {
    await printHint();
    return true;
  }

  if (normalized === "best") {
    await printBestMove();
    return true;
  }

  if (normalized === "why") {
    if (!lastEngineDecision) {
      console.log("No engine move has been played yet.");
      return true;
    }
    printDecision(lastEngineDecision, { includeReasons: true });
    return true;
  }

  if (normalized === "fen") {
    console.log(toFen(game.position));
    return true;
  }

  if (normalized === "undo") {
    if (undoStack.length === 0) {
      console.log("Nothing to undo yet.");
      return true;
    }
    game = undoStack.pop();
    lastEngineDecision = findLastEngineDecision(game);
    console.log("Undid one ply.");
    printPosition(game);
    return true;
  }

  return false;
}

function printPosition(currentGame) {
  const status = gameStatus(currentGame);
  console.log("");
  console.log(formatBoard(currentGame.position));
  const checkText = status.inCheck ? " | in check" : "";
  const repetitionText = status.repetitionCount > 1
    ? ` | repetition x${status.repetitionCount}`
    : "";
  console.log(`Turn: ${capitalize(currentGame.position.turn)} | legal moves: ${status.legalMoves}${checkText}${repetitionText}`);
  console.log("");
}

function printLegalMoves() {
  const moves = engine.legalMoves(game.position)
    .map((move) => move.notation)
    .sort();
  console.log(formatColumns(moves, 8));
}

async function printHint() {
  const hint = await engine.coachMove(game.position, {
    ...searchOptions(),
    history: historyKeys(game)
  });
  const levels = hint.levels.slice(0, 2);
  for (const level of levels) {
    console.log(`${level.title}: ${level.text}`);
  }
}

async function printBestMove() {
  const decision = await chooseGameMoveAsync(game, engine, searchOptions());
  console.log(`Best move: ${decision.bestMove?.notation ?? "none"}`);
  printDecision(decision, { includeReasons: true });
}

function printDecision(decision, options = {}) {
  if (!decision) return;
  const source = decision.source ?? "search";
  const depth = decision.depth ? `depth ${decision.depth}` : source;
  const nodes = Number.isFinite(decision.nodes) ? `, ${decision.nodes} nodes` : "";
  console.log(`${decision.explanation?.summary ?? "Engine selected a move."} (${depth}${nodes})`);

  const pv = decision.principalVariation?.length
    ? decision.principalVariation.map(formatMoveForDisplay).join(" ")
    : decision.explanation?.principalVariationText;
  if (pv) console.log(`Line: ${pv}`);
  printLinePlan(decision.explanation?.linePlan, {
    includeSteps: options.includeReasons
  });

  if (decision.oracleReview) {
    printOracleReview(decision.oracleReview);
  }

  if (!options.includeReasons) return;

  printConfidence(decision.explanation?.confidence);
  printComparison(decision.explanation?.comparison);
  printAlternatives(decision.explanation?.alternatives);

  if (decision.explanation?.reasons?.length) {
    console.log("Reasons:");
    for (const reason of decision.explanation.reasons.slice(0, 5)) {
      console.log(`- ${reason}`);
    }
  }
}

function printLinePlan(linePlan, options = {}) {
  if (!linePlan?.summary || !linePlan.moves?.length) return;
  const label = options.label ?? "Plan";
  console.log(`${label}: ${linePlan.summary}`);
  if (!options.includeSteps) return;

  for (const step of linePlan.moves.slice(0, 5)) {
    const role = step.role.replace("-", " ");
    const motifs = step.motifs?.length
      ? ` [${step.motifs.slice(0, 3).join(", ")}]`
      : "";
    console.log(`  ${step.ply}. ${capitalize(step.side)} ${role} ${step.move}: ${step.scoreBeforeText} -> ${step.scoreAfterText} (${step.scoreDeltaText})${motifs}`);
  }
}

function printConfidence(confidence) {
  if (!confidence) return;
  const score = Number.isFinite(confidence.score)
    ? ` (${Math.round(confidence.score)}/100)`
    : "";
  console.log(`Confidence: ${confidence.label ?? confidence.level ?? "unknown"}${score}.`);

  const factors = (confidence.factors ?? []).slice(0, 3);
  for (const factor of factors) {
    console.log(`  ${factor.kind}: ${factor.text}`);
  }
}

function printComparison(comparison) {
  if (!comparison?.reason) return;
  console.log(`Comparison: ${comparison.reason}`);
  if (comparison.bestLineText || comparison.nextLineText) {
    const best = comparison.bestLineText ? `best ${comparison.bestLineText}` : null;
    const next = comparison.nextLineText ? `next ${comparison.nextLineText}` : null;
    console.log(`  Lines: ${[best, next].filter(Boolean).join(" | ")}`);
  }
}

function printPlanComparison(comparison) {
  if (!comparison?.summary) return;
  console.log(`Plan comparison: ${comparison.summary}`);
}

function printAlternatives(alternatives) {
  if (!alternatives?.length) return;

  console.log("Alternatives:");
  for (const alternative of alternatives.slice(0, 5)) {
    const score = scoreTextForAlternative(alternative);
    const verdict = alternative.verdict ? `${alternative.verdict}, ` : "";
    const loss = Number.isFinite(alternative.centipawnLoss)
      ? `, loss ${alternative.centipawnLoss} cp`
      : "";
    const reply = alternative.expectedReply ? `, expects ${alternative.expectedReply}` : "";
    const wdl = alternative.wdl?.text ? `, WDL ${alternative.wdl.text}` : "";
    console.log(`  ${alternative.rank}. ${alternative.move}: ${verdict}${score}${loss}${reply}${wdl}`);
    if (alternative.linePlanSummary) {
      console.log(`     ${alternative.linePlanSummary}`);
    }
  }
}

function scoreTextForAlternative(alternative) {
  if (alternative.scoreDetail?.text) return alternative.scoreDetail.text;
  if (Number.isFinite(alternative.score)) return formatCentipawns(alternative.score);
  return "unscored";
}

function printOracleReview(review) {
  if (!review) return;
  if (review.status === "unavailable") {
    console.log(`Oracle review: unavailable (${review.error}).`);
    return;
  }

  const loss = Number.isFinite(review.centipawnLoss)
    ? `${review.centipawnLoss} cp loss`
    : "unscored";
  const best = review.isBestMove
    ? "oracle agrees"
    : `oracle preferred ${review.bestMove ?? "another move"}`;
  console.log(`Oracle review: ${review.classification}, ${loss}; ${best}.`);
}

function printReview(review) {
  if (!review) return;
  console.log(`Review: ${review.classification}, ${review.centipawnLoss} cp loss.`);
  if (review.reviewBackend?.name) {
    console.log(`Review source: ${review.reviewBackend.name}.`);
  }
  console.log(review.explanation.summary);
  printLinePlan(review.playedLinePlan, {
    label: "Your plan",
    includeSteps: false
  });
  if (!review.isBestMove && review.bestMove) {
    console.log(`Engine preferred ${review.bestMove.notation}.`);
    printLinePlan(review.bestLinePlan ?? review.bestExplanation?.linePlan ?? review.explanation?.bestMove?.linePlan, {
      label: "Best plan",
      includeSteps: true
    });
  }
  printPlanComparison(review.planComparison);
}

function printGameOver(status) {
  if (status.state === "playing") return;

  if (status.state === "repetition") {
    console.log(`Game over: repetition draw (${status.repetition?.kind ?? "cycle"}).`);
    return;
  }

  const winner = status.winner ? capitalize(status.winner) : "No side";
  console.log(`Game over: ${status.state}. ${winner} wins.`);
}

function printUsage() {
  console.log(`
Usage:
  npm run play
  npm run play -- --side black
  npm run play -- --depth 3 --time 1500 --no-book
  npm run play -- --side black --book ./oracle-opening-book.json
  npm run play -- --engine-command /path/to/pikafish --engine-protocol uci
  npm run play -- --engine-preset pikafish --engine-command /path/to/pikafish --engine-eval-file /path/to/pikafish.nnue
  npm run play -- --oracle-command /path/to/pikafish --oracle-protocol uci

Options:
  --side red|black      Choose your side. Default: red.
  --profile name        Engine profile. Default: fast.
  --depth n             Search depth. Default: 2.
  --time ms             Move time budget. Default: 750.
  --lines n             Candidate lines to compare. Default: 3.
  --book file           Load opening book data from JSON, CSV/TSV, or text.
  --book-format format  Book format: auto, json, csv, tsv, text.
  --engine-command cmd  Use a native UCI/UCCI engine for play, with JS fallback.
  --engine-arg value    Append one native engine argument.
  --engine-args values  Append whitespace-separated native engine arguments.
  --engine-protocol p   Native play protocol: uci or ucci. Default: uci.
  --engine-preset name  Apply a native play preset, e.g. pikafish.
  --engine-eval-file f  NNUE/eval file for native play presets.
  --engine-option opt   Set native play option, name=value.
  --strict-native       Report native process errors instead of falling back.
  --oracle-command cmd  Ask a native oracle to review each engine pick.
  --oracle-arg value    Append one oracle process argument.
  --oracle-args values  Append whitespace-separated oracle process arguments.
  --oracle-protocol p   Oracle protocol: uci or ucci. Default: uci.
  --oracle-preset name  Apply a native oracle preset, e.g. pikafish.
  --oracle-eval-file f  NNUE/eval file for native oracle presets.
  --oracle-option opt   Set native oracle option, name=value.
  --oracle-depth n      Oracle review depth. Default: max(depth, 2).
  --oracle-time ms      Oracle review time. Default: max(time, 1000).
  --no-book             Disable opening book moves.

Commands during play:
  h9-g7                 Play a move. Hyphen is optional.
  moves                 List legal moves.
  hint                  Show the first two coach hints.
  best                  Reveal the engine's preferred move.
  why                   Repeat the last engine explanation.
  fen                   Print the current FEN.
  undo                  Undo one ply.
  quit                  Exit.
`.trim());
}

function searchOptions() {
  return {
    depth: options.depth,
    timeLimitMs: options.timeLimitMs,
    lines: options.lines,
    useBook: options.useBook,
    ...(options.oracleCommand
      ? {
          oracleReviewOptions: {
            depth: options.oracleDepth,
            timeLimitMs: options.oracleTimeLimitMs
          }
        }
      : {})
  };
}

function parseArgs(args) {
  const parsed = {
    playerSide: SIDES.RED,
    profile: "fast",
    depth: 2,
    timeLimitMs: 750,
    lines: numberFromEnv(process.env.XIANGQI_ENGINE_LINES, 3),
    bookPath: process.env.XIANGQI_OPENING_BOOK,
    bookFormat: process.env.XIANGQI_OPENING_BOOK_FORMAT ?? "auto",
    engineCommand: process.env.XIANGQI_ENGINE_COMMAND,
    engineArgs: splitEnvArgs(process.env.XIANGQI_ENGINE_ARGS),
    engineProtocol: process.env.XIANGQI_ENGINE_PROTOCOL ?? "uci",
    enginePreset: process.env.XIANGQI_ENGINE_PRESET,
    engineEvalFile: process.env.XIANGQI_ENGINE_EVAL_FILE,
    engineOptions: parseNativeEngineOptions(process.env.XIANGQI_ENGINE_OPTIONS, "XIANGQI_ENGINE_OPTIONS"),
    startupTimeoutMs: numberFromEnv(process.env.XIANGQI_ENGINE_STARTUP_TIMEOUT_MS, 5000),
    commandTimeoutMs: numberFromEnv(process.env.XIANGQI_ENGINE_COMMAND_TIMEOUT_MS, 30000),
    strictNative: false,
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
    help: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--no-book") {
      parsed.useBook = false;
      continue;
    }
    if (arg === "--side") {
      parsed.playerSide = parseSide(args[index + 1]);
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
    if (arg === "--book") {
      parsed.bookPath = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--book-format") {
      parsed.bookFormat = parseBookFormat(requireValue(args, index, arg));
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

  parsed.bookFormat = parseBookFormat(parsed.bookFormat);
  applyNativePreset(parsed, "engine");
  applyNativePreset(parsed, "oracle");
  assertPresetResolved(parsed, "engine");
  assertPresetResolved(parsed, "oracle");
  parsed.lines = assertPositiveInteger(parsed.lines, "lines");
  parsed.engineProtocol = parseProtocol(parsed.engineProtocol, "XIANGQI_ENGINE_PROTOCOL");
  parsed.oracleProtocol = parseProtocol(parsed.oracleProtocol, "XIANGQI_ORACLE_ENGINE_PROTOCOL");
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

function assertPresetResolved(options, kind) {
  const prefix = kind === "engine" ? "engine" : "oracle";
  if (!options[`${prefix}Preset`] || options[`${prefix}Command`]) return;

  const flag = kind === "engine" ? "--engine-preset" : "--oracle-preset";
  const commandFlag = kind === "engine" ? "--engine-command" : "--oracle-command";
  throw new Error(`${flag} ${options[`${prefix}Preset`]} did not resolve a native command. Run npm run install:pikafish, or set ${commandFlag}, XIANGQI_${kind === "engine" ? "ENGINE" : "ORACLE_ENGINE"}_COMMAND, PIKAFISH_COMMAND, or PIKAFISH_HOME.`);
}

function applyNativePreset(options, kind) {
  const presetName = kind === "engine" ? options.enginePreset : options.oraclePreset;
  if (!presetName) return;

  const prefix = kind === "engine" ? "engine" : "oracle";
  const optionKey = kind === "engine" ? "engineOptions" : "oracleEngineOptions";
  const preset = resolveNativeEnginePreset(presetName, {
    command: options[`${prefix}Command`],
    args: options[`${prefix}Args`],
    protocol: options[`${prefix}Protocol`],
    evalFile: options[`${prefix}EvalFile`],
    engineOptions: options[optionKey],
    env: process.env
  });

  options[`${prefix}Preset`] = preset.preset;
  options[`${prefix}PresetName`] = preset.name;
  options[`${prefix}Command`] = preset.command;
  options[`${prefix}Args`] = preset.args;
  options[`${prefix}Protocol`] = preset.protocol;
  options[optionKey] = preset.engineOptions;
}

function parseSide(value) {
  if (value === SIDES.RED || value === SIDES.BLACK) return value;
  throw new Error("--side must be red or black.");
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

function numberFromEnv(value, fallback) {
  if (value === undefined || value === "") return fallback;
  return Number(value);
}

function createPlayBackend(options, openingBook) {
  const base = createLearningEngineBackend({
    profile: options.profile,
    depth: options.depth,
    timeLimitMs: options.timeLimitMs,
    ...(openingBook ? { book: openingBook } : {}),
    command: options.engineCommand,
    args: options.engineArgs,
    protocol: options.engineProtocol,
    engineOptions: options.engineOptions,
    startupTimeoutMs: options.startupTimeoutMs,
    commandTimeoutMs: options.commandTimeoutMs,
    fallbackOnNativeError: !options.strictNative
  });

  if (!options.oracleCommand) return base;

  const oracle = createUcciEngineBackend({
    id: "play-oracle",
    name: "Play Oracle",
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

function findLastEngineDecision(currentGame) {
  for (let index = currentGame.moves.length - 1; index >= 0; index -= 1) {
    const move = currentGame.moves[index];
    if (move.actor === "engine" && move.decision) return move.decision;
  }
  return null;
}

function formatColumns(values, columns) {
  if (values.length === 0) return "(none)";
  const rows = [];
  for (let index = 0; index < values.length; index += columns) {
    rows.push(values.slice(index, index + columns).join("  "));
  }
  return rows.join("\n");
}

function formatMoveForDisplay(move) {
  if (typeof move === "string") return move;
  return move?.notation ?? "";
}

function formatCentipawns(value) {
  const rounded = Math.round(value ?? 0);
  return `${rounded >= 0 ? "+" : ""}${rounded} cp`;
}

function capitalize(value) {
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

function isQuitCommand(command) {
  const normalized = command.toLowerCase();
  return normalized === "quit" || normalized === "q" || normalized === "exit";
}
