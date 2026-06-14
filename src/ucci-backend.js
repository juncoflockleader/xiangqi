import { spawn } from "node:child_process";
import {
  makeMove,
  moveKey,
  moveToNotation,
  parseMoveNotation,
  pieceLabel,
  sameMove,
  toFen
} from "./board.js";
import { ENGINE_BACKEND_FEATURES, createEngineBackend } from "./backend.js";
import { bookMoveToCandidate } from "./book.js";
import { createEngine } from "./engine.js";
import { explainBookMove, explainMoveFeatures, formatScore } from "./reasoning.js";
import { annotateMove, generateLegalMoves } from "./movegen.js";
import { hasClockTimeControl, resolveSearchBudget } from "./time.js";

const DEFAULT_UCCI_TIMEOUT_MS = 5000;
const DEFAULT_SEARCH_TIMEOUT_MS = 30000;

export function createUcciEngineBackend(options = {}) {
  if (!options.command) {
    throw new Error("UCCI backend requires a command.");
  }

  const referenceEngine = options.referenceEngine ?? createEngine(options.referenceOptions ?? options);
  const client = new UcciProcessClient(options);
  const name = options.name ?? "Native UCCI Engine";

  return createEngineBackend({
    id: options.id ?? "native-ucci",
    name,
    kind: "native-ucci",
    description: options.description ?? "External UCCI-compatible engine backend for stronger native or WASM search.",
    features: [
      ENGINE_BACKEND_FEATURES.UCCI_COMPATIBLE,
      ENGINE_BACKEND_FEATURES.NATIVE_READY,
      ENGINE_BACKEND_FEATURES.ASYNC_SEARCH
    ],
    chooseMove: async (position, searchOptions = {}) => {
      const mergedOptions = mergeNativeOptions(options, searchOptions, {
        lines: 1,
        backendName: name
      });
      const bookResult = maybeBookResult(referenceEngine, position, mergedOptions);
      if (bookResult) return bookResult;
      return nativeSearch(client, position, mergedOptions);
    },
    analyzePosition: async (position, searchOptions = {}) => {
      const lineCount = normalizeLineCount(searchOptions.lines ?? searchOptions.multiPv ?? searchOptions.multipv ?? options.lines ?? 3);
      const result = await nativeSearch(client, position, mergeNativeOptions(options, searchOptions, {
        lines: lineCount,
        backendName: name
      }));
      const bestScore = result.score;

      return {
        ...result,
        lines: result.candidates.slice(0, lineCount).map((candidate, index) => ({
          rank: index + 1,
          move: candidate.move,
          score: Math.round(candidate.score),
          centipawnLoss: Math.max(0, Math.round(bestScore - candidate.score)),
          principalVariation: candidate.principalVariation.map((move) => move.notation ?? moveToNotation(move)),
          explanation: explainNativeCandidate(position, candidate, {
            rank: index + 1,
            bestScore,
            depth: result.depth,
            backendName: name
          })
        }))
      };
    },
    reviewMove: (position, move, reviewOptions = {}) => referenceEngine.reviewMove(position, move, reviewOptions),
    openingBook: (position, bookOptions = {}) => referenceEngine.openingBook(position, bookOptions),
    evaluate: (position, evaluationOptions = {}) => referenceEngine.evaluate(position, evaluationOptions),
    pressure: (position, pressureOptions = {}) => referenceEngine.pressure(position, pressureOptions),
    play: (position, notation) => referenceEngine.play(position, notation),
    legalMoves: (position) => referenceEngine.legalMoves(position),
    ready: () => client.ensureReady(),
    close: () => client.close()
  });
}

class UcciProcessClient {
  constructor(options) {
    this.command = options.command;
    this.args = options.args ?? [];
    this.cwd = options.cwd;
    this.env = options.env;
    this.shell = options.shell ?? false;
    this.engineOptions = options.engineOptions ?? {};
    this.startupTimeoutMs = options.startupTimeoutMs ?? DEFAULT_UCCI_TIMEOUT_MS;
    this.child = null;
    this.lines = [];
    this.waiters = new Set();
    this.ready = false;
    this.stderr = "";
  }

  start() {
    if (this.child) return;

    this.child = spawn(this.command, this.args, {
      cwd: this.cwd,
      env: this.env ? { ...process.env, ...this.env } : process.env,
      shell: this.shell,
      stdio: ["pipe", "pipe", "pipe"]
    });

    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (chunk) => this.acceptOutput(chunk));
    this.child.stderr.on("data", (chunk) => {
      this.stderr += chunk;
    });
    this.child.on("exit", (code, signal) => this.rejectWaiters(new Error(`UCCI engine exited with code ${code ?? "null"} signal ${signal ?? "null"}.`)));
    this.child.on("error", (error) => this.rejectWaiters(error));
  }

  async ensureReady() {
    if (this.ready) return;
    this.start();

    await this.commandUntil("ucci", (lines) => lines.some((line) => line === "ucciok"), this.startupTimeoutMs);

    for (const [name, value] of Object.entries(this.engineOptions)) {
      this.write(`setoption name ${name} value ${value}`);
    }

    await this.commandUntil("isready", (lines) => lines.some((line) => line === "readyok"), this.startupTimeoutMs);
    this.ready = true;
  }

  async search(position, options = {}) {
    await this.ensureReady();

    this.write(`position fen ${toFen(position)}`);

    const bannedMoves = options.bannedMoves ?? [];
    if (bannedMoves.length > 0) {
      this.write(`banmoves ${bannedMoves.map(compactMove).join(" ")}`);
    }

    const timeBudget = resolveSearchBudget(options, options.side ?? position.turn);
    const timeoutMs = options.commandTimeoutMs ?? Math.max(DEFAULT_SEARCH_TIMEOUT_MS, timeBudget.timeLimitMs + 5000);
    return this.commandUntil(formatGoCommand(options), (lines) => lines.some((line) => line.startsWith("bestmove ")), timeoutMs);
  }

  async commandUntil(command, predicate, timeoutMs) {
    const startIndex = this.lines.length;
    const pending = this.waitFor(predicate, timeoutMs, startIndex, command);
    this.write(command);
    return pending;
  }

  write(line) {
    if (!this.child || this.child.killed || !this.child.stdin.writable) {
      throw new Error("UCCI engine process is not writable.");
    }
    this.child.stdin.write(`${line}\n`);
  }

  acceptOutput(chunk) {
    for (const rawLine of chunk.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      this.lines.push(line);
      this.checkWaiters();
    }
  }

  waitFor(predicate, timeoutMs, startIndex, label) {
    return new Promise((resolve, reject) => {
      const waiter = {
        startIndex,
        predicate,
        resolve,
        reject,
        timer: setTimeout(() => {
          this.waiters.delete(waiter);
          reject(new Error(`Timed out waiting for UCCI response to ${label}.`));
        }, timeoutMs)
      };

      this.waiters.add(waiter);
      this.checkWaiter(waiter);
    });
  }

  checkWaiters() {
    for (const waiter of [...this.waiters]) {
      this.checkWaiter(waiter);
    }
  }

  checkWaiter(waiter) {
    const collected = this.lines.slice(waiter.startIndex);
    if (!waiter.predicate(collected)) return;

    clearTimeout(waiter.timer);
    this.waiters.delete(waiter);
    waiter.resolve(collected);
  }

  rejectWaiters(error) {
    for (const waiter of [...this.waiters]) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
    this.waiters.clear();
  }

  async close() {
    if (!this.child) return;

    const child = this.child;
    this.child = null;
    this.ready = false;

    await new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      child.once("exit", finish);
      if (!child.killed && child.stdin.writable) {
        child.stdin.write("quit\n");
      }

      const timer = setTimeout(() => {
        if (!child.killed) child.kill();
        finish();
      }, 250);
      timer.unref?.();
    });
  }
}

async function nativeSearch(client, position, options) {
  const searchOptions = { ...options, side: position.turn };
  const rawLines = await client.search(position, searchOptions);
  const parsed = parseUcciSearch(rawLines, position);
  const result = {
    source: "native-ucci",
    bestMove: parsed.bestMove,
    score: parsed.score,
    depth: parsed.depth,
    nodes: parsed.nodes,
    principalVariation: parsed.principalVariation,
    candidates: parsed.candidates,
    iterations: parsed.iterations,
    timedOut: false,
    tableSize: null,
    stats: createNativeStats(parsed),
    raw: rawLines
  };

  return {
    ...result,
    explanation: explainNativeMove(position, result, options.backendName)
  };
}

function maybeBookResult(referenceEngine, position, options) {
  if (options.useBook === false) return null;

  const bookHit = referenceEngine.openingBook(position, options);
  if (!bookHit) return null;

  const candidates = bookHit.entries.map(bookMoveToCandidate);
  const result = {
    source: bookHit.source ?? "opening-book",
    bestMove: bookHit.move,
    score: bookHit.entry.weight,
    depth: 0,
    nodes: 0,
    principalVariation: [bookHit.move],
    candidates,
    iterations: [],
    timedOut: false,
    tableSize: null,
    stats: createEmptyStats(),
    book: {
      name: bookHit.entry.name,
      idea: bookHit.entry.idea,
      tags: bookHit.entry.tags,
      weight: bookHit.entry.weight
    },
    bookAlternatives: bookHit.entries,
    native: {
      skipped: true,
      reason: "opening-book"
    }
  };

  return {
    ...result,
    explanation: explainBookMove(position, result)
  };
}

function parseUcciSearch(lines, position) {
  const bestLine = [...lines].reverse().find((line) => line.startsWith("bestmove "));
  if (!bestLine) throw new Error("UCCI search did not return bestmove.");

  const bestToken = bestLine.split(/\s+/)[1];
  const bestMove = bestToken === "0000" ? null : resolveLegalMove(position, bestToken);
  const infos = lines
    .filter((line) => line.startsWith("info "))
    .map(parseInfoLine)
    .filter(Boolean);
  const pvInfos = infos.filter((info) => info.pv.length > 0);
  const primaryInfo = choosePrimaryInfo(pvInfos, bestToken) ?? infos.at(-1) ?? {};
  const principalVariation = primaryInfo.pv
    ? resolvePrincipalVariation(position, primaryInfo.pv)
    : bestMove ? [bestMove] : [];
  const candidates = buildNativeCandidates(position, pvInfos, bestMove, primaryInfo);

  return {
    bestMove,
    score: primaryInfo.score ?? 0,
    depth: maxInfoValue(infos, "depth"),
    nodes: maxInfoValue(infos, "nodes"),
    principalVariation,
    candidates,
    iterations: infos
      .filter((info) => info.depth && info.pv.length > 0)
      .map((info) => ({
        depth: info.depth,
        bestMove: resolvePrincipalVariation(position, info.pv)[0] ?? null,
        score: info.score ?? 0,
        nodes: info.nodes ?? 0,
        principalVariation: resolvePrincipalVariation(position, info.pv),
        candidates: [],
        stableBestMove: null,
        stats: createNativeStats({ nodes: info.nodes ?? 0 })
      }))
  };
}

function parseInfoLine(line) {
  const tokens = line.split(/\s+/);
  const info = {
    depth: 0,
    nodes: 0,
    multipv: 1,
    score: null,
    pv: []
  };

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index].toLowerCase();
    if (token === "depth") {
      info.depth = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "nodes") {
      info.nodes = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "multipv") {
      info.multipv = Number.parseInt(tokens[index + 1], 10) || 1;
      index += 1;
    } else if (token === "score") {
      const kind = tokens[index + 1]?.toLowerCase();
      const value = Number.parseInt(tokens[index + 2], 10);
      if (kind === "cp") info.score = Number.isFinite(value) ? value : 0;
      if (kind === "mate") info.score = Number.isFinite(value) ? Math.sign(value || 1) * (100000 - Math.abs(value)) : 0;
      index += 2;
    } else if (token === "pv") {
      info.pv = tokens.slice(index + 1);
      break;
    }
  }

  return info;
}

function choosePrimaryInfo(infos, bestToken) {
  return [...infos].reverse().find((info) => info.pv[0] === bestToken || moveKeyMatches(info.pv[0], bestToken))
    ?? infos.find((info) => info.multipv === 1)
    ?? infos.at(-1);
}

function buildNativeCandidates(position, infos, bestMove, primaryInfo) {
  const candidates = infos
    .sort((a, b) => a.multipv - b.multipv)
    .map((info) => {
      const principalVariation = resolvePrincipalVariation(position, info.pv);
      const move = principalVariation[0];
      if (!move) return null;
      return {
        move,
        score: info.score ?? 0,
        principalVariation,
        native: {
          depth: info.depth,
          nodes: info.nodes,
          multipv: info.multipv
        }
      };
    })
    .filter(Boolean);

  if (candidates.length > 0) return candidates;
  if (!bestMove) return [];

  return [{
    move: bestMove,
    score: primaryInfo.score ?? 0,
    principalVariation: [bestMove],
    native: {
      depth: primaryInfo.depth ?? 0,
      nodes: primaryInfo.nodes ?? 0,
      multipv: 1
    }
  }];
}

function resolveLegalMove(position, notation) {
  const parsed = parseMoveNotation(notation);
  const legalMove = generateLegalMoves(position, position.turn)
    .find((move) => sameMove(move, parsed));

  if (!legalMove) {
    throw new Error(`UCCI engine returned illegal move: ${notation}`);
  }

  return annotateMove(position, legalMove);
}

function resolvePrincipalVariation(position, moveTexts) {
  let current = position;
  const line = [];

  for (const moveText of moveTexts) {
    const parsed = parseMoveNotation(moveText);
    const legalMove = generateLegalMoves(current, current.turn)
      .find((move) => sameMove(move, parsed));
    if (!legalMove) break;

    const annotated = annotateMove(current, legalMove);
    line.push(annotated);
    current = makeMove(current, legalMove);
  }

  return line;
}

function explainNativeMove(position, result, backendName) {
  const move = result.bestMove;
  if (!move) {
    return {
      summary: `${backendName} found no legal move.`,
      reasons: ["The native UCCI backend returned bestmove 0000."],
      alternatives: [],
      principalVariation: []
    };
  }

  const moveStory = explainMoveFeatures(position, move);
  const reasons = [
    `${backendName} selected this move through UCCI search.`,
    `The native search reported depth ${result.depth} and ${result.nodes} nodes.`,
    `It reported a score of ${formatScore(result.score)} for the side to move.`,
    ...moveStory.reasons
  ];
  const principalVariation = result.principalVariation.map((candidate) => candidate.notation ?? moveToNotation(candidate));

  if (principalVariation.length > 1) {
    reasons.push(`The reported principal variation continues ${principalVariation.slice(1, 4).join(" ")}.`);
  }

  return {
    summary: `${pieceLabel(move.piece)} ${moveToNotation(move)} is selected by ${backendName} at depth ${result.depth}, with a reported score of ${formatScore(result.score)}.`,
    reasons: unique(reasons).slice(0, 7),
    alternatives: result.candidates.slice(0, 5).map((candidate, index) => ({
      rank: index + 1,
      move: candidate.move.notation,
      score: Math.round(candidate.score),
      note: `native UCCI line ${candidate.native?.multipv ?? index + 1} at depth ${candidate.native?.depth ?? result.depth}`
    })),
    principalVariation,
    principalVariationText: principalVariation.join(" "),
    evaluationDelta: moveStory.evaluationDelta,
    search: {
      depth: result.depth,
      nodes: result.nodes,
      timedOut: result.timedOut,
      tableSize: result.tableSize,
      stats: result.stats,
      iterations: result.iterations
    }
  };
}

function explainNativeCandidate(position, candidate, context) {
  const moveStory = explainMoveFeatures(position, candidate.move);
  const centipawnLoss = Math.max(0, Math.round((context.bestScore ?? candidate.score) - candidate.score));
  const principalVariation = (candidate.principalVariation ?? [])
    .map((move) => move.notation ?? moveToNotation(move));
  const reasons = [
    context.rank === 1
      ? `This is ${context.backendName}'s top native candidate.`
      : `This native line trails the top line by about ${centipawnLoss} centipawns.`,
    ...moveStory.reasons
  ];

  return {
    summary: `Native candidate ${context.rank}: ${pieceLabel(candidate.move.piece)} ${candidate.move.notation} scores ${formatScore(candidate.score)} at depth ${context.depth}.`,
    reasons: unique(reasons).slice(0, 7),
    principalVariation,
    principalVariationText: principalVariation.join(" "),
    evaluationDelta: moveStory.evaluationDelta,
    centipawnLoss
  };
}

function formatGoCommand(options) {
  const depth = Math.max(1, Number.parseInt(options.depth ?? 4, 10) || 4);
  const lines = normalizeLineCount(options.lines ?? options.multiPv ?? options.multipv ?? 1);
  const explicitMoveTime = numberOption(options.timeLimitMs, options.movetime, options.moveTimeMs, options.moveTime);
  const parts = ["go", "depth", depth];

  if (hasClockTimeControl(options) && explicitMoveTime === null) {
    addGoNumber(parts, "wtime", options.wtime ?? options.redTimeMs ?? options.redTime);
    addGoNumber(parts, "btime", options.btime ?? options.blackTimeMs ?? options.blackTime);
    addGoNumber(parts, "winc", options.winc ?? options.redIncrementMs ?? options.redIncrement);
    addGoNumber(parts, "binc", options.binc ?? options.blackIncrementMs ?? options.blackIncrement);
    addGoNumber(parts, "movestogo", options.movestogo ?? options.movesToGo);
  } else {
    const timeBudget = resolveSearchBudget(options, options.side);
    parts.push("movetime", timeBudget.timeLimitMs);
  }

  if (lines > 1) parts.push("multipv", lines);
  return parts.join(" ");
}

function mergeNativeOptions(baseOptions, searchOptions, extras) {
  const merged = {
    ...baseOptions,
    ...searchOptions,
    ...extras
  };

  const searchHasClock = hasClockTimeControl(searchOptions);
  const searchHasExplicitMoveTime = numberOption(
    searchOptions.timeLimitMs,
    searchOptions.movetime,
    searchOptions.moveTimeMs,
    searchOptions.moveTime
  ) !== null;

  if (searchHasClock && !searchHasExplicitMoveTime) {
    delete merged.timeLimitMs;
    delete merged.movetime;
    delete merged.moveTimeMs;
    delete merged.moveTime;
  }

  return merged;
}

function addGoNumber(parts, name, value) {
  const parsed = numberOption(value);
  if (parsed !== null) parts.push(name, Math.max(0, Math.floor(parsed)));
}

function createNativeStats(parsed) {
  return {
    ...createEmptyStats(),
    nodes: parsed.nodes ?? 0,
    native: true
  };
}

function createEmptyStats() {
  return {
    nodes: 0,
    qnodes: 0,
    qchecks: 0,
    ttHits: 0,
    ttStores: 0,
    ttReplacements: 0,
    ttEvictions: 0,
    ttSkips: 0,
    cutoffs: 0,
    aspirationSearches: 0,
    aspirationFailHigh: 0,
    aspirationFailLow: 0,
    extensions: 0,
    futilityPrunes: 0,
    reductions: 0,
    lmrResearches: 0,
    pvsResearches: 0,
    nullMovePrunes: 0,
    repetitions: 0
  };
}

function maxInfoValue(infos, key) {
  return infos.reduce((max, info) => Math.max(max, info[key] ?? 0), 0);
}

function normalizeLineCount(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(12, parsed));
}

function numberOption(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function compactMove(move) {
  return (typeof move === "string" ? move : move.notation ?? moveToNotation(move)).replace("-", "");
}

function moveKeyMatches(left, right) {
  if (!left || !right) return false;
  if (left === "0000" || right === "0000") return false;
  return moveKey(parseMoveNotation(left)) === moveKey(parseMoveNotation(right));
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}
