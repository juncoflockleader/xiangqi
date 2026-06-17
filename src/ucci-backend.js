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
    newGame: (resetOptions = {}) => client.newGame(resetOptions),
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

  async newGame(options = {}) {
    return this.enqueueSearch(() => this.newGameWithRestart(options));
  }

  enqueueSearch(task) {
    const run = this.searchQueue.catch(() => null).then(task);
    this.searchQueue = run.catch(() => null);
    return run;
  }

  async newGameWithRestart(options = {}) {
    try {
      return await this.newGameOnce(options);
    } catch (error) {
      if (options.restartOnExit === false || !isRecoverableNativeProcessError(error)) {
        throw error;
      }

      await this.close();
      return this.newGameOnce(options);
    }
  }

  async newGameOnce(options = {}) {
    throwIfAborted(options.signal);
    await this.ensureReady();
    throwIfAborted(options.signal);

    this.write("ucinewgame");
    return this.commandUntil("isready", (lines) => lines.some((line) => line === "readyok"), this.startupTimeoutMs, {
      signal: options.signal
    });
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

    this.write(formatPositionCommand(position, options, this.protocol));

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
    memoryAge: parsed.memoryAge,
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
  const bestMove = isNullBestMove(bestToken) ? null : resolveLegalMove(position, bestToken);
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
    memoryAge: maxInfoValue(infos, "memoryAge"),
    qnodes: maxInfoValue(infos, "qnodes"),
    qchecks: maxInfoValue(infos, "qchecks"),
    qttHits: maxInfoValue(infos, "qttHits"),
    qttProbes: maxInfoValue(infos, "qttProbes"),
    qttStores: maxInfoValue(infos, "qttStores"),
    qttCutoffs: maxInfoValue(infos, "qttCutoffs"),
    qttMoveHits: maxInfoValue(infos, "qttMoveHits"),
    evalCacheHits: maxInfoValue(infos, "evalCacheHits"),
    evalCacheProbes: maxInfoValue(infos, "evalCacheProbes"),
    evalCacheStores: maxInfoValue(infos, "evalCacheStores"),
    checkedEvalSkips: maxInfoValue(infos, "checkedEvalSkips"),
    ttHits: maxInfoValue(infos, "ttHits"),
    ttMoveHits: maxInfoValue(infos, "ttMoveHits"),
    cutoffs: maxInfoValue(infos, "cutoffs"),
    killerHits: maxInfoValue(infos, "killerHits"),
    captureHistoryHits: maxInfoValue(infos, "captureHistoryHits"),
    captureHistoryStores: maxInfoValue(infos, "captureHistoryStores"),
    captureHistoryMaluses: maxInfoValue(infos, "captureHistoryMaluses"),
    captureHistoryPruneGuards: maxInfoValue(infos, "captureHistoryPruneGuards"),
    nullMovePrunes: maxInfoValue(infos, "nullMovePrunes"),
    nullMoveVerifications: maxInfoValue(infos, "nullMoveVerifications"),
    nullMoveVerificationFailures: maxInfoValue(infos, "nullMoveVerificationFailures"),
    nullMoveMaterialGuards: maxInfoValue(infos, "nullMoveMaterialGuards"),
    reverseFutilityPrunes: maxInfoValue(infos, "reverseFutilityPrunes"),
    mateDistancePrunes: maxInfoValue(infos, "mateDistancePrunes"),
    razorPrunes: maxInfoValue(infos, "razorPrunes"),
    razorResearches: maxInfoValue(infos, "razorResearches"),
    seePrunes: maxInfoValue(infos, "seePrunes"),
    leastAttackerCacheHits: maxInfoValue(infos, "leastAttackerCacheHits"),
    leastAttackerCacheProbes: maxInfoValue(infos, "leastAttackerCacheProbes"),
    leastAttackerCacheStores: maxInfoValue(infos, "leastAttackerCacheStores"),
    probCutPrunes: maxInfoValue(infos, "probCutPrunes"),
    probCutSearches: maxInfoValue(infos, "probCutSearches"),
    probCutCaptureSkips: maxInfoValue(infos, "probCutCaptureSkips"),
    futilityPrunes: maxInfoValue(infos, "futilityPrunes"),
    badHistoryPrunes: maxInfoValue(infos, "badHistoryPrunes"),
    badHistoryPruneGuards: maxInfoValue(infos, "badHistoryPruneGuards"),
    deltaPrunes: maxInfoValue(infos, "deltaPrunes"),
    qDeltaPrefilterSkips: maxInfoValue(infos, "qDeltaPrefilterSkips"),
    qSeePrunes: maxInfoValue(infos, "qSeePrunes"),
    lateMovePrunes: maxInfoValue(infos, "lateMovePrunes"),
    depthThreeLateMovePrunes: maxInfoValue(infos, "depthThreeLateMovePrunes"),
    reductions: maxInfoValue(infos, "reductions"),
    reductionPlies: maxInfoValue(infos, "reductionPlies"),
    deepReductions: maxInfoValue(infos, "deepReductions"),
    lmrResearches: maxInfoValue(infos, "lmrResearches"),
    pvReductionGuards: maxInfoValue(infos, "pvReductionGuards"),
    cutNodeReductionBoosts: maxInfoValue(infos, "cutNodeReductionBoosts"),
    improvingNodes: maxInfoValue(infos, "improvingNodes"),
    nonImprovingNodes: maxInfoValue(infos, "nonImprovingNodes"),
    improvingReductionGuards: maxInfoValue(infos, "improvingReductionGuards"),
    nonImprovingReductionBoosts: maxInfoValue(infos, "nonImprovingReductionBoosts"),
    improvingLateMoveGuards: maxInfoValue(infos, "improvingLateMoveGuards"),
    nonImprovingLateMovePrunes: maxInfoValue(infos, "nonImprovingLateMovePrunes"),
    countermoveHits: maxInfoValue(infos, "countermoveHits"),
    continuationHistoryHits: maxInfoValue(infos, "continuationHistoryHits"),
    continuationReductionBoosts: maxInfoValue(infos, "continuationReductionBoosts"),
    continuationReductionMaluses: maxInfoValue(infos, "continuationReductionMaluses"),
    checkEvasionOrderHits: maxInfoValue(infos, "checkEvasionOrderHits"),
    checkEvasionCaptures: maxInfoValue(infos, "checkEvasionCaptures"),
    checkEvasionBlocks: maxInfoValue(infos, "checkEvasionBlocks"),
    checkEvasionKingMoves: maxInfoValue(infos, "checkEvasionKingMoves"),
    checkHistoryHits: maxInfoValue(infos, "checkHistoryHits"),
    checkHistoryStores: maxInfoValue(infos, "checkHistoryStores"),
    checkHistoryMaluses: maxInfoValue(infos, "checkHistoryMaluses"),
    checkCacheHits: maxInfoValue(infos, "checkCacheHits"),
    checkCacheStores: maxInfoValue(infos, "checkCacheStores"),
    iidSearches: maxInfoValue(infos, "iidSearches"),
    iidMoveHits: maxInfoValue(infos, "iidMoveHits"),
    rootMovesSearched: maxInfoValue(infos, "rootMovesSearched"),
    rootChildStateReuses: maxInfoValue(infos, "rootChildStateReuses"),
    rootReductions: maxInfoValue(infos, "rootReductions"),
    rootReductionPlies: maxInfoValue(infos, "rootReductionPlies"),
    rootReductionResearches: maxInfoValue(infos, "rootReductionResearches"),
    rootTtHits: maxInfoValue(infos, "rootTtHits"),
    rootTtStores: maxInfoValue(infos, "rootTtStores"),
    rootOrderHits: maxInfoValue(infos, "rootOrderHits"),
    rootOrderStores: maxInfoValue(infos, "rootOrderStores"),
    rootTimeGuardStops: maxInfoValue(infos, "rootTimeGuardStops"),
    openingPreferencePromotions: maxInfoValue(infos, "openingPreferencePromotions"),
    pvsResearches: maxInfoValue(infos, "pvsResearches"),
    aspirationSearches: maxInfoValue(infos, "aspirationSearches"),
    aspirationWidenedSearches: maxInfoValue(infos, "aspirationWidenedSearches"),
    aspirationFailHigh: maxInfoValue(infos, "aspirationFailHigh"),
    aspirationFailLow: maxInfoValue(infos, "aspirationFailLow"),
    extensions: maxInfoValue(infos, "extensions"),
    recaptureExtensions: maxInfoValue(infos, "recaptureExtensions"),
    singularExtensionSearches: maxInfoValue(infos, "singularExtensionSearches"),
    singularExtensions: maxInfoValue(infos, "singularExtensions"),
    singularExtensionRejects: maxInfoValue(infos, "singularExtensionRejects"),
    qCheckHistoryHits: maxInfoValue(infos, "qCheckHistoryHits"),
    qCheckHistoryStores: maxInfoValue(infos, "qCheckHistoryStores"),
    qCheckHistoryMaluses: maxInfoValue(infos, "qCheckHistoryMaluses"),
    qCaptureHistoryPruneGuards: maxInfoValue(infos, "qCaptureHistoryPruneGuards"),
    qCaptureHistoryHits: maxInfoValue(infos, "qCaptureHistoryHits"),
    qCaptureHistoryStores: maxInfoValue(infos, "qCaptureHistoryStores"),
    qCaptureHistoryMaluses: maxInfoValue(infos, "qCaptureHistoryMaluses"),
    repetitions: maxInfoValue(infos, "repetitions"),
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
        memoryAge: info.memoryAge ?? 0,
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
    memoryAge: 0,
    multipv: 1,
    scoreKind: null,
    scoreValue: null,
    scoreBound: null,
    mate: null,
    wdl: null,
    score: null,
    pv: [],
    qnodes: 0,
    qchecks: 0,
    qttHits: 0,
    qttProbes: 0,
    qttStores: 0,
    qttCutoffs: 0,
    qttMoveHits: 0,
    evalCacheHits: 0,
    evalCacheProbes: 0,
    evalCacheStores: 0,
    checkedEvalSkips: 0,
    ttHits: 0,
    ttProbes: 0,
    ttMoveHits: 0,
    cutoffs: 0,
    killerHits: 0,
    captureHistoryHits: 0,
    captureHistoryStores: 0,
    captureHistoryMaluses: 0,
    captureHistoryPruneGuards: 0,
    historyUpdates: 0,
    nullMovePrunes: 0,
    nullMoveVerifications: 0,
    nullMoveVerificationFailures: 0,
    nullMoveMaterialGuards: 0,
    razorPrunes: 0,
    razorResearches: 0,
    seePrunes: 0,
    leastAttackerCacheHits: 0,
    leastAttackerCacheProbes: 0,
    leastAttackerCacheStores: 0,
    probCutPrunes: 0,
    probCutSearches: 0,
    probCutCaptureSkips: 0,
    futilityPrunes: 0,
    badHistoryPrunes: 0,
    badHistoryPruneGuards: 0,
    lateMovePrunes: 0,
    depthThreeLateMovePrunes: 0,
    deltaPrunes: 0,
    qDeltaPrefilterSkips: 0,
    qSeePrunes: 0,
    reductions: 0,
    reductionPlies: 0,
    deepReductions: 0,
    lmrResearches: 0,
    pvReductionGuards: 0,
    cutNodeReductionBoosts: 0,
    improvingNodes: 0,
    nonImprovingNodes: 0,
    improvingReductionGuards: 0,
    nonImprovingReductionBoosts: 0,
    improvingLateMoveGuards: 0,
    nonImprovingLateMovePrunes: 0,
    iidSearches: 0,
    iidMoveHits: 0,
    rootMovesSearched: 0,
    rootChildStateReuses: 0,
    rootReductions: 0,
    rootReductionPlies: 0,
    rootReductionResearches: 0,
    rootTtHits: 0,
    rootTtStores: 0,
    rootOrderHits: 0,
    rootOrderStores: 0,
    rootTimeGuardStops: 0,
    openingPreferencePromotions: 0,
    aspirationWidenedSearches: 0,
    continuationHistoryHits: 0,
    continuationReductionBoosts: 0,
    continuationReductionMaluses: 0,
    checkEvasionOrderHits: 0,
    checkEvasionCaptures: 0,
    checkEvasionBlocks: 0,
    checkEvasionKingMoves: 0,
    checkHistoryHits: 0,
    checkHistoryStores: 0,
    checkHistoryMaluses: 0,
    checkCacheHits: 0,
    checkCacheStores: 0,
    extensions: 0,
    recaptureExtensions: 0,
    singularExtensionSearches: 0,
    singularExtensions: 0,
    singularExtensionRejects: 0,
    repetitions: 0,
    qCheckHistoryHits: 0,
    qCheckHistoryStores: 0,
    qCheckHistoryMaluses: 0,
    qCaptureHistoryPruneGuards: 0,
    qCaptureHistoryHits: 0,
    qCaptureHistoryStores: 0,
    qCaptureHistoryMaluses: 0
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
    } else if (token === "memage") {
      info.memoryAge = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "tt") {
      const [hits, probes] = parseNativePair(tokens[index + 1]);
      info.ttHits = hits;
      info.ttProbes = probes;
      index += 1;
    } else if (token === "cutoffs") {
      info.cutoffs = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "ttmove") {
      info.ttMoveHits = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "killers") {
      info.killerHits = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "caphist") {
      info.captureHistoryHits = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "caphstores") {
      info.captureHistoryStores = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "caphm") {
      info.captureHistoryMaluses = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "caphguard") {
      info.captureHistoryPruneGuards = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "history") {
      info.historyUpdates = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "nmp") {
      info.nullMovePrunes = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "nmv") {
      info.nullMoveVerifications = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "nmvfail") {
      info.nullMoveVerificationFailures = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "nmmguard") {
      info.nullMoveMaterialGuards = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "rfp") {
      info.reverseFutilityPrunes = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "mdp") {
      info.mateDistancePrunes = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "razor") {
      const [prunes, researches] = parseNativePair(tokens[index + 1]);
      info.razorPrunes = prunes;
      info.razorResearches = researches;
      index += 1;
    } else if (token === "see") {
      info.seePrunes = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "lacache") {
      const [hits, probes] = parseNativePair(tokens[index + 1]);
      info.leastAttackerCacheHits = hits;
      info.leastAttackerCacheProbes = probes;
      index += 1;
    } else if (token === "lastores") {
      info.leastAttackerCacheStores = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "pcut") {
      info.probCutPrunes = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "pcsearch") {
      info.probCutSearches = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "pcskip") {
      info.probCutCaptureSkips = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "futil") {
      info.futilityPrunes = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "hprune") {
      info.badHistoryPrunes = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "hpguard") {
      info.badHistoryPruneGuards = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "delta") {
      info.deltaPrunes = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "qdskip") {
      info.qDeltaPrefilterSkips = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "qsee") {
      info.qSeePrunes = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "lmp") {
      info.lateMovePrunes = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "lmp3") {
      info.depthThreeLateMovePrunes = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "lmr") {
      const [reductions, researches] = parseNativePair(tokens[index + 1]);
      info.reductions = reductions;
      info.lmrResearches = researches;
      index += 1;
    } else if (token === "redply") {
      info.reductionPlies = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "deepred") {
      info.deepReductions = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "pvguard") {
      info.pvReductionGuards = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "cutboost") {
      info.cutNodeReductionBoosts = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "imp") {
      info.improvingNodes = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "nimp") {
      info.nonImprovingNodes = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "imprd") {
      info.improvingReductionGuards = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "nimprd") {
      info.nonImprovingReductionBoosts = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "implmp") {
      info.improvingLateMoveGuards = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "nimlmp") {
      info.nonImprovingLateMovePrunes = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "cm") {
      info.countermoveHits = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "ch") {
      info.continuationHistoryHits = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "chred") {
      info.continuationReductionBoosts = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "chredm") {
      info.continuationReductionMaluses = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "ce") {
      info.checkEvasionOrderHits = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "cecap") {
      info.checkEvasionCaptures = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "ceblock") {
      info.checkEvasionBlocks = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "ceking") {
      info.checkEvasionKingMoves = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "checkhist") {
      info.checkHistoryHits = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "checkhstores") {
      info.checkHistoryStores = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "checkhm") {
      info.checkHistoryMaluses = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "checkcache") {
      const [hits, stores] = parseNativePair(tokens[index + 1]);
      info.checkCacheHits = hits;
      info.checkCacheStores = stores;
      index += 1;
    } else if (token === "iid") {
      info.iidSearches = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "iidhit") {
      info.iidMoveHits = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "rootmoves") {
      info.rootMovesSearched = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "rootstate") {
      info.rootChildStateReuses = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "rootred") {
      const [reductions, researches] = parseNativePair(tokens[index + 1]);
      info.rootReductions = reductions;
      info.rootReductionResearches = researches;
      index += 1;
    } else if (token === "rootredply") {
      info.rootReductionPlies = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "roottt") {
      info.rootTtHits = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "rootttstores") {
      info.rootTtStores = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "rootord") {
      info.rootOrderHits = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "rootordstores") {
      info.rootOrderStores = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "tguard") {
      info.rootTimeGuardStops = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "opref") {
      info.openingPreferencePromotions = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "pvs") {
      info.pvsResearches = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "asp") {
      info.aspirationSearches = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "aspwide") {
      info.aspirationWidenedSearches = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "asphi") {
      info.aspirationFailHigh = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "asplo") {
      info.aspirationFailLow = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "ext") {
      info.extensions = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "recext") {
      info.recaptureExtensions = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "singtry") {
      info.singularExtensionSearches = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "singext") {
      info.singularExtensions = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "singrej") {
      info.singularExtensionRejects = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "qchecks") {
      info.qchecks = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "qnodes") {
      info.qnodes = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "qcheckhist") {
      info.qCheckHistoryHits = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "qcheckhstores") {
      info.qCheckHistoryStores = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "qcheckhm") {
      info.qCheckHistoryMaluses = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "qcapguard") {
      info.qCaptureHistoryPruneGuards = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "qcaphist") {
      info.qCaptureHistoryHits = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "qcapstores") {
      info.qCaptureHistoryStores = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "qcaphm") {
      info.qCaptureHistoryMaluses = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "qtt") {
      const [hits, probes] = parseNativePair(tokens[index + 1]);
      info.qttHits = hits;
      info.qttProbes = probes;
      index += 1;
    } else if (token === "qttstores") {
      info.qttStores = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "qttcut") {
      info.qttCutoffs = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "qttmove") {
      info.qttMoveHits = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "eval") {
      const [hits, probes] = parseNativePair(tokens[index + 1]);
      info.evalCacheHits = hits;
      info.evalCacheProbes = probes;
      index += 1;
    } else if (token === "evalstores") {
      info.evalCacheStores = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "evalskip") {
      info.checkedEvalSkips = Number.parseInt(tokens[index + 1], 10) || 0;
      index += 1;
    } else if (token === "rep") {
      info.repetitions = Number.parseInt(tokens[index + 1], 10) || 0;
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

function parseNativePair(token) {
  const [left, right] = String(token ?? "").split("/");
  return [
    Number.parseInt(left, 10) || 0,
    Number.parseInt(right, 10) || 0
  ];
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
          memoryAge: info.memoryAge,
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
      memoryAge: primaryInfo.memoryAge ?? 0,
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

function isNullBestMove(moveText) {
  return !moveText || moveText === "0000" || moveText === "(none)";
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
    nativeSearchMemoryReason(result.stats),
    nativeSelectiveSearchReason(result.stats),
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
  const selectedScoreTrails = nextScore > bestScore;
  const scoreGap = Math.abs(bestScore - nextScore);
  const bestScoreText = best.scoreDetail?.text ?? formatScore(bestScore);
  const nextScoreText = next.scoreDetail?.text ?? formatScore(nextScore);
  const boundLimited = Boolean(best.scoreDetail?.bound || next.scoreDetail?.bound);
  const openingPreferencePromotions = result.stats?.openingPreferencePromotions ?? 0;
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
    boundLimited,
    selectedScoreTrails,
    openingPreferencePromotions
  });

  return {
    bestMove,
    nextMove,
    scoreGap,
    scoreGapText: `${scoreGap} cp`,
    selectedScoreTrails,
    openingPreferencePromotions,
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
  const selectedMove = result.candidates[0]?.move
    ? (result.candidates[0].move.notation ?? moveToNotation(result.candidates[0].move))
    : null;
  const openingPreferencePromotions = result.stats?.openingPreferencePromotions ?? 0;
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
    const scoreGapFromSelected = Math.abs(Math.round(bestScore - candidate.score));
    const scoresAboveSelected = index > 0 && candidate.score > bestScore;
    const centipawnLoss = scoresAboveSelected ? 0 : explanation.centipawnLoss;
    const verdict = nativeAlternativeVerdict(index, scoresAboveSelected ? scoreGapFromSelected : centipawnLoss);
    const contrast = nativeAlternativeContrast(index, centipawnLoss, {
      scoresAboveSelected,
      scoreGapFromSelected,
      selectedMove,
      openingPreferencePromotions
    });
    const candidateReasons = scoresAboveSelected
      ? explanation.reasons.filter((reason) => !/trails|effectively tied/i.test(reason))
      : explanation.reasons;

    return {
      rank: index + 1,
      move: candidate.move.notation ?? moveToNotation(candidate.move),
      score: Math.round(candidate.score),
      scoreDetail: candidate.scoreDetail ?? null,
      wdl: candidate.wdl ?? null,
      centipawnLoss,
      scoreGapFromSelected,
      scoresAboveSelected,
      verdict,
      summary: explanation.summary,
      reasons: unique([
        contrast,
        ...candidateReasons
      ]).slice(0, 5),
      expectedReply: linePlan.expectedReply,
      motifs: linePlan.motifs,
      linePlanSummary: linePlan.summary,
      planComparison: nativeAlternativePlanComparison(linePlan, bestLinePlan, {
        index,
        centipawnLoss: scoresAboveSelected ? scoreGapFromSelected : centipawnLoss,
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

function nativeAlternativeContrast(index, centipawnLoss, options = {}) {
  if (index === 0) return "top native line";
  if (options.scoresAboveSelected) {
    const selected = options.selectedMove ? ` ${options.selectedMove}` : "";
    const source = options.openingPreferencePromotions > 0
      ? "the opening/root preference"
      : "native root ordering";
    return `scores ${options.scoreGapFromSelected} centipawns above the selected native line${selected}, but ${source} kept the selected line first`;
  }
  if (centipawnLoss <= 15) return `roughly tied with the top native line, trailing by ${centipawnLoss} centipawns`;
  return `trails the top native line by ${centipawnLoss} centipawns`;
}

function capitalizeFirst(text) {
  return `${String(text ?? "").slice(0, 1).toUpperCase()}${String(text ?? "").slice(1)}`;
}

function nativeComparisonReason({
  bestMove,
  nextMove,
  bestScoreText,
  nextScoreText,
  scoreGap,
  nearlyTied,
  boundLimited,
  selectedScoreTrails,
  openingPreferencePromotions
}) {
  if (boundLimited) {
    return `Native MultiPV reports bound-limited scores: ${bestMove} is ${bestScoreText}, while ${nextMove} is ${nextScoreText}; the displayed gap is ${scoreGap} centipawns, but the exact margin may differ.`;
  }

  if (selectedScoreTrails) {
    const source = openingPreferencePromotions > 0
      ? "a native opening/root preference"
      : "the native root ordering";
    return `${capitalizeFirst(source)} promoted ${bestMove} even though ${nextMove}'s raw MultiPV score is ${scoreGap} centipawns higher (${bestScoreText} vs ${nextScoreText}).`;
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

function nativeSearchMemoryReason(stats = {}) {
  const age = Math.max(0, Math.round(stats.memoryAge ?? 0));
  if (age <= 1) return null;

  const prior = age - 1;
  return `Native search reused ordering memory warmed by ${prior} earlier search${prior === 1 ? "" : "es"}.`;
}

function nativeSelectiveSearchReason(stats = {}) {
  if (!stats) return null;

  const parts = [];
  if ((stats.qnodes ?? 0) > 0) parts.push(nativeCount(stats.qnodes, "quiescence node"));
  if ((stats.qchecks ?? 0) > 0) parts.push(nativeCount(stats.qchecks, "forcing quiet check"));
  if ((stats.qCheckHistoryHits ?? 0) > 0) parts.push(nativeCount(stats.qCheckHistoryHits, "quiet-check history hit"));
  if ((stats.qCheckHistoryStores ?? 0) > 0) parts.push(nativeCount(stats.qCheckHistoryStores, "quiet-check history update"));
  if ((stats.qCheckHistoryMaluses ?? 0) > 0) parts.push(nativeCount(stats.qCheckHistoryMaluses, "quiet-check history malus"));
  if ((stats.qCaptureHistoryPruneGuards ?? 0) > 0) parts.push(nativeCount(stats.qCaptureHistoryPruneGuards, "qsearch capture-history prune guard"));
  if ((stats.qCaptureHistoryHits ?? 0) > 0) parts.push(nativeCount(stats.qCaptureHistoryHits, "qsearch capture-history hit"));
  if ((stats.qCaptureHistoryStores ?? 0) > 0) parts.push(nativeCount(stats.qCaptureHistoryStores, "qsearch capture-history update"));
  if ((stats.qCaptureHistoryMaluses ?? 0) > 0) parts.push(nativeCount(stats.qCaptureHistoryMaluses, "qsearch capture-history malus"));
  if ((stats.qttHits ?? 0) > 0) parts.push(nativeCount(stats.qttHits, "quiescence-table hit"));
  if ((stats.evalCacheHits ?? 0) > 0) parts.push(nativeCount(stats.evalCacheHits, "evaluation-cache hit"));
  if ((stats.checkCacheHits ?? 0) > 0) parts.push(nativeCount(stats.checkCacheHits, "check-cache hit"));
  if ((stats.leastAttackerCacheHits ?? 0) > 0) parts.push(nativeCount(stats.leastAttackerCacheHits, "least-attacker cache hit"));
  if ((stats.checkedEvalSkips ?? 0) > 0) parts.push(nativeCount(stats.checkedEvalSkips, "checked-node eval skip"));
  if ((stats.extensions ?? 0) > 0) parts.push(nativeCount(stats.extensions, "tactical extension"));
  if ((stats.recaptureExtensions ?? 0) > 0) parts.push(nativeCount(stats.recaptureExtensions, "recapture extension"));
  if ((stats.singularExtensions ?? 0) > 0) parts.push(nativeCount(stats.singularExtensions, "singular extension"));
  if ((stats.repetitions ?? 0) > 0) parts.push(nativeCount(stats.repetitions, "draw-assumed repetition guard"));
  if ((stats.nullMovePrunes ?? 0) > 0) parts.push(nativeCount(stats.nullMovePrunes, "null-move cutoff"));
  if ((stats.nullMoveVerifications ?? 0) > 0) parts.push(nativeCount(stats.nullMoveVerifications, "verified null-move recheck"));
  if ((stats.nullMoveVerificationFailures ?? 0) > 0) parts.push(nativeCount(stats.nullMoveVerificationFailures, "rejected null-move shortcut"));
  if ((stats.nullMoveMaterialGuards ?? 0) > 0) parts.push(nativeCount(stats.nullMoveMaterialGuards, "low-material null-move guard"));
  if ((stats.reverseFutilityPrunes ?? 0) > 0) parts.push(nativeCount(stats.reverseFutilityPrunes, "reverse-futility prune"));
  if ((stats.mateDistancePrunes ?? 0) > 0) parts.push(nativeCount(stats.mateDistancePrunes, "mate-distance prune"));
  if ((stats.razorPrunes ?? 0) > 0) parts.push(nativeCount(stats.razorPrunes, "razoring cutoff"));
  if ((stats.seePrunes ?? 0) > 0) parts.push(nativeCount(stats.seePrunes, "static-exchange prune"));
  if ((stats.probCutPrunes ?? 0) > 0) parts.push(nativeCount(stats.probCutPrunes, "ProbCut capture prune"));
  if ((stats.probCutCaptureSkips ?? 0) > 0) parts.push(nativeCount(stats.probCutCaptureSkips, "ProbCut capture prefilter"));
  if ((stats.futilityPrunes ?? 0) > 0) parts.push(nativeCount(stats.futilityPrunes, "futility prune"));
  if ((stats.badHistoryPrunes ?? 0) > 0) parts.push(nativeCount(stats.badHistoryPrunes, "bad-history prune"));
  if ((stats.deltaPrunes ?? 0) > 0) parts.push(nativeCount(stats.deltaPrunes, "delta prune"));
  if ((stats.qDeltaPrefilterSkips ?? 0) > 0) parts.push(nativeCount(stats.qDeltaPrefilterSkips, "qsearch delta prefilter"));
  if ((stats.qSeePrunes ?? 0) > 0) parts.push(nativeCount(stats.qSeePrunes, "quiescence SEE prune"));
  if ((stats.lateMovePrunes ?? 0) > 0) parts.push(nativeCount(stats.lateMovePrunes, "late-move prune"));
  if ((stats.depthThreeLateMovePrunes ?? 0) > 0) parts.push(nativeCount(stats.depthThreeLateMovePrunes, "depth-3 late-move prune"));
  if ((stats.pvReductionGuards ?? 0) > 0) parts.push(nativeCount(stats.pvReductionGuards, "PV-node reduction guard"));
  if ((stats.cutNodeReductionBoosts ?? 0) > 0) parts.push(nativeCount(stats.cutNodeReductionBoosts, "cut-node reduction boost"));
  if ((stats.improvingReductionGuards ?? 0) > 0) parts.push(nativeCount(stats.improvingReductionGuards, "improving-position reduction guard"));
  if ((stats.nonImprovingReductionBoosts ?? 0) > 0) parts.push(nativeCount(stats.nonImprovingReductionBoosts, "worsening-position reduction boost"));
  if ((stats.rootChildStateReuses ?? 0) > 0) parts.push(nativeCount(stats.rootChildStateReuses, "root child-state reuse"));
  if ((stats.rootReductions ?? 0) > 0) parts.push(nativeCount(stats.rootReductions, "root late-move reduction"));
  if ((stats.rootReductionResearches ?? 0) > 0) parts.push(nativeCount(stats.rootReductionResearches, "root reduction re-search"));
  if ((stats.rootTtHits ?? 0) > 0) parts.push(nativeCount(stats.rootTtHits, "root transposition-table ordering hint"));
  if ((stats.rootOrderHits ?? 0) > 0) parts.push(nativeCount(stats.rootOrderHits, "persisted root-order hint"));
  if ((stats.rootTimeGuardStops ?? 0) > 0) parts.push(nativeCount(stats.rootTimeGuardStops, "root time-guard stop"));
  if ((stats.openingPreferencePromotions ?? 0) > 0) parts.push(nativeCount(stats.openingPreferencePromotions, "opening/root preference promotion"));
  if ((stats.rootTtStores ?? 0) > 0) parts.push(nativeCount(stats.rootTtStores, "root transposition-table store"));
  if ((stats.ttMoveHits ?? 0) > 0) parts.push(nativeCount(stats.ttMoveHits, "transposition hash-move ordering hint"));
  if ((stats.captureHistoryHits ?? 0) > 0) parts.push(nativeCount(stats.captureHistoryHits, "capture-history hit"));
  if ((stats.captureHistoryStores ?? 0) > 0) parts.push(nativeCount(stats.captureHistoryStores, "capture-history update"));
  if ((stats.captureHistoryMaluses ?? 0) > 0) parts.push(nativeCount(stats.captureHistoryMaluses, "capture-history malus"));
  if ((stats.captureHistoryPruneGuards ?? 0) > 0) parts.push(nativeCount(stats.captureHistoryPruneGuards, "capture-history prune guard"));
  if ((stats.countermoveHits ?? 0) > 0) parts.push(nativeCount(stats.countermoveHits, "countermove-order hit"));
  if ((stats.continuationHistoryHits ?? 0) > 0) parts.push(nativeCount(stats.continuationHistoryHits, "continuation-history hit"));
  if ((stats.checkEvasionOrderHits ?? 0) > 0) parts.push(nativeCount(stats.checkEvasionOrderHits, "check-evasion ordering hint"));
  if ((stats.checkHistoryHits ?? 0) > 0) parts.push(nativeCount(stats.checkHistoryHits, "check-history hit"));
  if ((stats.iidMoveHits ?? 0) > 0) parts.push(nativeCount(stats.iidMoveHits, "internal-iterative-deepening move hint"));
  if ((stats.pvsResearches ?? 0) > 0) parts.push(nativeCount(stats.pvsResearches, "PVS re-search"));
  if ((stats.aspirationSearches ?? 0) > 0) parts.push(nativeCount(stats.aspirationSearches, "aspiration-window search"));
  if ((stats.aspirationWidenedSearches ?? 0) > 0) parts.push(nativeCount(stats.aspirationWidenedSearches, "widened aspiration-window re-search"));
  if ((stats.killerHits ?? 0) > 0) parts.push(nativeCount(stats.killerHits, "killer-move hit"));

  return parts.length > 0 ? `Native selective search used ${parts.join(", ")}.` : null;
}

function nativeCount(value, singular) {
  const count = Math.max(0, Math.round(value ?? 0));
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
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
  const depth = parseOptionalPositiveInteger(options.depth);
  const lines = normalizeLineCount(options.lines ?? options.multiPv ?? options.multipv ?? 1);
  const explicitMoveTime = numberOption(options.timeLimitMs, options.movetime, options.moveTimeMs, options.moveTime);
  const protocol = normalizeNativeProtocol(options.protocol);
  const parts = ["go"];
  if (depth !== null) parts.push("depth", depth);

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

function parseOptionalPositiveInteger(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
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

function formatPositionCommand(position, options = {}, protocol = "ucci") {
  const moveHistory = normalizeMoveHistory(options.moveHistory ?? options.historyMoves);
  if (options.initialPosition && moveHistory.length > 0) {
    const moves = moveHistory.map((move) => compactNativeMove(move, protocol)).join(" ");
    return `position fen ${toNativeFen(options.initialPosition, protocol)} moves ${moves}`;
  }
  return `position fen ${toNativeFen(position, protocol)}`;
}

function normalizeMoveHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((move) => move !== null && move !== undefined && move !== "");
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
    qnodes: parsed.qnodes ?? 0,
    seldepth: parsed.seldepth ?? parsed.telemetry?.seldepth ?? 0,
    timeMs: parsed.timeMs ?? parsed.telemetry?.timeMs ?? 0,
    nps: parsed.nps ?? parsed.telemetry?.nps ?? 0,
    hashfull: parsed.hashfull ?? parsed.telemetry?.hashfull ?? 0,
    memoryAge: parsed.memoryAge ?? 0,
    qchecks: parsed.qchecks ?? 0,
    qCheckHistoryHits: parsed.qCheckHistoryHits ?? 0,
    qCheckHistoryStores: parsed.qCheckHistoryStores ?? 0,
    qCheckHistoryMaluses: parsed.qCheckHistoryMaluses ?? 0,
    qCaptureHistoryPruneGuards: parsed.qCaptureHistoryPruneGuards ?? 0,
    qCaptureHistoryHits: parsed.qCaptureHistoryHits ?? 0,
    qCaptureHistoryStores: parsed.qCaptureHistoryStores ?? 0,
    qCaptureHistoryMaluses: parsed.qCaptureHistoryMaluses ?? 0,
    qttHits: parsed.qttHits ?? 0,
    qttStores: parsed.qttStores ?? 0,
    qttMoveHits: parsed.qttMoveHits ?? 0,
    evalCacheHits: parsed.evalCacheHits ?? 0,
    evalCacheStores: parsed.evalCacheStores ?? 0,
    checkedEvalSkips: parsed.checkedEvalSkips ?? 0,
    ttHits: parsed.ttHits ?? 0,
    ttMoveHits: parsed.ttMoveHits ?? 0,
    cutoffs: parsed.cutoffs ?? 0,
    captureHistoryHits: parsed.captureHistoryHits ?? 0,
    captureHistoryStores: parsed.captureHistoryStores ?? 0,
    captureHistoryMaluses: parsed.captureHistoryMaluses ?? 0,
    captureHistoryPruneGuards: parsed.captureHistoryPruneGuards ?? 0,
    extensions: parsed.extensions ?? 0,
    recaptureExtensions: parsed.recaptureExtensions ?? 0,
    reverseFutilityPrunes: parsed.reverseFutilityPrunes ?? 0,
    mateDistancePrunes: parsed.mateDistancePrunes ?? 0,
    razorPrunes: parsed.razorPrunes ?? 0,
    razorResearches: parsed.razorResearches ?? 0,
    seePrunes: parsed.seePrunes ?? 0,
    leastAttackerCacheHits: parsed.leastAttackerCacheHits ?? 0,
    leastAttackerCacheProbes: parsed.leastAttackerCacheProbes ?? 0,
    leastAttackerCacheStores: parsed.leastAttackerCacheStores ?? 0,
    probCutPrunes: parsed.probCutPrunes ?? 0,
    probCutSearches: parsed.probCutSearches ?? 0,
    probCutCaptureSkips: parsed.probCutCaptureSkips ?? 0,
    futilityPrunes: parsed.futilityPrunes ?? 0,
    badHistoryPrunes: parsed.badHistoryPrunes ?? 0,
    badHistoryPruneGuards: parsed.badHistoryPruneGuards ?? 0,
    deltaPrunes: parsed.deltaPrunes ?? 0,
    qDeltaPrefilterSkips: parsed.qDeltaPrefilterSkips ?? 0,
    qSeePrunes: parsed.qSeePrunes ?? 0,
    lateMovePrunes: parsed.lateMovePrunes ?? 0,
    depthThreeLateMovePrunes: parsed.depthThreeLateMovePrunes ?? 0,
    reductions: parsed.reductions ?? 0,
    reductionPlies: parsed.reductionPlies ?? 0,
    deepReductions: parsed.deepReductions ?? 0,
    lmrResearches: parsed.lmrResearches ?? 0,
    pvReductionGuards: parsed.pvReductionGuards ?? 0,
    cutNodeReductionBoosts: parsed.cutNodeReductionBoosts ?? 0,
    improvingNodes: parsed.improvingNodes ?? 0,
    nonImprovingNodes: parsed.nonImprovingNodes ?? 0,
    improvingReductionGuards: parsed.improvingReductionGuards ?? 0,
    nonImprovingReductionBoosts: parsed.nonImprovingReductionBoosts ?? 0,
    improvingLateMoveGuards: parsed.improvingLateMoveGuards ?? 0,
    nonImprovingLateMovePrunes: parsed.nonImprovingLateMovePrunes ?? 0,
    countermoveHits: parsed.countermoveHits ?? 0,
    continuationHistoryHits: parsed.continuationHistoryHits ?? 0,
    continuationReductionBoosts: parsed.continuationReductionBoosts ?? 0,
    continuationReductionMaluses: parsed.continuationReductionMaluses ?? 0,
    checkEvasionOrderHits: parsed.checkEvasionOrderHits ?? 0,
    checkEvasionCaptures: parsed.checkEvasionCaptures ?? 0,
    checkEvasionBlocks: parsed.checkEvasionBlocks ?? 0,
    checkEvasionKingMoves: parsed.checkEvasionKingMoves ?? 0,
    checkHistoryHits: parsed.checkHistoryHits ?? 0,
    checkHistoryStores: parsed.checkHistoryStores ?? 0,
    checkHistoryMaluses: parsed.checkHistoryMaluses ?? 0,
    checkCacheHits: parsed.checkCacheHits ?? 0,
    checkCacheStores: parsed.checkCacheStores ?? 0,
    iidSearches: parsed.iidSearches ?? 0,
    iidMoveHits: parsed.iidMoveHits ?? 0,
    rootMovesSearched: parsed.rootMovesSearched ?? 0,
    rootChildStateReuses: parsed.rootChildStateReuses ?? 0,
    rootReductions: parsed.rootReductions ?? 0,
    rootReductionPlies: parsed.rootReductionPlies ?? 0,
    rootReductionResearches: parsed.rootReductionResearches ?? 0,
    rootTtHits: parsed.rootTtHits ?? 0,
    rootTtStores: parsed.rootTtStores ?? 0,
    rootOrderHits: parsed.rootOrderHits ?? 0,
    rootOrderStores: parsed.rootOrderStores ?? 0,
    rootTimeGuardStops: parsed.rootTimeGuardStops ?? 0,
    openingPreferencePromotions: parsed.openingPreferencePromotions ?? 0,
    pvsResearches: parsed.pvsResearches ?? 0,
    aspirationSearches: parsed.aspirationSearches ?? 0,
    aspirationWidenedSearches: parsed.aspirationWidenedSearches ?? 0,
    aspirationFailHigh: parsed.aspirationFailHigh ?? 0,
    aspirationFailLow: parsed.aspirationFailLow ?? 0,
    nullMovePrunes: parsed.nullMovePrunes ?? 0,
    nullMoveVerifications: parsed.nullMoveVerifications ?? 0,
    nullMoveVerificationFailures: parsed.nullMoveVerificationFailures ?? 0,
    nullMoveMaterialGuards: parsed.nullMoveMaterialGuards ?? 0,
    singularExtensionSearches: parsed.singularExtensionSearches ?? 0,
    singularExtensions: parsed.singularExtensions ?? 0,
    singularExtensionRejects: parsed.singularExtensionRejects ?? 0,
    repetitions: parsed.repetitions ?? 0,
    killerHits: parsed.killerHits ?? 0,
    native: true
  };
}

function createEmptyStats() {
  return {
    nodes: 0,
    qnodes: 0,
    memoryAge: 0,
    qchecks: 0,
    qCheckHistoryHits: 0,
    qCheckHistoryStores: 0,
    qCheckHistoryMaluses: 0,
    qCaptureHistoryPruneGuards: 0,
    qCaptureHistoryHits: 0,
    qCaptureHistoryStores: 0,
    qCaptureHistoryMaluses: 0,
    qttHits: 0,
    qttStores: 0,
    qttReplacements: 0,
    qttEvictions: 0,
    qttSkips: 0,
    qttMoveHits: 0,
    evalCacheHits: 0,
    evalCacheStores: 0,
    checkedEvalSkips: 0,
    tacticalCacheHits: 0,
    tacticalCacheStores: 0,
    ttHits: 0,
    ttStores: 0,
    ttReplacements: 0,
    ttEvictions: 0,
    ttSkips: 0,
    ttMoveHits: 0,
    cutoffs: 0,
    aspirationSearches: 0,
    aspirationWidenedSearches: 0,
    aspirationFailHigh: 0,
    aspirationFailLow: 0,
    extensions: 0,
    recaptureExtensions: 0,
    singularExtensionSearches: 0,
    singularExtensions: 0,
    singularExtensionRejects: 0,
    softStops: 0,
    seePrunes: 0,
    leastAttackerCacheHits: 0,
    leastAttackerCacheProbes: 0,
    leastAttackerCacheStores: 0,
    reverseFutilityPrunes: 0,
    mateDistancePrunes: 0,
    mateDistanceWindows: 0,
    razorPrunes: 0,
    razorResearches: 0,
    probCutPrunes: 0,
    probCutSearches: 0,
    probCutCaptureSkips: 0,
    futilityPrunes: 0,
    badHistoryPrunes: 0,
    badHistoryPruneGuards: 0,
    lateMovePrunes: 0,
    depthThreeLateMovePrunes: 0,
    deltaPrunes: 0,
    qDeltaPrefilterSkips: 0,
    qSeePrunes: 0,
    reductions: 0,
    reductionPlies: 0,
    deepReductions: 0,
    lmrResearches: 0,
    pvReductionGuards: 0,
    cutNodeReductionBoosts: 0,
    improvingNodes: 0,
    nonImprovingNodes: 0,
    stableEvalTrendNodes: 0,
    improvingReductionGuards: 0,
    nonImprovingReductionBoosts: 0,
    improvingLateMoveGuards: 0,
    nonImprovingLateMovePrunes: 0,
    pvsResearches: 0,
    nullMovePrunes: 0,
    nullMoveVerifications: 0,
    nullMoveVerificationFailures: 0,
    nullMoveMaterialGuards: 0,
    killerStores: 0,
    killerHits: 0,
    captureHistoryStores: 0,
    captureHistoryHits: 0,
    captureHistoryMaluses: 0,
    captureHistoryPruneGuards: 0,
    checkHistoryStores: 0,
    checkHistoryHits: 0,
    checkHistoryMaluses: 0,
    checkCacheHits: 0,
    checkCacheStores: 0,
    countermoveStores: 0,
    countermoveHits: 0,
    continuationHistoryStores: 0,
    continuationHistoryHits: 0,
    continuationReductionBoosts: 0,
    continuationReductionMaluses: 0,
    checkEvasionOrderHits: 0,
    checkEvasionCaptures: 0,
    checkEvasionBlocks: 0,
    checkEvasionKingMoves: 0,
    historyMaluses: 0,
    historyGravityUpdates: 0,
    rootScoreOrderHits: 0,
    rootRankOrderHits: 0,
    rootOrderHits: 0,
    rootOrderStores: 0,
    rootTimeGuardStops: 0,
    openingPreferencePromotions: 0,
    iidSearches: 0,
    iidMoveHits: 0,
    rootMovesSearched: 0,
    rootChildStateReuses: 0,
    rootReductions: 0,
    rootReductionPlies: 0,
    rootReductionResearches: 0,
    rootTtHits: 0,
    rootTtStores: 0,
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
  if (isNullBestMove(moveText)) return moveText;
  return translateMoveTokenRanks(moveText);
}

function internalMoveTokenToNative(moveText) {
  if (isNullBestMove(moveText)) return moveText;
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
  if (isNullBestMove(left) || isNullBestMove(right)) return false;
  return moveKey(parseMoveNotation(left)) === moveKey(parseMoveNotation(right));
}

function normalizeScore(score) {
  return Object.is(score, -0) ? 0 : score;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}
