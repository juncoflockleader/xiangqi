#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

const DEFAULT_SOURCE = "native/xiangqi_native.cpp";
const DEFAULT_OUTPUT = process.platform === "win32"
  ? "build/xiangqi-native.exe"
  : "build/xiangqi-native";

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

try {
  const result = await buildNativeEngine(options);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Built native Xiangqi engine: ${result.output}`);
    console.log(`Compiler: ${result.compiler}`);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

async function buildNativeEngine(options) {
  const source = resolve(options.source);
  const output = resolve(options.output);
  await mkdir(dirname(output), { recursive: true });

  const ltoRequested = !options.debug && options.lto;
  let flags = buildFlags(options, source, output, { lto: ltoRequested });
  let lto = ltoRequested;
  let ltoFallback = false;

  try {
    await runCommand(options.compiler, flags);
  } catch (error) {
    if (!ltoRequested) throw error;

    console.error(`LTO build failed; retrying without -flto.\n${error.message}`);
    flags = buildFlags(options, source, output, { lto: false });
    lto = false;
    ltoFallback = true;
    await runCommand(options.compiler, flags);
  }

  return {
    ok: true,
    compiler: options.compiler,
    source,
    output,
    debug: options.debug,
    portable: options.portable,
    lto,
    ltoFallback,
    flags
  };
}

function buildFlags(options, source, output, { lto }) {
  return [
    "-std=c++20",
    options.debug ? "-O0" : "-O3",
    ...(options.debug ? ["-g"] : ["-DNDEBUG"]),
    ...(!options.debug && !options.portable ? ["-march=native"] : []),
    ...(lto ? ["-flto"] : []),
    "-Wall",
    "-Wextra",
    "-pedantic",
    source,
    "-o",
    output
  ];
}

function parseArgs(args) {
  const parsed = {
    compiler: process.env.CXX || "c++",
    source: DEFAULT_SOURCE,
    output: DEFAULT_OUTPUT,
    debug: false,
    portable: false,
    lto: true,
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
    if (arg === "--debug") {
      parsed.debug = true;
      continue;
    }
    if (arg === "--portable") {
      parsed.portable = true;
      continue;
    }
    if (arg === "--no-lto") {
      parsed.lto = false;
      continue;
    }
    if (arg === "--compiler" || arg === "--cxx") {
      parsed.compiler = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--source") {
      parsed.source = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--out" || arg === "--output") {
      parsed.output = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  return parsed;
}

function runCommand(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "inherit", "pipe"]
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`${command} exited with code ${code}.${stderr ? `\n${stderr.trim()}` : ""}`));
    });
  });
}

function requireValue(args, index, option) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function printUsage() {
  console.log(`
Usage:
  node scripts/build-native.mjs
  node scripts/build-native.mjs --debug
  node scripts/build-native.mjs --compiler clang++ --out build/xiangqi-native

Options:
  --compiler cmd   C++ compiler to use. Defaults to CXX or c++.
  --source file    C++ source file. Defaults to native/xiangqi_native.cpp.
  --out file       Output executable. Defaults to build/xiangqi-native.
  --debug          Build with -O0 -g instead of optimized release flags.
  --portable       Omit local CPU tuning flags such as -march=native.
  --no-lto         Disable link-time optimization for release builds.
  --json           Print machine-readable output.
`.trim());
}
