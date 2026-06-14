#!/usr/bin/env node
import {
  createInitialPosition,
  createUcciEngineBackend,
  describeEngineBackend,
  parseFen
} from "../src/index.js";
import {
  formatNativeOptions,
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

if (!options.command) {
  console.error("Native probe requires --command or XIANGQI_ENGINE_COMMAND.");
  console.error("");
  printUsage();
  process.exit(1);
}

const backend = createUcciEngineBackend({
  command: options.command,
  args: options.args,
  protocol: options.protocol,
  depth: options.depth,
  timeLimitMs: options.timeLimitMs,
  startupTimeoutMs: options.startupTimeoutMs,
  commandTimeoutMs: options.commandTimeoutMs,
  engineOptions: options.engineOptions
});

try {
  const position = options.initialFen ? parseFen(options.initialFen) : createInitialPosition();
  const decision = await backend.chooseMove(position, {
    useBook: false,
    depth: options.depth,
    timeLimitMs: options.timeLimitMs,
    lines: options.lines
  });
  const review = options.reviewMove
    ? await backend.reviewMove(position, options.reviewMove, {
        depth: options.depth,
        timeLimitMs: options.timeLimitMs
      })
    : null;
  const report = buildProbeReport(describeEngineBackend(backend), decision, review, options);

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatProbeReport(report));
  }
} finally {
  await backend.close();
}

function parseArgs(args) {
  const options = {
    command: process.env.XIANGQI_ENGINE_COMMAND,
    args: splitEnvArgs(process.env.XIANGQI_ENGINE_ARGS),
    protocol: process.env.XIANGQI_ENGINE_PROTOCOL ?? "uci",
    depth: numberFromEnv(process.env.XIANGQI_ENGINE_DEPTH, 4),
    timeLimitMs: numberFromEnv(process.env.XIANGQI_ENGINE_TIME_MS, 1000),
    lines: numberFromEnv(process.env.XIANGQI_ENGINE_LINES, 3),
    startupTimeoutMs: numberFromEnv(process.env.XIANGQI_ENGINE_STARTUP_TIMEOUT_MS, 5000),
    commandTimeoutMs: numberFromEnv(process.env.XIANGQI_ENGINE_COMMAND_TIMEOUT_MS, 30000),
    engineOptions: parseNativeEngineOptions(process.env.XIANGQI_ENGINE_OPTIONS, "XIANGQI_ENGINE_OPTIONS"),
    initialFen: process.env.XIANGQI_PROBE_FEN,
    reviewMove: process.env.XIANGQI_PROBE_REVIEW_MOVE,
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
    if (arg === "--command") {
      options.command = args[++index];
      continue;
    }
    if (arg === "--arg") {
      options.args.push(args[++index]);
      continue;
    }
    if (arg === "--args") {
      options.args.push(...splitEnvArgs(args[++index]));
      continue;
    }
    if (arg === "--protocol") {
      options.protocol = args[++index];
      continue;
    }
    if (arg === "--option") {
      options.engineOptions.push(parseNativeEngineOption(args[++index], "--option"));
      continue;
    }
    if (arg === "--depth") {
      options.depth = Number(args[++index]);
      continue;
    }
    if (arg === "--time") {
      options.timeLimitMs = Number(args[++index]);
      continue;
    }
    if (arg === "--lines") {
      options.lines = Number(args[++index]);
      continue;
    }
    if (arg === "--fen") {
      options.initialFen = args[++index];
      continue;
    }
    if (arg === "--review") {
      options.reviewMove = args[++index];
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

  assertProtocol(options.protocol);
  assertPositiveInteger(options.depth, "depth");
  assertPositiveInteger(options.timeLimitMs, "time");
  assertPositiveInteger(options.lines, "lines");
  assertPositiveInteger(options.startupTimeoutMs, "startup-timeout");
  assertPositiveInteger(options.commandTimeoutMs, "command-timeout");
  return options;
}

function buildProbeReport(backend, decision, review, options) {
  return {
    ok: true,
    command: options.command,
    args: [...options.args],
    protocol: options.protocol,
    backend,
    nativeOptions: backend.nativeOptions,
    bestMove: notationFor(decision.bestMove),
    source: decision.source,
    score: Math.round(decision.score ?? 0),
    scoreDetail: decision.scoreDetail ?? decision.explanation?.search?.scoreDetail ?? null,
    wdl: decision.wdl ?? decision.explanation?.search?.wdl ?? null,
    depth: decision.depth ?? 0,
    nodes: decision.nodes ?? 0,
    principalVariation: (decision.principalVariation ?? []).map(notationFor),
    summary: decision.explanation?.summary ?? "",
    reasons: [...(decision.explanation?.reasons ?? [])],
    comparison: decision.explanation?.comparison ?? null,
    alternatives: (decision.explanation?.alternatives ?? []).map((alternative) => ({
      rank: alternative.rank,
      move: alternative.move,
      score: alternative.score,
      scoreDetail: alternative.scoreDetail ?? null,
      wdl: alternative.wdl ?? null,
      centipawnLoss: alternative.centipawnLoss,
      verdict: alternative.verdict,
      summary: alternative.summary
    })),
    review: review ? {
      move: notationFor(review.move),
      bestMove: notationFor(review.bestMove),
      classification: review.classification,
      centipawnLoss: review.centipawnLoss,
      playedScore: review.playedScore,
      bestScore: review.bestScore,
      bestScoreDetail: review.bestAnalysis?.scoreDetail ?? null,
      bestWdl: review.bestAnalysis?.wdl ?? null,
      summary: review.explanation?.summary ?? ""
    } : null
  };
}

function formatProbeReport(report) {
  const lines = [
    `Native probe: ${report.backend.name} (${report.backend.kind})`,
    `Protocol: ${report.protocol}`,
    `Options: ${report.nativeOptions.length > 0 ? formatNativeOptions(report.nativeOptions) : "none"}`,
    `Best move: ${report.bestMove} (${report.source}, d${report.depth}, ${formatNodes(report.nodes)} nodes, ${formatScoreDetail(report)})`
  ];

  if (report.summary) lines.push(`Summary: ${report.summary}`);
  if (report.wdl?.text) lines.push(`WDL: ${report.wdl.text}`);
  if (report.comparison?.reason) {
    lines.push(`Comparison: ${report.comparison.reason}`);
  }
  const displayedReasons = report.reasons
    .filter((reason) => reason !== report.comparison?.reason)
    .slice(0, 4);
  for (const reason of displayedReasons) {
    lines.push(`Reason: ${reason}`);
  }

  if (report.alternatives.length > 0) {
    lines.push("Alternatives:");
    for (const alternative of report.alternatives.slice(0, 5)) {
      const wdl = alternative.wdl?.text ? `, WDL ${alternative.wdl.text}` : "";
      lines.push(`  ${alternative.rank}. ${alternative.move}: ${alternative.verdict}, loss ${alternative.centipawnLoss} cp, ${formatScoreDetail(alternative)}${wdl}`);
    }
  }

  if (report.review) {
    lines.push(`Review ${report.review.move}: ${report.review.classification}, loss ${report.review.centipawnLoss} cp, best ${report.review.bestMove}`);
    if (report.review.bestScoreDetail?.text) lines.push(`Review best score: ${report.review.bestScoreDetail.text}`);
    if (report.review.bestWdl?.text) lines.push(`Review WDL: ${report.review.bestWdl.text}`);
    if (report.review.summary) lines.push(`Review summary: ${report.review.summary}`);
  }

  return lines.join("\n");
}

function numberFromEnv(value, fallback) {
  if (value === undefined || value === "") return fallback;
  return Number(value);
}

function assertProtocol(value) {
  if (value !== "uci" && value !== "ucci") {
    throw new Error("--protocol must be uci or ucci.");
  }
}

function assertPositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--${name} must be a positive integer.`);
  }
}

function notationFor(move) {
  if (!move) return null;
  return move.notation ?? `${move.from?.file}${move.from?.rank}-${move.to?.file}${move.to?.rank}`;
}

function formatNodes(value) {
  return Math.round(value ?? 0).toLocaleString("en-US");
}

function formatCentipawns(value) {
  const rounded = Math.round(value ?? 0);
  return `${rounded >= 0 ? "+" : ""}${rounded} cp`;
}

function formatScoreDetail(entry) {
  return entry.scoreDetail?.text ?? formatCentipawns(entry.score);
}

function printUsage() {
  console.log(`Usage: node examples/native-probe.mjs [options]

Checks a configured native UCI/UCCI Xiangqi engine by running a pure native
search from the initial position or a supplied FEN.

Options:
  --command CMD          Native UCI/UCCI executable
  --arg VALUE            Append one native process argument
  --args VALUES          Append whitespace-separated native process arguments
  --protocol uci|ucci    Native protocol (default: uci)
  --option OPT           Set a native option (name=value or button name)
  --depth N              Native search depth (default: 4)
  --time MS              Native movetime in ms (default: 1000)
  --lines N              Candidate lines to request (default: 3)
  --fen FEN              Probe a custom FEN
  --review MOVE          Also review one move from the probe position
  --json                 Print machine-readable JSON

Environment:
  XIANGQI_ENGINE_COMMAND, XIANGQI_ENGINE_ARGS, XIANGQI_ENGINE_PROTOCOL,
  XIANGQI_ENGINE_OPTIONS, XIANGQI_ENGINE_DEPTH, XIANGQI_ENGINE_TIME_MS,
  XIANGQI_ENGINE_LINES, XIANGQI_PROBE_FEN, XIANGQI_PROBE_REVIEW_MOVE
`);
}
