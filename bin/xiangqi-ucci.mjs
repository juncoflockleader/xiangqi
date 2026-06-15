#!/usr/bin/env node
import readline from "node:readline";
import { AsyncUcciSession } from "../src/protocol/ucci.js";
import {
  parseNativeEngineOption,
  parseNativeEngineOptions,
  splitEnvArgs
} from "../examples/native-cli-options.mjs";

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

const session = new AsyncUcciSession(options);
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

let queue = Promise.resolve();
let closed = false;

rl.on("line", (line) => {
  queue = queue
    .then(() => handleProtocolLine(line))
    .catch((error) => {
      console.log(`info string error: ${error.message}`);
    });
});

rl.on("close", () => {
  if (closed) return;
  queue = queue.finally(async () => {
    if (closed) return;
    closed = true;
    await session.close();
  });
});

async function handleProtocolLine(line) {
  if (closed) return;

  const outputs = await session.handleLine(line);
  for (const output of outputs) {
    console.log(output);
  }

  if (outputs.includes("bye")) {
    closed = true;
    await session.close();
    rl.close();
  }
}

function parseArgs(args) {
  const options = {};
  const env = process.env;
  const envCommand = textFromEnv(env.XIANGQI_ENGINE_COMMAND);
  const envPreset = textFromEnv(env.XIANGQI_ENGINE_PRESET);
  const envProtocol = textFromEnv(env.XIANGQI_ENGINE_PROTOCOL);
  const envEvalFile = textFromEnv(env.XIANGQI_ENGINE_EVAL_FILE);
  const strictNative = parseBoolean(env.XIANGQI_ENGINE_STRICT_NATIVE, false);

  if (envCommand) options.command = envCommand;
  if (envPreset) options.nativePreset = envPreset;
  if (envProtocol) options.protocol = envProtocol;
  if (envEvalFile) options.evalFile = envEvalFile;

  const envArgs = splitEnvArgs(env.XIANGQI_ENGINE_ARGS);
  if (envArgs.length > 0) options.args = envArgs;

  const envDepth = numberFromEnv(env.XIANGQI_ENGINE_DEPTH);
  if (envDepth !== undefined) options.depth = envDepth;
  const envTimeLimitMs = numberFromEnv(env.XIANGQI_ENGINE_TIME_MS);
  if (envTimeLimitMs !== undefined) options.timeLimitMs = envTimeLimitMs;
  const envStartupTimeoutMs = numberFromEnv(env.XIANGQI_ENGINE_STARTUP_TIMEOUT_MS);
  if (envStartupTimeoutMs !== undefined) options.startupTimeoutMs = envStartupTimeoutMs;
  const envCommandTimeoutMs = numberFromEnv(env.XIANGQI_ENGINE_COMMAND_TIMEOUT_MS);
  if (envCommandTimeoutMs !== undefined) options.commandTimeoutMs = envCommandTimeoutMs;

  const envEngineOptions = parseNativeEngineOptions(env.XIANGQI_ENGINE_OPTIONS, "XIANGQI_ENGINE_OPTIONS");
  if (envEngineOptions.length > 0) options.engineOptions = envEngineOptions;

  if (env.XIANGQI_ENGINE_USE_BOOK !== undefined) {
    options.useBook = parseBoolean(env.XIANGQI_ENGINE_USE_BOOK, true);
  }
  if (strictNative) {
    options.fallbackOnNativeError = false;
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--engine-command" || arg === "--command") {
      options.command = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--engine-arg" || arg === "--arg") {
      options.args = [...(options.args ?? []), requireValue(args, index, arg)];
      index += 1;
      continue;
    }
    if (arg === "--engine-args" || arg === "--args") {
      options.args = [
        ...(options.args ?? []),
        ...splitEnvArgs(requireValue(args, index, arg))
      ];
      index += 1;
      continue;
    }
    if (arg === "--engine-protocol" || arg === "--protocol") {
      options.protocol = parseProtocol(requireValue(args, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--engine-preset" || arg === "--preset") {
      options.nativePreset = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--engine-eval-file" || arg === "--eval-file") {
      options.evalFile = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--engine-option" || arg === "--option") {
      options.engineOptions = [
        ...(options.engineOptions ?? []),
        parseNativeEngineOption(requireValue(args, index, arg), arg)
      ];
      index += 1;
      continue;
    }
    if (arg === "--depth") {
      options.depth = positiveInteger(requireValue(args, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--time" || arg === "--movetime") {
      options.timeLimitMs = positiveInteger(requireValue(args, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--startup-timeout") {
      options.startupTimeoutMs = positiveInteger(requireValue(args, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--command-timeout") {
      options.commandTimeoutMs = positiveInteger(requireValue(args, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--no-book") {
      options.useBook = false;
      continue;
    }
    if (arg === "--strict-native") {
      options.fallbackOnNativeError = false;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  if (!options.protocol && (options.command || options.nativePreset)) {
    options.protocol = "uci";
  }

  if (options.fallbackOnNativeError === false) {
    options.kind = options.protocol === "ucci" ? "native-ucci" : "native-uci";
  }

  return options;
}

function printUsage() {
  console.error(`Usage: node bin/xiangqi-ucci.mjs [options]

Options:
  --engine-command, --command PATH      Native UCI/UCCI engine command.
  --engine-arg, --arg VALUE             Add one native engine argument.
  --engine-args, --args "A B"           Add whitespace-separated native engine args.
  --engine-protocol, --protocol uci|ucci
  --engine-preset, --preset NAME        Native preset such as pikafish.
  --engine-eval-file, --eval-file PATH  Native NNUE/eval file.
  --engine-option, --option NAME=VALUE  Option sent to the native engine.
  --depth N                             Default search depth.
  --time MS, --movetime MS              Default move time.
  --startup-timeout MS                  Native startup timeout.
  --command-timeout MS                  Native command/search timeout.
  --no-book                             Disable opening book picks.
  --strict-native                       Fail instead of falling back to JS.

Environment:
  XIANGQI_ENGINE_COMMAND, XIANGQI_ENGINE_ARGS, XIANGQI_ENGINE_PROTOCOL,
  XIANGQI_ENGINE_PRESET, XIANGQI_ENGINE_EVAL_FILE, XIANGQI_ENGINE_OPTIONS,
  XIANGQI_ENGINE_DEPTH, XIANGQI_ENGINE_TIME_MS, XIANGQI_ENGINE_USE_BOOK,
  XIANGQI_ENGINE_STRICT_NATIVE`);
}

function requireValue(args, index, option) {
  if (index + 1 >= args.length) throw new Error(`${option} requires a value.`);
  return args[index + 1];
}

function positiveInteger(value, option) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${option} must be a positive integer.`);
  }
  return parsed;
}

function numberFromEnv(value) {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Environment numeric option must be a positive number: ${value}`);
  }
  return parsed;
}

function textFromEnv(value) {
  return value?.trim() ? value.trim() : undefined;
}

function parseProtocol(value, option) {
  const protocol = String(value).toLowerCase();
  if (protocol === "uci" || protocol === "ucci") return protocol;
  throw new Error(`${option} must be uci or ucci.`);
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === "") return fallback;
  const normalized = String(value).toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
}
