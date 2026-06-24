#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import {
  createJavaScriptEngineBackend,
  createLearningEngineBackend,
  formatMatchReport,
  runEngineMatch
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

const a = createCompetitor("A", options.a, options, "a");
const b = createCompetitor("B", options.b, options, "b");

try {
  const report = await runEngineMatch(a, b, {
    games: options.games,
    maxPlies: options.maxPlies,
    openingPlies: options.openingPlies,
    seed: options.seed,
    searchOptions: searchOptions(options),
    sprt: options.sprt,
    onGame: options.quiet
      ? undefined
      : (result, index, partial) => {
          const llr = partial ? ` LLR ${partial.llr}/[${partial.lower},${partial.upper}]` : "";
          process.stderr.write(
            `  game ${index + 1}/${options.games}: ${result.redName} (R) vs ${result.blackName} (B) → ${result.outcomeText}${llr}\r`
          );
        }
  });

  if (!options.quiet) process.stderr.write("\n");
  console.log(formatMatchReport(report));
  if (options.out) {
    writeFileSync(options.out, JSON.stringify(report, null, 2));
    console.log(`\nWrote results to ${options.out}`);
  }
  if (options.json) {
    console.log("");
    console.log(JSON.stringify(report, null, 2));
  }
} finally {
  await a.engine.close?.();
  await b.engine.close?.();
}

function createCompetitor(label, spec, options, side) {
  const name = String(spec ?? "").trim().toLowerCase();
  const sideSearch = side === "a" ? options.aSearch : options.bSearch;
  const elo = side === "a" ? options.aElo : options.bElo;

  if (name === "" || name === "js" || name === "javascript") {
    return {
      id: `${label}-js`,
      name: `${label}:JS`,
      searchOptions: sideSearch,
      engine: createJavaScriptEngineBackend({ profile: options.profile })
    };
  }

  // Treat anything else as a native preset name (local-cpp, pikafish) or command.
  const isPreset = name === "local-cpp" || name === "pikafish";
  return {
    id: `${label}-${name}`,
    name: `${label}:${spec}${elo ? `@${elo}` : ""}`,
    searchOptions: sideSearch,
    engine: createLearningEngineBackend({
      ...(isPreset ? { nativePreset: name } : { command: spec }),
      protocol: "uci",
      fallbackOnNativeError: false,
      engineOptions: [...nativeThreadsOption(options), ...eloLimitOptions(elo)]
    })
  };
}

function nativeThreadsOption(options) {
  return options.threads ? [{ name: "Threads", value: options.threads }] : [];
}

// Handicap a native (Pikafish-compatible) engine to a target Elo.
function eloLimitOptions(elo) {
  if (!elo) return [];
  return [
    { name: "UCI_LimitStrength", value: true },
    { name: "UCI_Elo", value: elo }
  ];
}

function searchOptions(options) {
  const search = {};
  if (options.depth !== undefined) search.depth = options.depth;
  if (options.timeLimitMs !== undefined) search.timeLimitMs = options.timeLimitMs;
  if (options.lines !== undefined) search.lines = options.lines;
  if (options.useBook === false) search.useBook = false;
  return search;
}

function parseArgs(args) {
  const options = {
    a: "js",
    b: "local-cpp",
    games: 10,
    maxPlies: 200,
    openingPlies: 4,
    profile: "fast",
    useBook: true,
    aSearch: {},
    bSearch: {}
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") return { ...options, help: true };
    else if (arg === "--a") options.a = args[++index];
    else if (arg === "--b") options.b = args[++index];
    else if (arg === "--games") options.games = Number(args[++index]);
    else if (arg === "--plies") options.maxPlies = Number(args[++index]);
    else if (arg === "--opening-plies") options.openingPlies = Number(args[++index]);
    else if (arg === "--seed") options.seed = Number(args[++index]);
    else if (arg === "--depth") options.depth = Number(args[++index]);
    else if (arg === "--time") options.timeLimitMs = Number(args[++index]);
    else if (arg === "--lines") options.lines = Number(args[++index]);
    else if (arg === "--threads") options.threads = Number(args[++index]);
    else if (arg === "--profile") options.profile = args[++index];
    else if (arg === "--no-book") options.useBook = false;
    else if (arg === "--json") options.json = true;
    else if (arg === "--quiet") options.quiet = true;
    else if (arg === "--out") options.out = args[++index];
    else if (arg === "--a-depth") options.aSearch.depth = Number(args[++index]);
    else if (arg === "--b-depth") options.bSearch.depth = Number(args[++index]);
    else if (arg === "--a-time") options.aSearch.timeLimitMs = Number(args[++index]);
    else if (arg === "--b-time") options.bSearch.timeLimitMs = Number(args[++index]);
    else if (arg === "--a-elo") options.aElo = Number(args[++index]);
    else if (arg === "--b-elo") options.bElo = Number(args[++index]);
    else if (arg === "--sprt") options.sprt = parseSprt(args[++index]);
    else throw new Error(`Unknown option: ${arg}`);
  }

  assertPositiveInteger(options.games, "games");
  assertPositiveInteger(options.maxPlies, "plies");
  assertPositiveInteger(options.openingPlies, "opening-plies");
  if (options.depth !== undefined) assertPositiveInteger(options.depth, "depth");
  if (options.timeLimitMs !== undefined) assertPositiveInteger(options.timeLimitMs, "time");
  if (options.depth === undefined && options.timeLimitMs === undefined) {
    // Give a sane default so both engines have a comparable budget.
    options.timeLimitMs = 500;
  }

  return options;
}

// --sprt elo0,elo1[,alpha,beta] e.g. "0,10" or "-5,5,0.05,0.05"
function parseSprt(spec) {
  const parts = String(spec ?? "").split(",").map((part) => Number(part.trim()));
  if (parts.length < 2 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error('--sprt expects "elo0,elo1" (optionally ",alpha,beta"), e.g. --sprt 0,10');
  }
  const [elo0, elo1, alpha = 0.05, beta = 0.05] = parts;
  return { elo0, elo1, alpha, beta };
}

function assertPositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--${name} must be a positive integer.`);
  }
}

function printUsage() {
  console.log(`Usage: node examples/match.mjs [options]

Plays an engine-vs-engine match (alternating colors, diverse openings) and
reports the relative strength as an Elo difference with a 95% confidence
margin. This is the strength signal: it measures who wins games, not
per-position agreement with an oracle.

Engine specs (--a / --b):
  js          JavaScript reference engine (default for A)
  local-cpp   in-repo native C++ engine (build/xiangqi-native; default for B)
  pikafish    installed Pikafish (run npm run install:pikafish first)
  <command>   path to any UCI engine binary

Options:
  --a SPEC          Engine A (default: js)
  --b SPEC          Engine B (default: local-cpp)
  --games N         Number of games, colors alternate (default: 10)
  --depth N         Fixed search depth for BOTH engines
  --time MS         Fixed movetime in ms for BOTH engines (default: 500)
  --lines N         Candidate lines (MultiPV) for both engines
  --threads N       Threads option for native engines
  --opening-plies N Random plies used to diversify opening positions (default: 4)
  --seed N          Seed for the opening generator (reproducible runs)
  --no-book         Disable opening-book moves (JS engine)
  --profile NAME    JS engine profile when a side is js (default: fast)
  --a-depth N       Per-side depth override for A (handicapping)
  --b-depth N       Per-side depth override for B
  --a-time MS       Per-side movetime override for A
  --b-time MS       Per-side movetime override for B
  --a-elo N         Limit A's strength to N Elo (native UCI_LimitStrength)
  --b-elo N         Limit B's strength to N Elo (e.g. handicap Pikafish)
  --sprt e0,e1      Enable SPRT early-stop testing H0:elo=e0 vs H1:elo=e1
                    (optionally e0,e1,alpha,beta; --games becomes the cap)
  --out FILE        Write the full JSON report to FILE (result tracking)
  --json            Also print the full machine-readable report
  --quiet           Suppress per-game progress

Examples:
  node examples/match.mjs --a js --b local-cpp --games 20 --time 500
  node examples/match.mjs --a local-cpp --b pikafish --games 30 --time 1000 --threads 1
  node examples/match.mjs --a local-cpp --b pikafish --b-elo 2000 --sprt 0,20 --games 200
  node examples/match.mjs --a local-cpp --b js --games 100 --out results/run1.json
`);
}
