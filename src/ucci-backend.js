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
import { ENGINE_BACKEND_FEATURES, createEngineBackend, summarizeEngineSettings } from "./backend.js";
import { bookMoveToCandidate } from "./book.js";
import { classifyMoveLoss, createEngine } from "./engine.js";
import { analyzeReviewMistakes } from "./mistakes.js";
import { mergeNativeEngineOptions } from "./native-presets.js";
import { compareLinePlans, summarizePlanComparisonEvidence } from "./plan-comparison.js";
import { practiceFocusFromReview } from "./practice.js";
import { assessSearchConfidence, buildLinePlan, explainBookMove, explainMoveFeatures, explainReviewedMove, formatScore } from "./reasoning.js";
import { annotateMove, generateLegalMoves } from "./movegen.js";
import { hasClockTimeControl, resolveSearchBudget } from "./time.js";
import { reviewGameWithBackend } from "./review.js";
import { coachMoveWithBackend } from "./coach.js";
import { createLessonPlanWithBackend } from "./lesson.js";
import { studyPositionWithBackend } from "./study.js";
import { createGameStudyWithBackend } from "./game-study.js";
import { resolveEngineOptions } from "./profiles.js";

const DEFAULT_UCCI_TIMEOUT_MS = 5000;
const DEFAULT_SEARCH_TIMEOUT_MS = 30000;

export function createUcciEngineBackend(options = {}) {
  const backendOptions = resolveEngineOptions({
    ...options,
    engineOptions: mergeNativeEngineOptions(
      evalFileEngineOption(options.evalFile ?? options.nnue),
      options.engineOptions
    )
  });
  if (!backendOptions.command) {
    throw new Error("Native engine backend requires a command.");
  }

  const referenceEngine = backendOptions.referenceEngine ?? createEngine(backendOptions.referenceOptions ?? backendOptions);
  const client = new UcciProcessClient(backendOptions);
  const protocol = normalizeNativeProtocol(backendOptions.protocol);
  const source = nativeSource(protocol);
  const name = backendOptions.name ?? (protocol === "uci" ? "Native UCI Engine" : "Native UCCI Engine");
  let backend;

  backend = createEngineBackend({
    id: backendOptions.id ?? source,
    name,
    kind: source,
    description: backendOptions.description ?? "External UCI/UCCI-compatible engine backend for stronger native or WASM search.",
    settings: summarizeEngineSettings({ ...backendOptions, protocol }),
    features: [
      protocol === "uci" ? ENGINE_BACKEND_FEATURES.UCI_COMPATIBLE : ENGINE_BACKEND_FEATURES.UCCI_COMPATIBLE,
      ENGINE_BACKEND_FEATURES.NATIVE_READY,
      ENGINE_BACKEND_FEATURES.ASYNC_SEARCH,
      ENGINE_BACKEND_FEATURES.EXPLANATION,
      ENGINE_BACKEND_FEATURES.OPENING_BOOK,
      ENGINE_BACKEND_FEATURES.REVIEW,
      ENGINE_BACKEND_FEATURES.PRESSURE
    ],
    chooseMove: async (position, searchOptions = {}) => {
      const lineCount = resolveNativeChooseMoveLines(backendOptions, searchOptions);
      const mergedOptions = mergeNativeOptions(backendOptions, searchOptions, {
        lines: lineCount,
        backendName: name,
        protocol
      });
      const bookResult = maybeBookResult(referenceEngine, position, mergedOptions);
      if (bookResult) {
        const validation = await validateNativeOpeningHeuristic(client, position, bookResult, mergedOptions);
        if (!validation) return bookResult;
        if (validation.accepted) {
          const accepted = {
            ...bookResult,
            openingHeuristicValidation: validation.summary,
            native: {
              skipped: true,
              reason: "opening-heuristic-accepted-after-native-validation",
              validationSource: nativeSource(protocol)
            }
          };
          return {
            ...accepted,
            explanation: explainBookMove(position, accepted)
          };
        }

        const guardedSearch = {
          ...validation.search,
          openingHeuristicValidation: validation.summary
        };

        return {
          ...guardedSearch,
          explanation: explainNativeMove(position, guardedSearch, name)
        };
      }
      return nativeSearch(client, position, mergedOptions);
    },
    analyzePosition: async (position, searchOptions = {}) => {
      const lineCount = normalizeLineCount(searchOptions.lines ?? searchOptions.multiPv ?? searchOptions.multipv ?? backendOptions.lines ?? 3);
      const result = await nativeSearch(client, position, mergeNativeOptions(backendOptions, searchOptions, {
        lines: lineCount,
        backendName: name,
        protocol
      }));
      const bestScore = result.score;

      return {
        ...result,
        lines: result.candidates.slice(0, lineCount).map((candidate, index) => ({
          rank: index + 1,
          move: candidate.move,
          score: Math.round(candidate.score),
          scoreDetail: candidate.scoreDetail ?? null,
          wdl: candidate.wdl ?? null,
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
    reviewMove: async (position, move, reviewOptions = {}) => nativeReviewMove(client, position, move, mergeNativeOptions(backendOptions, reviewOptions, {
      backendName: name,
      lines: resolveNativeReviewLines(backendOptions, reviewOptions),
      protocol,
      useBook: false
    })),
    reviewGame: (moves, gameOptions = {}) => {
      const { reviewOptions = {}, ...gameReviewOptions } = gameOptions;
      return reviewGameWithBackend(backend, moves, {
        ...gameReviewOptions,
        reviewOptions: mergeNativeOptions(backendOptions, reviewOptions, {
          backendName: name,
          lines: resolveNativeReviewLines(backendOptions, reviewOptions),
          protocol,
          useBook: false
        })
      });
    },
    coachMove: (position, coachOptions = {}) => coachMoveWithBackend(backend, position, coachOptions),
    studyPosition: (position, studyOptions = {}) => studyPositionWithBackend(backend, position, studyOptions),
    lessonPlan: (moves, lessonOptions = {}) => {
      const { reviewOptions = {}, ...planOptions } = lessonOptions;
      return createLessonPlanWithBackend(backend, moves, {
        ...planOptions,
        reviewOptions: mergeNativeOptions(backendOptions, reviewOptions, {
          backendName: name,
          lines: resolveNativeReviewLines(backendOptions, reviewOptions),
          protocol,
          useBook: false
        })
      });
    },
    gameStudy: (moves, gameStudyOptions = {}) => {
      const { reviewOptions = {}, studyOptions = {}, ...studyPlanOptions } = gameStudyOptions;
      return createGameStudyWithBackend(backend, moves, {
        ...studyPlanOptions,
        reviewOptions: mergeNativeOptions(backendOptions, reviewOptions, {
          backendName: name,
          lines: resolveNativeReviewLines(backendOptions, reviewOptions),
          protocol,
          useBook: false
        }),
        studyOptions: mergeNativeOptions(backendOptions, studyOptions, {
          backendName: name,
          protocol
        })
      });
    },
    openingBook: (position, bookOptions = {}) => referenceEngine.openingBook(position, bookOptions),
    evaluate: (position, evaluationOptions = {}) => referenceEngine.evaluate(position, evaluationOptions),
    pressure: (position, pressureOptions = {}) => referenceEngine.pressure(position, pressureOptions),
    play: (position, notation) => referenceEngine.play(position, notation),
    legalMoves: (position) => referenceEngine.legalMoves(position),
    ready: () => client.ensureReady(),
    close: () => client.close(),
    get nativeOptions() {
      return client.engineOptions.map((option) => ({ ...option }));
    }
  });

  return backend;
}

function evalFileEngineOption(evalFile) {
  return evalFile ? [{ name: "EvalFile", value: evalFile }] : [];
}

class UcciProcessClient {
  constructor(options) {
    this.command = options.command;
    this.args = options.args ?? [];
    this.cwd = options.cwd;
    this.env = options.env;
    this.shell = options.shell ?? false;
    this.protocol = normalizeNativeProtocol(options.protocol);
    this.engineOptions = normalizeNativeEngineOptions(options.engineOptions);
    this.startupTimeoutMs = options.startupTimeoutMs ?? DEFAULT_UCCI_TIMEOUT_MS;
    this.closeTimeoutMs = options.closeTimeoutMs ?? 250;
    this.child = null;
    this.lines = [];
    this.waiters = new Set();
    this.searchQueue = Promise.resolve();
    this.ready = false;
    this.stderr = "";
  }

  start() {
    if (this.child && !isChildExited(this.child)) return;
    this.child = null;
    this.ready = false;
    this.lines = [];
    this.stderr = "";

    const child = spawn(this.command, this.args, {
      cwd: this.cwd,
      env: this.env ? { ...process.env, ...this.env } : process.env,
      shell: this.shell,
      stdio: ["pipe", "pipe", "pipe"]
    });

    this.child = child;
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => this.acceptOutput(chunk));
    child.stderr.on("data", (chunk) => {
      this.stderr += chunk;
    });
    child.on("exit", (code, signal) => {
      this.handleProcessEnd(child, new Error(`UCCI engine exited with code ${code ?? "null"} signal ${signal ?? "null"}.`));
    });
    child.on("error", (error) => this.handleProcessEnd(child, error));
  }

  async ensureReady() {
    if (this.ready && this.child && !isChildExited(this.child) && this.child.stdin.writable) return;
    this.ready = false;
    this.start();

    const handshake = this.protocol === "uci"
      ? { command: "uci", ok: "uciok" }
      : { command: "ucci", ok: "ucciok" };

    await this.commandUntil(handshake.command, (lines) => lines.some((line) => line === handshake.ok), this.startupTimeoutMs);

    for (const option of this.engineOptions) {
      this.write(formatSetOptionCommand(option));
    }

    await this.commandUntil("isready", (lines) => lines.some((line) => line === "readyok"), this.startupTimeoutMs);
    this.ready = true;
  }

  async search(position, options = {}) {
    return this.enqueueSearch(() => this.searchWithRestart(position, options));
  }

  enqueueSearch(task) {
    const run = this.searchQueue.catch(() => null).then(task);
    this.searchQueue = run.catch(() => null);
    return run;
  }

  async searchWithRestart(position, options = {}) {
    try {
      return await this.searchOnce(position, options);
    } catch (error) {
      if (options.restartOnExit === false || !isRecoverableNativeProcessError(error)) {
        throw error;
      }

      await this.close();
      return this.searchOnce(position, options);
    }
  }

  async searchOnce(position, options = {}) {
    throwIfAborted(options.signal);
    await this.ensureReady();
    throwIfAborted(options.signal);

    this.write(`position fen ${toNativeFen(position, this.protocol)}`);

    const bannedMoves = options.bannedMoves ?? [];
    if (this.protocol === "ucci" && bannedMoves.length > 0) {
      this.write(`banmoves ${bannedMoves.map(compactMove).join(" ")}`);
    }
    const protocolOptions = {
      ...options,
      protocol: this.protocol,
      searchMoves: this.protocol === "uci" && bannedMoves.length > 0
        ? legalSearchMoves(position, bannedMoves)
        : options.searchMoves
    };
    const lineCount = normalizeLineCount(protocolOptions.lines ?? protocolOptions.multiPv ?? protocolOptions.multipv ?? 1);
    if (this.protocol === "uci") {
      this.write(`setoption name MultiPV value ${lineCount}`);
    }

    const timeBudget = resolveSearchBudget(protocolOptions, protocolOptions.side ?? position.turn, {}, { position });
    const timeoutMs = options.commandTimeoutMs ?? Math.max(DEFAULT_SEARCH_TIMEOUT_MS, timeBudget.timeLimitMs + 5000);
    return this.commandUntil(formatGoCommand(protocolOptions), (lines) => lines.some((line) => line.startsWith("bestmove ")), timeoutMs, {
      signal: options.signal,
      onAbort: () => {
        try {
          this.write("stop");
        } catch {
          // Process-end handlers reject waiters when the engine is already gone.
        }
      }
    });
  }

  handleProcessEnd(child, error) {
    if (this.child !== child) return;
    this.child = null;
    this.ready = false;
    this.rejectWaiters(error);
  }

  async commandUntil(command, predicate, timeoutMs, options = {}) {
    throwIfAborted(options.signal);
    const startIndex = this.lines.length;
    let commandStarted = false;
    const pending = this.waitFor(predicate, timeoutMs, startIndex, command, {
      ...options,
      onAbort: () => {
        if (commandStarted) options.onAbort?.();
      }
    });
    this.write(command);
    commandStarted = true;
    if (isAbortSignalAborted(options.signal)) {
      options.onAbort?.();
    }
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

  waitFor(predicate, timeoutMs, startIndex, label, options = {}) {
    return new Promise((resolve, reject) => {
      const signal = options.signal;
      const waiter = {
        startIndex,
        predicate,
        resolve,
        reject,
        aborted: false,
        abortError: null,
        timer: setTimeout(() => {
          cleanup();
          this.waiters.delete(waiter);
          reject(new Error(`Timed out waiting for UCCI response to ${label}.`));
        }, timeoutMs)
      };
      const onAbort = () => {
        waiter.aborted = true;
        waiter.abortError = createAbortError(signal);
        options.onAbort?.();
      };
      const cleanup = () => {
        clearTimeout(waiter.timer);
        signal?.removeEventListener?.("abort", onAbort);
      };
      waiter.cleanup = cleanup;

      this.waiters.add(waiter);
      signal?.addEventListener?.("abort", onAbort, { once: true });
      if (isAbortSignalAborted(signal)) {
        onAbort();
      }
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

    waiter.cleanup?.();
    if (!waiter.cleanup) clearTimeout(waiter.timer);
    this.waiters.delete(waiter);
    if (waiter.aborted) {
      waiter.reject(waiter.abortError ?? createAbortError());
      return;
    }

    waiter.resolve(collected);
  }

  rejectWaiters(error) {
    for (const waiter of [...this.waiters]) {
      waiter.cleanup?.();
      if (!waiter.cleanup) clearTimeout(waiter.timer);
      waiter.reject(error);
    }
    this.waiters.clear();
  }

  async close() {
    if (!this.child) return;

    const child = this.child;
    this.child = null;
    this.ready = false;
    this.rejectWaiters(new Error("UCCI engine backend closed."));

    if (isChildExited(child)) return;

    await new Promise((resolve) => {
      let settled = false;
      let timer = null;
      const onStdinError = () => {
        terminateChild(child);
        finish();
      };
      const finish = () => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        child.off("exit", finish);
        resolve();
      };

      child.once("exit", finish);
      child.stdin.once("error", onStdinError);
      if (isChildExited(child)) {
        finish();
        return;
      }

      if (!child.killed && child.stdin.writable) {
        try {
          child.stdin.write("quit\n");
        } catch {
          terminateChild(child);
        }
      } else {
        terminateChild(child);
      }

      timer = setTimeout(() => {
        terminateChild(child);
        finish();
      }, this.closeTimeoutMs);
    });
  }
}

function isChildExited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

function terminateChild(child) {
  if (child.killed || isChildExited(child)) return;
  try {
    child.kill();
  } catch {
    // The process may exit between the state check and kill call.
  }
}

function isRecoverableNativeProcessError(error) {
  const message = String(error?.message ?? "");
  return message.includes("UCCI engine exited")
    || message.includes("UCCI engine process is not writable")
    || error?.code === "EPIPE";
}

function throwIfAborted(signal) {
  if (isAbortSignalAborted(signal)) {
    throw createAbortError(signal);
  }
}

function isAbortSignalAborted(signal) {
  return Boolean(signal?.aborted);
}

function createAbortError(signal) {
  if (signal?.reason instanceof Error) return signal.reason;
  const reason = signal?.reason ? `: ${signal.reason}` : ".";
  const error = new Error(`Native search aborted${reason}`);
  error.name = "AbortError";
  return error;
}

async function nativeSearch(client, position, options) {
  const searchOptions = { ...options, side: position.turn };
  const protocol = normalizeNativeProtocol(options.protocol);
  const rawLines = await client.search(position, searchOptions);
  const parsed = parseUcciSearch(rawLines, position, protocol);
  const result = {
    source: nativeSource(protocol),
    protocol,
    bestMove: parsed.bestMove,
    score: parsed.score,
    scoreDetail: parsed.scoreDetail,
    wdl: parsed.wdl,
    depth: parsed.depth,
    seldepth: parsed.seldepth,
    nodes: parsed.nodes,
    timeMs: parsed.timeMs,
    nps: parsed.nps,
    hashfull: parsed.hashfull,
    telemetry: parsed.telemetry,
    ponderMove: parsed.ponderMove,
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

async function nativeReviewMove(client, position, moveOrNotation, options) {
  const move = resolveLegalMove(position, moveOrNotation);
  const bestAnalysis = await nativeSearch(client, position, options);
  const bestMove = bestAnalysis.bestMove;
  const isBestMove = sameMove(move, bestMove);
  const playedCandidate = isBestMove
    ? {
        score: bestAnalysis.score,
        scoreDetail: bestAnalysis.scoreDetail ?? null,
        wdl: bestAnalysis.wdl ?? null,
        principalVariation: bestAnalysis.principalVariation
      }
    : await analyzePlayedNativeMove(client, position, move, options);
  const playedPrincipalVariation = playedCandidate.principalVariation?.length
    ? playedCandidate.principalVariation
    : [annotateMove(position, move)];
  const centipawnLoss = Math.max(0, bestAnalysis.score - playedCandidate.score);
  const classification = isBestMove ? "best" : classifyMoveLoss(Math.max(16, centipawnLoss));
  const bestLinePlan = bestAnalysis.explanation?.linePlan ?? null;
  const playedLinePlan = buildLinePlan(position, playedPrincipalVariation, {
    perspective: position.turn
  });
  const reviewed = {
    source: nativeSource(options.protocol),
    move,
    bestMove,
    bestScore: Math.round(bestAnalysis.score),
    playedScore: Math.round(playedCandidate.score),
    playedScoreDetail: playedCandidate.scoreDetail ?? null,
    playedWdl: playedCandidate.wdl ?? null,
    centipawnLoss: Math.round(centipawnLoss),
    classification,
    isBestMove,
    principalVariation: playedPrincipalVariation.map((pvMove) => pvMove.notation ?? moveToNotation(pvMove)),
    bestAnalysis,
    bestExplanation: bestAnalysis.explanation,
    bestLinePlan,
    playedLinePlan,
    planComparison: compareLinePlans(playedLinePlan, bestLinePlan, {
      centipawnLoss: Math.round(centipawnLoss),
      classification
    }),
    bestComparison: bestAnalysis.explanation?.comparison ?? null,
    bestAlternatives: bestAnalysis.explanation?.alternatives ?? [],
    depth: bestAnalysis.depth,
    nodes: bestAnalysis.nodes + (playedCandidate.nodes ?? 0)
  };
  reviewed.mistakes = analyzeReviewMistakes(position, reviewed);
  reviewed.practiceFocus = practiceFocusFromReview(reviewed);

  return {
    ...reviewed,
    explanation: explainReviewedMove(position, reviewed)
  };
}

async function analyzePlayedNativeMove(client, position, move, options) {
  const after = makeMove(position, move);
  const reply = await nativeSearch(client, after, options);
  const annotated = annotateMove(position, move);

  return {
    score: normalizeScore(-reply.score),
    scoreDetail: invertScoreDetail(reply.scoreDetail, normalizeScore(-reply.score)),
    wdl: invertWdl(reply.wdl),
    nodes: reply.nodes,
    principalVariation: [
      annotated,
      ...reply.principalVariation
    ]
  };
}

function invertScoreDetail(scoreDetail, normalizedScore) {
  if (!scoreDetail) return null;
  const bound = invertScoreBound(scoreDetail.bound);

  if (scoreDetail.kind === "mate") {
    const value = Number.isFinite(scoreDetail.value) ? -scoreDetail.value : null;
    return {
      kind: "mate",
      value,
      bound,
      normalizedScore,
      text: formatNativeScoreDetail({
        scoreKind: "mate",
        mate: value,
        scoreValue: value,
        score: normalizedScore,
        scoreBound: bound
      })
    };
  }

  if (scoreDetail.kind === "cp") {
    const value = Number.isFinite(scoreDetail.value)
      ? normalizeScore(-scoreDetail.value)
      : normalizedScore;
    return {
      kind: "cp",
      value,
      bound,
      normalizedScore,
      text: formatNativeScoreDetail({
        scoreKind: "cp",
        scoreValue: value,
        score: normalizedScore,
        scoreBound: bound
      })
    };
  }

  return {
    kind: scoreDetail.kind ?? "unknown",
    value: null,
    bound,
    normalizedScore,
    text: formatScore(normalizedScore)
  };
}

function invertScoreBound(bound) {
  if (bound === "lower") return "upper";
  if (bound === "upper") return "lower";
  return null;
}

function invertWdl(wdl) {
  if (!wdl) return null;
  const inverted = {
    win: wdl.loss,
    draw: wdl.draw,
    loss: wdl.win,
    total: wdl.total
  };
  const safeTotal = inverted.total > 0
    ? inverted.total
    : inverted.win + inverted.draw + inverted.loss;

  return {
    ...inverted,
    total: safeTotal,
    expectation: safeTotal > 0 ? (inverted.win + inverted.draw / 2) / safeTotal : null,
    text: formatNativeWdl(inverted)
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

async function validateNativeOpeningHeuristic(client, position, bookResult, options) {
  if (bookResult.source !== "opening-heuristic") return null;
  if (options.validateOpeningHeuristics === false) return null;

  const validationOptions = mergeNativeOptions(options, {
    depth: options.openingHeuristicValidationDepth
      ?? Math.max(2, Math.min(options.depth ?? 4, 8)),
    timeLimitMs: options.openingHeuristicValidationTimeMs
      ?? Math.max(options.timeLimitMs ?? 1000, 750),
    useBook: false,
    lines: options.openingHeuristicValidationLines
      ?? Math.max(2, normalizeLineCount(options.lines ?? options.multiPv ?? options.multipv ?? 2))
  });
  const search = await nativeSearch(client, position, validationOptions);
  const candidate = search.candidates.find((entry) => sameMove(entry.move, bookResult.bestMove));
  const playedCandidate = candidate
    ? {
        score: candidate.score,
        nodes: 0,
        principalVariation: candidate.principalVariation
      }
    : sameMove(search.bestMove, bookResult.bestMove)
      ? {
          score: search.score,
          nodes: 0,
          principalVariation: search.principalVariation
        }
      : await analyzePlayedNativeMove(client, position, bookResult.bestMove, validationOptions);
  const maxLoss = options.openingHeuristicMaxCentipawnLoss ?? 160;
  const centipawnLoss = Math.max(0, Math.round(search.score - playedCandidate.score));
  const conclusive = search.depth >= 1 && !search.fallback;
  const accepted = !conclusive || centipawnLoss <= maxLoss;

  return {
    accepted,
    search,
    summary: {
      status: accepted ? (conclusive ? "accepted" : "inconclusive") : "rejected",
      reason: accepted
        ? (conclusive ? "within-threshold" : "inconclusive-search")
        : "tactical-loss",
      heuristicMove: bookResult.bestMove.notation,
      searchBestMove: search.bestMove?.notation ?? null,
      searchDepth: search.depth,
      searchScore: Math.round(search.score),
      heuristicScore: Math.round(playedCandidate.score),
      centipawnLoss,
      maxCentipawnLoss: maxLoss,
      nodes: search.nodes + (playedCandidate.nodes ?? 0),
      timedOut: search.timedOut,
      source: nativeSource(options.protocol)
    }
  };
}

function parseUcciSearch(lines, position, protocol = "ucci") {
  const bestLine = [...lines].reverse().find((line) => line.startsWith("bestmove "));
  if (!bestLine) throw new Error("UCCI search did not return bestmove.");

  const { bestToken, ponderToken } = parseBestMoveLine(bestLine, protocol);
  const bestMove = bestToken === "0000" ? null : resolveLegalMove(position, bestToken);
  const ponderMove = resolvePonderMove(position, bestMove, ponderToken);
  const infos = lines
    .filter((line) => line.startsWith("info "))
    .map(parseInfoLine)
    .map((info) => translateNativeInfoLine(info, protocol))
    .filter(Boolean);
  const pvInfos = infos.filter((info) => info.pv.length > 0);
  const candidateInfos = latestPvInfosByMultipv(pvInfos);
  const primaryInfo = choosePrimaryInfo(candidateInfos, bestToken)
    ?? choosePrimaryInfo(pvInfos, bestToken)
    ?? infos.at(-1)
    ?? {};
  const primaryVariation = primaryInfo.pv
    ? resolvePrincipalVariation(position, primaryInfo.pv)
    : bestMove ? [bestMove] : [];
  const principalVariation = addPonderToPrincipalVariation(primaryVariation, bestMove, ponderMove);
  const candidates = buildNativeCandidates(position, candidateInfos, bestMove, primaryInfo, ponderMove);

  return {
    bestMove,
    ponderMove,
    score: primaryInfo.score ?? 0,
    scoreDetail: nativeScoreDetail(primaryInfo),
    wdl: nativeWdl(primaryInfo),
    depth: maxInfoValue(infos, "depth"),
    seldepth: maxInfoValue(infos, "seldepth"),
    nodes: maxInfoValue(infos, "nodes"),
    timeMs: maxInfoValue(infos, "timeMs"),
    nps: maxInfoValue(infos, "nps"),
    hashfull: maxInfoValue(infos, "hashfull"),
    telemetry: nativeTelemetry(infos),
    principalVariation,
    candidates,
    iterations: infos
      .filter((info) => info.depth && info.pv.length > 0)
      .map((info) => ({
        depth: info.depth,
        bestMove: resolvePrincipalVariation(position, info.pv)[0] ?? null,
        score: info.score ?? 0,
        seldepth: info.seldepth ?? 0,
        nodes: info.nodes ?? 0,
        timeMs: info.timeMs ?? 0,
        nps: info.nps ?? 0,
        hashfull: info.hashfull ?? 0,
        telemetry: nativeTelemetry([info]),
        principalVariation: resolvePrincipalVariation(position, info.pv),
        candidates: [],
        stableBestMove: null,
        stats: createNativeStats(info)
      }))
  };
}

function parseBestMoveLine(line, protocol) {
  const tokens = line.split(/\s+/);
  const bestToken = nativeMoveTokenToInternal(tokens[1], protocol);
  const ponderIndex = tokens.findIndex((token) => token.toLowerCase() === "ponder");
  const ponderToken = ponderIndex >= 0 && tokens[ponderIndex + 1]
    ? nativeMoveTokenToInternal(tokens[ponderIndex + 1], protocol)
    : null;

  return {
    bestToken,
    ponderToken
  };
}

function resolvePonderMove(position, bestMove, ponderToken) {
  if (!bestMove || !ponderToken || ponderToken === "0000") return null;

  let parsed;
  try {
    parsed = parseMoveNotation(ponderToken);
  } catch {
    return null;
  }

  const next = makeMove(position, bestMove);
  const legalMove = generateLegalMoves(next, next.turn)
    .find((move) => sameMove(move, parsed));
  return legalMove ? annotateMove(next, legalMove) : null;
}

function addPonderToPrincipalVariation(principalVariation, bestMove, ponderMove) {
  if (!ponderMove || principalVariation.length !== 1) return principalVariation;
  if (bestMove && !sameMove(principalVariation[0], bestMove)) return principalVariation;
  return [...principalVariation, ponderMove];
}

function parseInfoLine(line) {
  const tokens = line.split(/\s+/);
  const info = {
    depth: 0,
    seldepth: 0,
    nodes: 0,
    timeMs: 0,
    nps: 0,
    hashfull: 0,
    multipv: 1,
    scoreKind: null,
    scoreValue: null,
    scoreBound: null,
    mate: null,
    wdl: null,
    score: null,
    pv: []
  };

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index].toLowerCase();
    if (token === "depth") {
      info.depth = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "seldepth") {
      info.seldepth = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "nodes") {
      info.nodes = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "time") {
      info.timeMs = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "nps") {
      info.nps = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "hashfull") {
      info.hashfull = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "multipv") {
      info.multipv = Number.parseInt(tokens[index + 1], 10) || 1;
      index += 1;
    } else if (token === "score") {
      const kind = tokens[index + 1]?.toLowerCase();
      const value = Number.parseInt(tokens[index + 2], 10);
      const bound = normalizeNativeScoreBound(tokens[index + 3]);
      if (kind === "cp") {
        info.scoreKind = "cp";
        info.scoreValue = Number.isFinite(value) ? value : 0;
        info.score = info.scoreValue;
      }
      if (kind === "mate") {
        info.scoreKind = "mate";
        info.scoreValue = Number.isFinite(value) ? value : 0;
        info.mate = info.scoreValue;
        info.score = Number.isFinite(value) ? Math.sign(value || 1) * (100000 - Math.abs(value)) : 0;
      }
      info.scoreBound = bound;
      index += bound ? 3 : 2;
    } else if (token === "wdl") {
      const win = Number.parseInt(tokens[index + 1], 10);
      const draw = Number.parseInt(tokens[index + 2], 10);
      const loss = Number.parseInt(tokens[index + 3], 10);
      if ([win, draw, loss].every(Number.isFinite)) {
        info.wdl = {
          win,
          draw,
          loss,
          total: win + draw + loss
        };
      }
      index += 3;
    } else if (token === "pv") {
      info.pv = tokens.slice(index + 1);
      break;
    }
  }

  return info;
}

function normalizeNativeScoreBound(token) {
  const normalized = String(token ?? "").toLowerCase();
  if (normalized === "lowerbound") return "lower";
  if (normalized === "upperbound") return "upper";
  return null;
}

function latestPvInfosByMultipv(infos) {
  const latest = new Map();

  for (const info of infos) {
    const key = info.multipv || 1;
    const current = latest.get(key);
    if (!current || info.depth >= current.depth) {
      latest.set(key, info);
    }
  }

  return [...latest.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, info]) => info);
}

function choosePrimaryInfo(infos, bestToken) {
  return [...infos].reverse().find((info) => info.pv[0] === bestToken || moveKeyMatches(info.pv[0], bestToken))
    ?? infos.find((info) => info.multipv === 1)
    ?? infos.at(-1);
}

function buildNativeCandidates(position, infos, bestMove, primaryInfo, ponderMove = null) {
  const candidates = infos
    .sort((a, b) => a.multipv - b.multipv)
    .map((info) => {
      const principalVariation = addPonderToPrincipalVariation(
        resolvePrincipalVariation(position, info.pv),
        bestMove,
        ponderMove
      );
      const move = principalVariation[0];
      if (!move) return null;
      return {
        move,
        score: info.score ?? 0,
        principalVariation,
        native: {
          depth: info.depth,
          seldepth: info.seldepth,
          nodes: info.nodes,
          timeMs: info.timeMs,
          nps: info.nps,
          hashfull: info.hashfull,
          telemetry: nativeTelemetry([info]),
          multipv: info.multipv,
          scoreDetail: nativeScoreDetail(info),
          wdl: nativeWdl(info)
        },
        scoreDetail: nativeScoreDetail(info),
        wdl: nativeWdl(info)
      };
    })
    .filter(Boolean);

  if (candidates.length > 0) return candidates;
  if (!bestMove) return [];

  return [{
    move: bestMove,
    score: primaryInfo.score ?? 0,
    principalVariation: addPonderToPrincipalVariation([bestMove], bestMove, ponderMove),
    native: {
      depth: primaryInfo.depth ?? 0,
      seldepth: primaryInfo.seldepth ?? 0,
      nodes: primaryInfo.nodes ?? 0,
      timeMs: primaryInfo.timeMs ?? 0,
      nps: primaryInfo.nps ?? 0,
      hashfull: primaryInfo.hashfull ?? 0,
      telemetry: nativeTelemetry([primaryInfo]),
      multipv: 1,
      scoreDetail: nativeScoreDetail(primaryInfo),
      wdl: nativeWdl(primaryInfo)
    },
    scoreDetail: nativeScoreDetail(primaryInfo),
    wdl: nativeWdl(primaryInfo)
  }];
}

function nativeScoreDetail(info = {}) {
  if (info.scoreKind === "mate") {
    return {
      kind: "mate",
      value: info.mate ?? info.scoreValue ?? null,
      bound: info.scoreBound ?? null,
      normalizedScore: info.score ?? 0,
      text: formatNativeScoreDetail(info)
    };
  }
  if (info.scoreKind === "cp") {
    return {
      kind: "cp",
      value: info.scoreValue ?? info.score ?? 0,
      bound: info.scoreBound ?? null,
      normalizedScore: info.score ?? 0,
      text: formatNativeScoreDetail(info)
    };
  }

  return {
    kind: "unknown",
    value: null,
    bound: info.scoreBound ?? null,
    normalizedScore: info.score ?? 0,
    text: formatScore(info.score ?? 0)
  };
}

function formatNativeScoreDetail(info = {}) {
  let text;
  if (info.scoreKind === "mate") {
    const mate = info.mate ?? info.scoreValue ?? 0;
    if (mate > 0) text = `mate in ${mate}`;
    else if (mate < 0) text = `getting mated in ${Math.abs(mate)}`;
    else text = "forced mate";
    return formatScoreBoundText(text, info.scoreBound);
  }

  text = formatScore(info.score ?? 0);
  return formatScoreBoundText(text, info.scoreBound);
}

function formatScoreBoundText(text, bound) {
  if (bound === "lower") return `at least ${text}`;
  if (bound === "upper") return `at most ${text}`;
  return text;
}

function nativeWdl(info = {}) {
  if (!info.wdl) return null;
  const { win, draw, loss, total } = info.wdl;
  const safeTotal = total > 0 ? total : win + draw + loss;

  return {
    win,
    draw,
    loss,
    total: safeTotal,
    expectation: safeTotal > 0 ? (win + draw / 2) / safeTotal : null,
    text: formatNativeWdl(info.wdl)
  };
}

function nativeTelemetry(infos = []) {
  const seldepth = maxInfoValue(infos, "seldepth");
  const timeMs = maxInfoValue(infos, "timeMs");
  const nps = maxInfoValue(infos, "nps");
  const hashfull = maxInfoValue(infos, "hashfull");

  if (seldepth <= 0 && timeMs <= 0 && nps <= 0 && hashfull <= 0) return null;

  return {
    seldepth: seldepth || null,
    timeMs: timeMs || null,
    nps: nps || null,
    hashfull: hashfull || null,
    hashfullText: hashfull > 0 ? `${(hashfull / 10).toFixed(1)}%` : null
  };
}

function formatNativeWdl(wdl) {
  const total = wdl.total > 0 ? wdl.total : wdl.win + wdl.draw + wdl.loss;
  if (total <= 0) return `${wdl.win}/${wdl.draw}/${wdl.loss}`;

  const win = Math.round((wdl.win / total) * 100);
  const draw = Math.round((wdl.draw / total) * 100);
  const loss = Math.round((wdl.loss / total) * 100);
  return `${win}% win, ${draw}% draw, ${loss}% loss`;
}

function resolveLegalMove(position, notation) {
  const parsed = typeof notation === "string" ? parseMoveNotation(notation) : notation;
  const legalMove = generateLegalMoves(position, position.turn)
    .find((move) => sameMove(move, parsed));

  if (!legalMove) {
    throw new Error(`UCCI engine returned illegal move: ${typeof notation === "string" ? notation : moveToNotation(parsed)}`);
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
  const protocolLabel = result.protocol === "uci" ? "UCI" : "UCCI";
  const move = result.bestMove;
  if (!move) {
    return {
      summary: `${backendName} found no legal move.`,
      reasons: [`The native ${protocolLabel} backend returned bestmove 0000.`],
      alternatives: [],
      principalVariation: [],
      linePlan: buildLinePlan(position, [])
    };
  }

  const moveStory = explainMoveFeatures(position, move);
  const comparison = buildNativeComparisonEvidence(result, position);
  const validation = result.openingHeuristicValidation;
  const scoreText = result.scoreDetail?.text ?? formatScore(result.score);
  const principalVariation = result.principalVariation.map((candidate) => candidate.notation ?? moveToNotation(candidate));
  const ponderMove = result.ponderMove?.notation ?? (result.ponderMove ? moveToNotation(result.ponderMove) : null);
  const continuationReason = principalVariation.length > 1
    ? (ponderMove && principalVariation[1] === ponderMove
        ? `The native engine expects ${ponderMove} as the ponder reply.`
        : `The reported principal variation continues ${principalVariation.slice(1, 4).join(" ")}.`)
    : null;
  const reasons = [
    `${backendName} selected this move through ${protocolLabel} search.`,
    `The native search reported depth ${result.depth} and ${result.nodes} nodes.`,
    nativeTelemetryReason(result.telemetry),
    `It reported a score of ${scoreText} for the side to move.`,
    nativeScoreBoundReason(result.scoreDetail),
    nativeWdlReason(result.wdl),
    comparison?.reason,
    continuationReason,
    validation?.status === "rejected"
      ? `Rejected opening heuristic ${validation.heuristicMove} because native search found it loses about ${validation.centipawnLoss} centipawns compared with ${validation.searchBestMove}.`
      : null,
    ...moveStory.reasons
  ].filter(Boolean);

  return {
    summary: `${pieceLabel(move.piece)} ${moveToNotation(move)} is selected by ${backendName} at depth ${result.depth}, with a reported score of ${scoreText}.`,
    reasons: unique(reasons).slice(0, 7),
    alternatives: explainNativeAlternatives(position, result, backendName, protocolLabel),
    principalVariation,
    principalVariationText: principalVariation.join(" "),
    linePlan: buildLinePlan(position, result.principalVariation),
    comparison,
    evaluationDelta: moveStory.evaluationDelta,
    confidence: assessSearchConfidence(result, { source: result.source ?? result.protocol ?? "native" }),
    search: {
      depth: result.depth,
      nodes: result.nodes,
      timedOut: result.timedOut,
      tableSize: result.tableSize,
      stats: result.stats,
      iterations: result.iterations,
      openingHeuristicValidation: result.openingHeuristicValidation ?? null,
      scoreDetail: result.scoreDetail ?? null,
      wdl: result.wdl ?? null,
      telemetry: result.telemetry ?? null,
      ponderMove
    }
  };
}

function buildNativeComparisonEvidence(result, position) {
  const [best, next] = result.candidates ?? [];
  if (!best || !next) return null;

  const bestMove = best.move.notation ?? moveToNotation(best.move);
  const nextMove = next.move.notation ?? moveToNotation(next.move);
  const bestScore = Math.round(best.score);
  const nextScore = Math.round(next.score);
  const scoreGap = Math.max(0, bestScore - nextScore);
  const bestScoreText = best.scoreDetail?.text ?? formatScore(bestScore);
  const nextScoreText = next.scoreDetail?.text ?? formatScore(nextScore);
  const boundLimited = Boolean(best.scoreDetail?.bound || next.scoreDetail?.bound);
  const bestLine = (best.principalVariation ?? []).map((move) => move.notation ?? moveToNotation(move));
  const nextLine = (next.principalVariation ?? []).map((move) => move.notation ?? moveToNotation(move));
  const bestPlan = buildLinePlan(position, best.principalVariation ?? [best.move], {
    perspective: position.turn
  });
  const nextPlan = buildLinePlan(position, next.principalVariation ?? [next.move], {
    perspective: position.turn
  });
  const nearlyTied = scoreGap <= 15;
  const verdict = nearlyTied ? "near-tie" : nativeAlternativeVerdict(1, scoreGap);
  const planComparison = summarizePlanComparisonEvidence(compareLinePlans(nextPlan, bestPlan, {
    centipawnLoss: scoreGap,
    classification: verdict,
    playedPlanLabel: "The runner-up line",
    playedLineLabel: "The runner-up line",
    playedStartLabel: "The runner-up line starts",
    bestLineLabel: "the preferred line",
    bestLineSentenceLabel: "The preferred line",
    bestPossessiveLabel: "the preferred line's",
    bestPreferencePhrase: "the preferred line starts with",
    bestStartLabel: "the preferred line starts"
  }));
  const reason = nativeComparisonReason({
    bestMove,
    nextMove,
    bestScoreText,
    nextScoreText,
    scoreGap,
    nearlyTied,
    boundLimited
  });

  return {
    bestMove,
    nextMove,
    scoreGap,
    scoreGapText: `${scoreGap} cp`,
    bestScore,
    nextScore,
    bestScoreText,
    nextScoreText,
    boundLimited,
    scoreBounds: {
      best: best.scoreDetail?.bound ?? null,
      next: next.scoreDetail?.bound ?? null
    },
    verdict,
    reason,
    bestLine,
    nextLine,
    bestLineText: bestLine.join(" "),
    nextLineText: nextLine.join(" "),
    bestLinePlan: bestPlan.summary,
    nextLinePlan: nextPlan.summary,
    planComparison
  };
}

function explainNativeAlternatives(position, result, backendName, protocolLabel) {
  const bestScore = result.candidates[0]?.score ?? result.score ?? 0;
  const bestLinePlan = result.candidates[0]
    ? buildLinePlan(position, result.candidates[0].principalVariation ?? [result.candidates[0].move], {
        perspective: position.turn
      })
    : null;

  return result.candidates.slice(0, 5).map((candidate, index) => {
    const explanation = explainNativeCandidate(position, candidate, {
      rank: index + 1,
      bestScore,
      depth: candidate.native?.depth ?? result.depth,
      backendName
    });
    const linePlan = explanation.linePlan;
    const centipawnLoss = explanation.centipawnLoss;
    const verdict = nativeAlternativeVerdict(index, centipawnLoss);
    const contrast = nativeAlternativeContrast(index, centipawnLoss);

    return {
      rank: index + 1,
      move: candidate.move.notation ?? moveToNotation(candidate.move),
      score: Math.round(candidate.score),
      scoreDetail: candidate.scoreDetail ?? null,
      wdl: candidate.wdl ?? null,
      centipawnLoss,
      verdict,
      summary: explanation.summary,
      reasons: unique([
        contrast,
        ...explanation.reasons
      ]).slice(0, 5),
      expectedReply: linePlan.expectedReply,
      motifs: linePlan.motifs,
      linePlanSummary: linePlan.summary,
      planComparison: nativeAlternativePlanComparison(linePlan, bestLinePlan, {
        index,
        centipawnLoss,
        verdict
      }),
      principalVariation: explanation.principalVariation,
      principalVariationText: explanation.principalVariationText,
      note: `${contrast}; native ${protocolLabel} line ${candidate.native?.multipv ?? index + 1} at depth ${candidate.native?.depth ?? result.depth}${candidate.scoreDetail?.text ? `, score ${candidate.scoreDetail.text}` : ""}`
    };
  });
}

function nativeAlternativePlanComparison(linePlan, bestLinePlan, options = {}) {
  if (options.index === 0) return null;
  return summarizePlanComparisonEvidence(compareLinePlans(linePlan, bestLinePlan, {
    centipawnLoss: options.centipawnLoss,
    classification: options.verdict,
    playedPlanLabel: "This native line",
    playedLineLabel: "This native line",
    playedStartLabel: "This native line starts",
    bestLineLabel: "the top native line",
    bestLineSentenceLabel: "The top native line",
    bestPossessiveLabel: "the top native line's",
    bestPreferencePhrase: "the top native line starts with",
    bestStartLabel: "the top native line starts"
  }));
}

function explainNativeCandidate(position, candidate, context) {
  const moveStory = explainMoveFeatures(position, candidate.move);
  const centipawnLoss = Math.max(0, Math.round((context.bestScore ?? candidate.score) - candidate.score));
  const scoreText = candidate.scoreDetail?.text ?? formatScore(candidate.score);
  const principalVariation = (candidate.principalVariation ?? [])
    .map((move) => move.notation ?? moveToNotation(move));
  const reasons = [
    context.rank === 1
      ? `This is ${context.backendName}'s top native candidate.`
      : `This native line trails the top line by about ${centipawnLoss} centipawns.`,
    nativeScoreBoundReason(candidate.scoreDetail),
    nativeWdlReason(candidate.wdl),
    ...moveStory.reasons
  ].filter(Boolean);

  return {
    summary: `Native candidate ${context.rank}: ${pieceLabel(candidate.move.piece)} ${candidate.move.notation} scores ${scoreText} at depth ${context.depth}.`,
    reasons: unique(reasons).slice(0, 7),
    principalVariation,
    principalVariationText: principalVariation.join(" "),
    linePlan: buildLinePlan(position, candidate.principalVariation ?? [candidate.move], {
      perspective: position.turn
    }),
    evaluationDelta: moveStory.evaluationDelta,
    centipawnLoss
  };
}

function nativeAlternativeVerdict(index, centipawnLoss) {
  if (index === 0) return "best";
  if (centipawnLoss <= 15) return "tied";
  if (centipawnLoss <= 90) return "playable";
  if (centipawnLoss <= 250) return "inferior";
  return "poor";
}

function nativeAlternativeContrast(index, centipawnLoss) {
  if (index === 0) return "top native line";
  if (centipawnLoss <= 15) return `roughly tied with the top native line, trailing by ${centipawnLoss} centipawns`;
  return `trails the top native line by ${centipawnLoss} centipawns`;
}

function nativeComparisonReason({ bestMove, nextMove, bestScoreText, nextScoreText, scoreGap, nearlyTied, boundLimited }) {
  if (boundLimited) {
    return `Native MultiPV reports bound-limited scores: ${bestMove} is ${bestScoreText}, while ${nextMove} is ${nextScoreText}; the displayed gap is ${scoreGap} centipawns, but the exact margin may differ.`;
  }

  return nearlyTied
    ? `Native MultiPV shows ${bestMove} and ${nextMove} are nearly tied, separated by ${scoreGap} centipawns.`
    : `Native MultiPV rates ${bestMove} ${scoreGap} centipawns above the next candidate ${nextMove}.`;
}

function nativeScoreBoundReason(scoreDetail) {
  if (scoreDetail?.bound === "lower") {
    return `The reported score is a native lower bound (${scoreDetail.text}), so the exact evaluation may be even better.`;
  }
  if (scoreDetail?.bound === "upper") {
    return `The reported score is a native upper bound (${scoreDetail.text}), so the exact evaluation may be no better.`;
  }
  return null;
}

function nativeTelemetryReason(telemetry) {
  if (!telemetry) return null;

  const parts = [];
  if (telemetry.seldepth) parts.push(`selective depth ${telemetry.seldepth}`);
  if (telemetry.timeMs) parts.push(`${telemetry.timeMs} ms`);
  if (telemetry.nps) parts.push(`${formatNativeNodes(telemetry.nps)}/s`);
  if (telemetry.hashfullText) parts.push(`${telemetry.hashfullText} hash used`);

  return parts.length > 0 ? `Native search telemetry: ${parts.join(", ")}.` : null;
}

function formatNativeNodes(value) {
  const rounded = Math.round(value ?? 0);
  if (rounded >= 1_000_000) return `${(rounded / 1_000_000).toFixed(1)}M nodes`;
  if (rounded >= 1_000) return `${(rounded / 1_000).toFixed(1)}k nodes`;
  return `${rounded} nodes`;
}

function nativeWdlReason(wdl) {
  if (!wdl) return null;
  return `Native WDL expectation: ${wdl.text}.`;
}

function formatGoCommand(options) {
  const depth = Math.max(1, Number.parseInt(options.depth ?? 4, 10) || 4);
  const lines = normalizeLineCount(options.lines ?? options.multiPv ?? options.multipv ?? 1);
  const explicitMoveTime = numberOption(options.timeLimitMs, options.movetime, options.moveTimeMs, options.moveTime);
  const protocol = normalizeNativeProtocol(options.protocol);
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

  if (protocol === "uci" && options.searchMoves?.length > 0) {
    parts.push("searchmoves", ...options.searchMoves.map((move) => compactNativeMove(move, protocol)));
  }

  if (lines > 1 && protocol !== "uci") parts.push("multipv", lines);
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

function normalizeNativeProtocol(value = "ucci") {
  const normalized = String(value ?? "ucci").toLowerCase();
  if (normalized === "uci") return "uci";
  return "ucci";
}

function nativeSource(protocol) {
  return normalizeNativeProtocol(protocol) === "uci" ? "native-uci" : "native-ucci";
}

function toNativeFen(position, protocol) {
  const fen = toFen(position);
  if (normalizeNativeProtocol(protocol) !== "uci") return fen;

  const [board, side = "r"] = fen.split(/\s+/);
  const nativeBoard = board.replace(/[hHeE]/g, (piece) => UCI_FEN_PIECES[piece] ?? piece);
  const nativeSide = side === "r" ? "w" : "b";
  return `${nativeBoard} ${nativeSide} - - 0 1`;
}

const UCI_FEN_PIECES = Object.freeze({
  h: "n",
  H: "N",
  e: "b",
  E: "B"
});

function translateNativeInfoLine(info, protocol) {
  if (normalizeNativeProtocol(protocol) !== "uci") return info;
  return {
    ...info,
    pv: info.pv.map((moveText) => nativeMoveTokenToInternal(moveText, protocol))
  };
}

function normalizeNativeEngineOptions(engineOptions = {}) {
  return engineOptionEntries(engineOptions)
    .map(normalizeNativeEngineOption)
    .filter(Boolean);
}

function engineOptionEntries(engineOptions) {
  if (engineOptions instanceof Map) {
    return [...engineOptions.entries()].map(([name, value]) => ({ name, value }));
  }

  if (Array.isArray(engineOptions)) return engineOptions;

  if (engineOptions && typeof engineOptions === "object") {
    return Object.entries(engineOptions).map(([name, value]) => ({ name, value }));
  }

  if (typeof engineOptions === "string") return [engineOptions];
  return [];
}

function normalizeNativeEngineOption(entry) {
  if (typeof entry === "string") {
    const name = entry.trim();
    return name ? { name, value: null } : null;
  }

  if (Array.isArray(entry)) {
    const [name, value = null] = entry;
    return normalizeNativeEngineOption({ name, value });
  }

  if (!entry || typeof entry !== "object") return null;

  const rawName = entry.name ?? entry.key ?? entry.option;
  if (typeof rawName !== "string" && typeof rawName !== "number") return null;

  const name = String(rawName).trim();
  if (!name) return null;

  const value = Object.prototype.hasOwnProperty.call(entry, "value")
    ? entry.value
    : Object.prototype.hasOwnProperty.call(entry, "defaultValue")
      ? entry.defaultValue
      : null;

  return {
    name,
    value: value === undefined ? null : value
  };
}

function formatSetOptionCommand(option) {
  const name = String(option.name).trim();
  if (option.value === null) return `setoption name ${name}`;
  return `setoption name ${name} value ${formatOptionValue(option.value)}`;
}

function formatOptionValue(value) {
  if (Array.isArray(value)) return value.join(" ");
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function legalSearchMoves(position, bannedMoves) {
  const bannedMoveKeys = new Set(bannedMoves.map(toMoveKey));
  return generateLegalMoves(position, position.turn)
    .filter((move) => !bannedMoveKeys.has(moveKey(move)));
}

function addGoNumber(parts, name, value) {
  const parsed = numberOption(value);
  if (parsed !== null) parts.push(name, Math.max(0, Math.floor(parsed)));
}

function createNativeStats(parsed) {
  return {
    ...createEmptyStats(),
    nodes: parsed.nodes ?? 0,
    seldepth: parsed.seldepth ?? parsed.telemetry?.seldepth ?? 0,
    timeMs: parsed.timeMs ?? parsed.telemetry?.timeMs ?? 0,
    nps: parsed.nps ?? parsed.telemetry?.nps ?? 0,
    hashfull: parsed.hashfull ?? parsed.telemetry?.hashfull ?? 0,
    native: true
  };
}

function createEmptyStats() {
  return {
    nodes: 0,
    qnodes: 0,
    qchecks: 0,
    qttHits: 0,
    qttStores: 0,
    qttReplacements: 0,
    qttEvictions: 0,
    qttSkips: 0,
    evalCacheHits: 0,
    evalCacheStores: 0,
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
    recaptureExtensions: 0,
    singularExtensionSearches: 0,
    singularExtensions: 0,
    singularExtensionRejects: 0,
    softStops: 0,
    seePrunes: 0,
    reverseFutilityPrunes: 0,
    mateDistancePrunes: 0,
    mateDistanceWindows: 0,
    razorPrunes: 0,
    razorResearches: 0,
    probCutPrunes: 0,
    probCutSearches: 0,
    futilityPrunes: 0,
    lateMovePrunes: 0,
    deltaPrunes: 0,
    reductions: 0,
    reductionPlies: 0,
    deepReductions: 0,
    lmrResearches: 0,
    pvsResearches: 0,
    nullMovePrunes: 0,
    nullMoveVerifications: 0,
    nullMoveVerificationFailures: 0,
    killerStores: 0,
    killerHits: 0,
    captureHistoryStores: 0,
    captureHistoryHits: 0,
    captureHistoryMaluses: 0,
    checkHistoryStores: 0,
    checkHistoryHits: 0,
    checkHistoryMaluses: 0,
    countermoveStores: 0,
    countermoveHits: 0,
    continuationHistoryStores: 0,
    continuationHistoryHits: 0,
    checkEvasionOrderHits: 0,
    checkEvasionCaptures: 0,
    checkEvasionBlocks: 0,
    checkEvasionKingMoves: 0,
    historyMaluses: 0,
    rootScoreOrderHits: 0,
    iidSearches: 0,
    iidMoveHits: 0,
    rootMovesSearched: 0,
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

function resolveNativeChooseMoveLines(baseOptions, searchOptions) {
  return normalizeLineCount(
    searchOptions.lines
      ?? searchOptions.multiPv
      ?? searchOptions.multipv
      ?? searchOptions.explanationLines
      ?? baseOptions.chooseMoveLines
      ?? baseOptions.explanationLines
      ?? baseOptions.lines
      ?? 1
  );
}

function resolveNativeReviewLines(baseOptions, reviewOptions) {
  return normalizeLineCount(
    reviewOptions.reviewLines
      ?? reviewOptions.lines
      ?? reviewOptions.multiPv
      ?? reviewOptions.multipv
      ?? reviewOptions.explanationLines
      ?? baseOptions.reviewLines
      ?? baseOptions.lines
      ?? 1
  );
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

function compactNativeMove(move, protocol) {
  const compact = compactMove(move);
  return normalizeNativeProtocol(protocol) === "uci"
    ? internalMoveTokenToNative(compact)
    : compact;
}

function nativeMoveTokenToInternal(moveText, protocol) {
  if (normalizeNativeProtocol(protocol) !== "uci") return moveText;
  if (!moveText || moveText === "0000") return moveText;
  return translateMoveTokenRanks(moveText);
}

function internalMoveTokenToNative(moveText) {
  if (!moveText || moveText === "0000") return moveText;
  return translateMoveTokenRanks(moveText);
}

function translateMoveTokenRanks(moveText) {
  const compact = String(moveText).replace("-", "");
  const match = compact.match(/^([a-i])([0-9])([a-i])([0-9])(.*)$/i);
  if (!match) return moveText;

  const [, fromFile, fromRank, toFile, toRank, suffix] = match;
  return `${fromFile}${mirrorNativeRank(fromRank)}${toFile}${mirrorNativeRank(toRank)}${suffix}`;
}

function mirrorNativeRank(rank) {
  return String(9 - Number(rank));
}

function toMoveKey(move) {
  return moveKey(typeof move === "string" ? parseMoveNotation(move) : move);
}

function moveKeyMatches(left, right) {
  if (!left || !right) return false;
  if (left === "0000" || right === "0000") return false;
  return moveKey(parseMoveNotation(left)) === moveKey(parseMoveNotation(right));
}

function normalizeScore(score) {
  return Object.is(score, -0) ? 0 : score;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}
