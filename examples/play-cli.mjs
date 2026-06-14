#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  SIDES,
  chooseAndPlayGameMove,
  chooseGameMove,
  createEngine,
  createGame,
  formatBoard,
  gameStatus,
  historyKeys,
  opponent,
  playGameMove,
  toFen
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

const engine = createEngine({
  profile: options.profile,
  depth: options.depth,
  timeLimitMs: options.timeLimitMs
});
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
    if (handleCommand(command)) continue;

    playPlayerMove(command);
  }
} finally {
  rl.close();
}

function playPlayerMove(command) {
  const before = game;
  try {
    game = playGameMove(game, engine, command, {
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
  game = chooseAndPlayGameMove(game, engine, {
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

function handleCommand(command) {
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
    printHint();
    return true;
  }

  if (normalized === "best") {
    printBestMove();
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

function printHint() {
  const hint = engine.coachMove(game.position, {
    ...searchOptions(),
    history: historyKeys(game)
  });
  const levels = hint.levels.slice(0, 2);
  for (const level of levels) {
    console.log(`${level.title}: ${level.text}`);
  }
}

function printBestMove() {
  const decision = chooseGameMove(game, engine, searchOptions());
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

  if (options.includeReasons && decision.explanation?.reasons?.length) {
    for (const reason of decision.explanation.reasons.slice(0, 4)) {
      console.log(`- ${reason}`);
    }
  }
}

function printReview(review) {
  if (!review) return;
  console.log(`Review: ${review.classification}, ${review.centipawnLoss} cp loss.`);
  console.log(review.explanation.summary);
  if (!review.isBestMove && review.bestMove) {
    console.log(`Engine preferred ${review.bestMove.notation}.`);
  }
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

Options:
  --side red|black      Choose your side. Default: red.
  --profile name        Engine profile. Default: fast.
  --depth n             Search depth. Default: 2.
  --time ms             Move time budget. Default: 750.
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
    useBook: options.useBook
  };
}

function parseArgs(args) {
  const parsed = {
    playerSide: SIDES.RED,
    profile: "fast",
    depth: 2,
    timeLimitMs: 750,
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

    throw new Error(`Unknown option: ${arg}`);
  }

  return parsed;
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

function capitalize(value) {
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

function isQuitCommand(command) {
  const normalized = command.toLowerCase();
  return normalized === "quit" || normalized === "q" || normalized === "exit";
}
