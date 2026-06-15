import {
  createInitialPosition,
  moveToNotation,
  parseFen,
  parseMoveNotation
} from "../board.js";
import { createLearningEngineBackend } from "../backend-factory.js";
import { createEngine } from "../engine.js";
import { formatScore } from "../reasoning.js";
import { resolveSearchBudget } from "../time.js";

const DEFAULT_OPTIONS = Object.freeze({
  depth: 4,
  timeLimitMs: 2000,
  multiPv: 1,
  hintLevels: 4,
  useBook: true,
  maxTranspositionEntries: 50_000
});

export class UcciSession {
  constructor(options = {}) {
    const { engine, ...sessionOptions } = options;
    this.options = { ...DEFAULT_OPTIONS, ...sessionOptions };
    this.engine = engine ?? createEngine(this.options);
    this.initialPosition = createInitialPosition();
    this.position = createInitialPosition();
    this.moveHistory = [];
    this.bannedMoves = [];
  }

  handleLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return [];

    try {
      const [command] = trimmed.split(/\s+/, 1);

      switch (command.toLowerCase()) {
        case "ucci":
          return this.identify();
        case "isready":
          return ["readyok"];
        case "setoption":
          return this.setOption(trimmed);
        case "position":
          return this.setPosition(trimmed);
        case "banmoves":
          return this.setBannedMoves(trimmed);
        case "book":
          return this.book();
        case "go":
          return this.go(trimmed);
        case "analyze":
          return this.analyze(trimmed);
        case "probe":
          return this.probe(trimmed);
        case "pressure":
          return this.pressure(trimmed);
        case "reviewmove":
        case "review-move":
          return this.reviewMove(trimmed);
        case "review":
          return this.review(trimmed);
        case "lesson":
        case "lessons":
          return this.lesson(trimmed);
        case "hint":
        case "coach":
          return this.hint(trimmed);
        case "explain":
          return this.explain();
        case "quit":
          return ["bye"];
        default:
          return [`info string unknown command: ${trimmed}`];
      }
    } catch (error) {
      return [`info string error: ${error.message}`];
    }
  }

  identify() {
    return [
      "id name Xiangqi Learning Engine",
      "id author juncoflockleader/codex",
      "option name Depth type spin default 4 min 1 max 8",
      "option name MoveTime type spin default 2000 min 50 max 60000",
      "option name MultiPV type spin default 1 min 1 max 12",
      "option name HintLevels type spin default 4 min 1 max 4",
      "option name HashEntries type spin default 50000 min 128 max 1000000",
      "option name UseBook type check default true",
      "option name Explain type check default true",
      "ucciok"
    ];
  }

  setOption(line) {
    const update = applySessionOption(this.options, line);
    if (update.outputs.length > 0) return update.outputs;
    if (update.changed) this.engine = createEngine(this.options);
    return update.outputs;
  }

  setPosition(line) {
    const tokens = line.split(/\s+/);
    const movesIndex = tokens.findIndex((token) => token.toLowerCase() === "moves");
    const positionTokens = tokens.slice(1, movesIndex === -1 ? undefined : movesIndex);
    const moveTokens = movesIndex === -1 ? [] : tokens.slice(movesIndex + 1);

    if (positionTokens[0]?.toLowerCase() === "startpos") {
      this.initialPosition = createInitialPosition();
    } else if (positionTokens[0]?.toLowerCase() === "fen") {
      this.initialPosition = parseFen(positionTokens.slice(1).join(" "));
    } else {
      throw new Error("position requires startpos or fen");
    }

    this.position = this.initialPosition;
    this.moveHistory = [];
    for (const moveText of moveTokens) {
      this.position = this.engine.play(this.position, moveText);
      this.moveHistory.push(moveText);
    }

    this.bannedMoves = [];
    return [];
  }

  setBannedMoves(line) {
    const [, ...moveTexts] = line.split(/\s+/);
    this.bannedMoves = moveTexts.map((moveText) => parseMoveNotation(moveText));
    return [];
  }

  go(line) {
    const options = parseGoOptions(line, this.options, this.position.turn, this.position);
    const multiPv = readTokenInteger(line.split(/\s+/), "multipv", this.options.multiPv);
    if (multiPv > 1) {
      return this.analyze(`analyze depth ${options.depth} movetime ${options.timeLimitMs} lines ${multiPv}`);
    }

    const result = this.engine.chooseMove(this.position, {
      ...options,
      bannedMoves: this.bannedMoves,
      useBook: this.options.useBook
    });

    return formatGoResult(result);
  }

  analyze(line) {
    const tokens = line.split(/\s+/);
    const options = parseGoOptions(line.replace(/^analyze/i, "go"), this.options, this.position.turn, this.position);
    const lines = readTokenInteger(tokens, "lines", readTokenInteger(tokens, "multipv", 3));
    const result = this.engine.analyzePosition(this.position, {
      ...options,
      lines,
      bannedMoves: this.bannedMoves
    });

    return formatAnalyzeResult(result);
  }

  book() {
    if (!this.options.useBook) return ["info string book disabled"];

    const hit = this.engine.openingBook(this.position, {
      bannedMoves: this.bannedMoves,
      useBook: this.options.useBook
    });

    if (!hit) return ["info string book none"];

    return hit.entries.map((entry, index) => (
      `info string book ${index + 1} ${entry.notation} ${entry.name}: ${entry.idea}`
    ));
  }

  probe(line) {
    const setPositionOutput = line.trim().toLowerCase() === "probe"
      ? []
      : this.setPosition(line.replace(/^probe/i, "position"));
    const result = this.engine.chooseMove(this.position, {
      depth: Math.max(1, Math.min(2, this.options.depth)),
      timeLimitMs: Math.min(500, this.options.timeLimitMs)
    });

    return [
      ...setPositionOutput,
      ...formatProbeResult(result)
    ];
  }

  pressure(line) {
    const tokens = line.split(/\s+/);
    const limit = readTokenInteger(tokens, "limit", 3);
    const pressure = this.engine.pressure(this.position, { limit });
    return formatPressureResult(pressure);
  }

  review(line) {
    if (this.moveHistory.length === 0) return ["info string review no moves"];

    const options = parseGoOptions(line.replace(/^review/i, "go"), this.options, this.initialPosition.turn, this.initialPosition);
    const result = this.engine.reviewGame(this.moveHistory, {
      initialPosition: this.initialPosition,
      reviewOptions: {
        ...options,
        useBook: this.options.useBook
      }
    });
    return formatReviewResult(result);
  }

  reviewMove(line) {
    const tokens = line.split(/\s+/);
    const moveText = readReviewMoveText(tokens);
    if (!moveText) return ["info string reviewmove missing move"];

    const options = parseGoOptions(line.replace(/^review-?move/i, "go"), this.options, this.position.turn, this.position);
    const review = this.engine.reviewMove(this.position, moveText, {
      ...options,
      useBook: this.options.useBook
    });
    return formatReviewMoveResult(review);
  }

  lesson(line) {
    if (this.moveHistory.length === 0) return ["info string lesson no moves"];

    const tokens = line.split(/\s+/);
    const options = parseGoOptions(line.replace(/^lessons?/i, "go"), this.options, this.initialPosition.turn, this.initialPosition);
    const maxCards = readTokenInteger(tokens, "cards", readTokenInteger(tokens, "maxcards", 3));
    const includeBook = readTokenBoolean(tokens, "book", true);
    const includeModelMoves = readTokenBoolean(tokens, "model", false);
    const result = this.engine.lessonPlan(this.moveHistory, {
      initialPosition: this.initialPosition,
      reviewOptions: {
        ...options,
        useBook: this.options.useBook
      },
      lessonOptions: {
        maxCards: Math.max(1, Math.min(12, maxCards)),
        includeBook,
        includeModelMoves
      }
    });
    return formatLessonResult(result);
  }

  hint(line) {
    const tokens = line.split(/\s+/);
    const options = parseGoOptions(line.replace(/^(hint|coach)/i, "go"), this.options, this.position.turn, this.position);
    const lines = readTokenInteger(tokens, "lines", readTokenInteger(tokens, "multipv", 3));
    const maxLevels = readTokenInteger(tokens, "levels", readTokenInteger(tokens, "maxlevels", this.options.hintLevels));
    const result = this.engine.coachMove(this.position, {
      ...options,
      lines,
      maxLevels: Math.max(1, Math.min(4, maxLevels)),
      bannedMoves: this.bannedMoves,
      useBook: this.options.useBook
    });
    return formatHintResult(result, lines);
  }

  explain() {
    const result = this.engine.chooseMove(this.position, {
      depth: this.options.depth,
      timeLimitMs: this.options.timeLimitMs,
      bannedMoves: this.bannedMoves
    });

    return formatExplainResult(result);
  }
}

export class AsyncUcciSession extends UcciSession {
  constructor(options = {}) {
    const { backend, engine, ...sessionOptions } = options;
    super({
      ...sessionOptions,
      engine: backend ?? engine ?? createLearningEngineBackend(sessionOptions)
    });
  }

  async handleLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return [];

    try {
      const [command] = trimmed.split(/\s+/, 1);

      switch (command.toLowerCase()) {
        case "ucci":
          return this.identify();
        case "isready":
          await this.engine.ready?.();
          return ["readyok"];
        case "setoption":
          return this.setOption(trimmed);
        case "position":
          return this.setPosition(trimmed);
        case "banmoves":
          return this.setBannedMoves(trimmed);
        case "book":
          return this.book();
        case "go":
          return this.go(trimmed);
        case "analyze":
          return this.analyze(trimmed);
        case "probe":
          return this.probe(trimmed);
        case "pressure":
          return this.pressure(trimmed);
        case "reviewmove":
        case "review-move":
          return this.reviewMove(trimmed);
        case "review":
          return this.review(trimmed);
        case "lesson":
        case "lessons":
          return this.lesson(trimmed);
        case "hint":
        case "coach":
          return this.hint(trimmed);
        case "explain":
          return this.explain();
        case "quit":
          return ["bye"];
        default:
          return [`info string unknown command: ${trimmed}`];
      }
    } catch (error) {
      return [`info string error: ${error.message}`];
    }
  }

  async setOption(line) {
    const update = applySessionOption(this.options, line);
    if (update.outputs.length > 0) return update.outputs;
    if (update.changed) await this.resetEngine();
    return update.outputs;
  }

  async resetEngine() {
    const previous = this.engine;
    await previous.close?.();
    this.engine = createLearningEngineBackend(this.options);
  }

  async go(line) {
    const options = parseGoOptions(line, this.options, this.position.turn, this.position);
    const multiPv = readTokenInteger(line.split(/\s+/), "multipv", this.options.multiPv);
    if (multiPv > 1) {
      return this.analyze(`analyze depth ${options.depth} movetime ${options.timeLimitMs} lines ${multiPv}`);
    }

    const result = await this.engine.chooseMove(this.position, {
      ...options,
      bannedMoves: this.bannedMoves,
      useBook: this.options.useBook
    });

    return formatGoResult(result);
  }

  async analyze(line) {
    const tokens = line.split(/\s+/);
    const options = parseGoOptions(line.replace(/^analyze/i, "go"), this.options, this.position.turn, this.position);
    const lines = readTokenInteger(tokens, "lines", readTokenInteger(tokens, "multipv", 3));
    const result = await this.engine.analyzePosition(this.position, {
      ...options,
      lines,
      bannedMoves: this.bannedMoves
    });

    return formatAnalyzeResult(result);
  }

  async probe(line) {
    const setPositionOutput = line.trim().toLowerCase() === "probe"
      ? []
      : this.setPosition(line.replace(/^probe/i, "position"));
    const result = await this.engine.chooseMove(this.position, {
      depth: Math.max(1, Math.min(2, this.options.depth)),
      timeLimitMs: Math.min(500, this.options.timeLimitMs)
    });

    return [
      ...setPositionOutput,
      ...formatProbeResult(result)
    ];
  }

  async review(line) {
    if (this.moveHistory.length === 0) return ["info string review no moves"];

    const options = parseGoOptions(line.replace(/^review/i, "go"), this.options, this.initialPosition.turn, this.initialPosition);
    const result = await this.engine.reviewGame(this.moveHistory, {
      initialPosition: this.initialPosition,
      reviewOptions: {
        ...options,
        useBook: this.options.useBook
      }
    });

    return formatReviewResult(result);
  }

  async reviewMove(line) {
    const tokens = line.split(/\s+/);
    const moveText = readReviewMoveText(tokens);
    if (!moveText) return ["info string reviewmove missing move"];

    const options = parseGoOptions(line.replace(/^review-?move/i, "go"), this.options, this.position.turn, this.position);
    const review = await this.engine.reviewMove(this.position, moveText, {
      ...options,
      useBook: this.options.useBook
    });

    return formatReviewMoveResult(review);
  }

  async lesson(line) {
    if (this.moveHistory.length === 0) return ["info string lesson no moves"];

    const tokens = line.split(/\s+/);
    const options = parseGoOptions(line.replace(/^lessons?/i, "go"), this.options, this.initialPosition.turn, this.initialPosition);
    const maxCards = readTokenInteger(tokens, "cards", readTokenInteger(tokens, "maxcards", 3));
    const includeBook = readTokenBoolean(tokens, "book", true);
    const includeModelMoves = readTokenBoolean(tokens, "model", false);
    const result = await this.engine.lessonPlan(this.moveHistory, {
      initialPosition: this.initialPosition,
      reviewOptions: {
        ...options,
        useBook: this.options.useBook
      },
      lessonOptions: {
        maxCards: Math.max(1, Math.min(12, maxCards)),
        includeBook,
        includeModelMoves
      }
    });

    return formatLessonResult(result);
  }

  async hint(line) {
    const tokens = line.split(/\s+/);
    const options = parseGoOptions(line.replace(/^(hint|coach)/i, "go"), this.options, this.position.turn, this.position);
    const lines = readTokenInteger(tokens, "lines", readTokenInteger(tokens, "multipv", 3));
    const maxLevels = readTokenInteger(tokens, "levels", readTokenInteger(tokens, "maxlevels", this.options.hintLevels));
    const result = await this.engine.coachMove(this.position, {
      ...options,
      lines,
      maxLevels: Math.max(1, Math.min(4, maxLevels)),
      bannedMoves: this.bannedMoves,
      useBook: this.options.useBook
    });

    return formatHintResult(result, lines);
  }

  async explain() {
    const result = await this.engine.chooseMove(this.position, {
      depth: this.options.depth,
      timeLimitMs: this.options.timeLimitMs,
      bannedMoves: this.bannedMoves
    });

    return formatExplainResult(result);
  }

  async close() {
    await this.engine.close?.();
  }
}

export function protocolMove(move) {
  return (move.notation ?? moveToNotation(move)).replace("-", "");
}

function stripMoveSeparator(notation) {
  return notation.replace("-", "");
}

function formatIterationInfo(iteration) {
  const move = iteration.bestMove ? protocolMove(iteration.bestMove) : "0000";
  const pv = (iteration.principalVariation ?? []).map(protocolMove).join(" ");
  const stable = iteration.stableBestMove === null
    ? "initial"
    : iteration.stableBestMove ? "true" : "false";

  return `info depth ${iteration.depth} currmove ${move} score cp ${Math.round(iteration.score)} nodes ${iteration.nodes} stable ${stable} pv ${pv}`;
}

function formatGoResult(result) {
  if (!result.bestMove) {
    return [
      `info depth ${result.depth} score cp ${Math.round(result.score)} nodes ${result.nodes}`,
      "bestmove 0000"
    ];
  }

  const pv = result.principalVariation.map(protocolMove).join(" ");
  const stats = result.stats ?? {};
  const outputs = [];

  if (result.source === "opening-book") {
    outputs.push(`info string book ${result.book.name}: ${result.book.idea}`);
  }

  for (const iteration of result.iterations ?? []) {
    outputs.push(formatIterationInfo(iteration));
  }

  outputs.push(
    `info depth ${result.depth} score cp ${Math.round(result.score)} nodes ${result.nodes} qnodes ${stats.qnodes ?? 0} qchecks ${stats.qchecks ?? 0} qtthits ${stats.qttHits ?? 0} qttstores ${stats.qttStores ?? 0} qttevict ${stats.qttEvictions ?? 0} evalhits ${stats.evalCacheHits ?? 0} evalstores ${stats.evalCacheStores ?? 0} tthits ${stats.ttHits ?? 0} ttstores ${stats.ttStores ?? 0} ttevict ${stats.ttEvictions ?? 0} asp ${stats.aspirationSearches ?? 0} asphi ${stats.aspirationFailHigh ?? 0} asplo ${stats.aspirationFailLow ?? 0} ext ${stats.extensions ?? 0} recext ${stats.recaptureExtensions ?? 0} singtry ${stats.singularExtensionSearches ?? 0} singext ${stats.singularExtensions ?? 0} soft ${stats.softStops ?? 0} see ${stats.seePrunes ?? 0} rfp ${stats.reverseFutilityPrunes ?? 0} mdp ${stats.mateDistancePrunes ?? 0} razor ${stats.razorPrunes ?? 0} pcut ${stats.probCutPrunes ?? 0} pcsearch ${stats.probCutSearches ?? 0} futil ${stats.futilityPrunes ?? 0} lmp ${stats.lateMovePrunes ?? 0} delta ${stats.deltaPrunes ?? 0} nmp ${stats.nullMovePrunes ?? 0} nmv ${stats.nullMoveVerifications ?? 0} nmvfail ${stats.nullMoveVerificationFailures ?? 0} caphist ${stats.captureHistoryHits ?? 0} red ${stats.reductions ?? 0} redply ${stats.reductionPlies ?? 0} deepred ${stats.deepReductions ?? 0} cm ${stats.countermoveHits ?? 0} ch ${stats.continuationHistoryHits ?? 0} hmalus ${stats.historyMaluses ?? 0} rootord ${stats.rootScoreOrderHits ?? 0} iid ${stats.iidSearches ?? 0} iidhit ${stats.iidMoveHits ?? 0} rootmoves ${stats.rootMovesSearched ?? 0} pvs ${stats.pvsResearches ?? 0} pv ${pv}`,
    `info string ${result.explanation.summary}`
  );
  pushPlanInfo(outputs, "go", result.explanation.linePlan, { steps: true });

  for (const reason of result.explanation.reasons.slice(0, 3)) {
    outputs.push(`info string reason: ${reason}`);
  }

  outputs.push(`bestmove ${protocolMove(result.bestMove)}`);
  return outputs;
}

function formatAnalyzeResult(result) {
  if (result.lines.length === 0) return ["info string no legal move"];

  const outputs = result.lines.map((entry) => (
    `info multipv ${entry.rank} depth ${result.depth} score cp ${entry.score} cploss ${entry.centipawnLoss} pv ${entry.principalVariation.map(stripMoveSeparator).join(" ")}`
  ));

  for (const entry of result.lines) {
    outputs.push(`info string line ${entry.rank}: ${entry.explanation.summary}`);
    pushPlanInfo(outputs, `line ${entry.rank}`, entry.explanation.linePlan);
    for (const reason of entry.explanation.reasons.slice(0, 2)) {
      outputs.push(`info string line ${entry.rank} reason: ${reason}`);
    }
  }

  outputs.push(`bestmove ${protocolMove(result.bestMove)}`);
  return outputs;
}

function formatProbeResult(result) {
  return [
    `info string probe score ${formatScore(result.score)} best ${result.bestMove ? protocolMove(result.bestMove) : "0000"}`
  ];
}

function formatPressureResult(pressure) {
  const outputs = [
    `info string pressure side ${pressure.side} incheck ${pressure.inCheck ? "true" : "false"}`
  ];

  for (const threat of pressure.threats) {
    outputs.push(`info string threat ${threat.notation}: ${threat.summary}`);
  }

  for (const threat of pressure.opponentThreats) {
    outputs.push(`info string opponent-threat ${threat.notation}: ${threat.summary}`);
  }

  return outputs;
}

function formatReviewResult(result) {
  const outputs = [
    `info string review moves ${result.summary.totalMoves} avgcp ${result.summary.averageCentipawnLoss} book ${result.summary.bookMoves} blunders ${result.summary.classifications.blunder}`
  ];

  for (const moment of result.keyMoments.slice(0, 3)) {
    outputs.push(`info string moment ${moment.ply} ${moment.side} ${moment.notation} ${moment.classification} loss ${moment.centipawnLoss} best ${stripMoveSeparator(moment.bestMove)}: ${moment.summary}`);
    pushPracticeFocusInfo(outputs, `moment ${moment.ply}`, moment.practiceFocus);
    pushReviewScoreInfo(outputs, `moment ${moment.ply}`, moment);
    pushPlanInfo(outputs, `moment ${moment.ply} played`, moment.playedLinePlan);
    pushPlanInfo(outputs, `moment ${moment.ply} best`, moment.bestLinePlan);
    pushPlanComparisonInfo(outputs, `moment ${moment.ply}`, moment.planComparison);
  }

  return outputs;
}

function formatReviewMoveResult(review) {
  const outputs = [
    `info string reviewmove played ${stripMoveSeparator(review.move.notation)} ${review.classification} loss ${review.centipawnLoss} best ${protocolMove(review.bestMove)}: ${review.explanation.summary}`
  ];

  pushReviewScoreInfo(outputs, "reviewmove", review);
  pushPracticeFocusInfo(outputs, "reviewmove", review.practiceFocus);
  pushPlanInfo(outputs, "reviewmove played", review.playedLinePlan);
  pushPlanInfo(outputs, "reviewmove best", review.bestLinePlan);
  pushPlanComparisonInfo(outputs, "reviewmove", review.planComparison);

  for (const reason of review.explanation.reasons.slice(0, 3)) {
    outputs.push(`info string reviewmove reason: ${reason}`);
  }

  outputs.push(`bestmove ${protocolMove(review.bestMove)}`);
  return outputs;
}

function pushPracticeFocusInfo(outputs, prefix, practiceFocus) {
  if (!practiceFocus) return;
  outputs.push(`info string ${prefix} practice ${practiceFocus.drill} ${practiceFocus.title}: ${practiceFocus.text}`);
}

function formatLessonResult(result) {
  const outputs = [
    `info string lesson cards ${result.summary.totalCards} avgcp ${result.averageCentipawnLoss} highimpact ${result.summary.highImpact} practice ${result.summary.practiceFocus ?? 0}`
  ];

  for (const card of result.cards) {
    outputs.push(`info string lesson ${card.rank} ${card.type} ply ${card.ply} side ${card.side} played ${stripMoveSeparator(card.playedMove)} best ${stripMoveSeparator(card.bestMove)} loss ${card.centipawnLoss} tags ${card.tags.join(",")}`);
    outputs.push(`info string lesson ${card.rank} prompt: ${card.prompt}`);
    for (const hint of card.hints) {
      outputs.push(`info string lesson ${card.rank} hint ${hint.level} ${hint.kind}: ${hint.text}`);
    }
    pushPracticeFocusInfo(outputs, `lesson ${card.rank}`, card.practiceFocus);
    pushReviewScoreInfo(outputs, `lesson ${card.rank}`, card);
    pushPlanInfo(outputs, `lesson ${card.rank} played`, card.playedLinePlan);
    pushPlanInfo(outputs, `lesson ${card.rank} best`, card.bestLinePlan);
    pushPlanComparisonInfo(outputs, `lesson ${card.rank}`, card.planComparison);
    outputs.push(`info string lesson ${card.rank} answer ${stripMoveSeparator(card.answer.move)}: ${card.answer.summary}`);
  }

  return outputs;
}

function formatHintResult(result, lines) {
  const outputs = [
    `info string hint side ${result.side} source ${result.source} depth ${result.depth ?? 0}`
  ];

  for (const level of result.levels) {
    outputs.push(`info string hint level ${level.level} ${level.kind} ${level.title}: ${level.text}`);
  }

  if (!result.bestMove) {
    outputs.push("bestmove 0000");
    return outputs;
  }

  for (const alternative of result.alternatives.slice(0, lines)) {
    outputs.push(`info string hint candidate ${alternative.rank} ${stripMoveSeparator(alternative.notation)} score ${alternative.score}`);
  }

  const shouldReveal = result.levels.some((level) => level.kind === "reveal");
  if (shouldReveal) {
    outputs.push(`info string hint best ${protocolMove(result.bestMove)} pv ${result.principalVariation.map(stripMoveSeparator).join(" ")}`);
    outputs.push(`bestmove ${protocolMove(result.bestMove)}`);
  }

  return outputs;
}

function formatExplainResult(result) {
  if (!result.bestMove) return ["info string no legal move"];

  return [
    `info string ${result.explanation.summary}`,
    ...result.explanation.reasons.map((reason) => `info string reason: ${reason}`)
  ];
}

function pushPlanInfo(outputs, prefix, linePlan, options = {}) {
  if (!linePlan?.summary) return;
  outputs.push(`info string ${prefix} plan: ${linePlan.summary}`);
  if (!options.steps) return;

  for (const step of (linePlan.moves ?? []).slice(0, 5)) {
    const motifs = step.motifs?.length ? ` motifs ${step.motifs.join(",")}` : "";
    outputs.push(`info string ${prefix} plan step ${step.ply} ${step.side} ${step.role} ${stripMoveSeparator(step.move)} ${step.scoreBeforeText}->${step.scoreAfterText} ${step.scoreDeltaText}${motifs}`);
  }
}

function pushReviewScoreInfo(outputs, prefix, review) {
  const playedScoreText = reviewScoreText(review, "played");
  const bestScoreText = reviewScoreText(review, "best");
  const playedWdl = review?.playedWdl ?? null;
  const bestWdl = review?.bestWdl ?? review?.bestAnalysis?.wdl ?? null;
  if (playedScoreText || bestScoreText) {
    outputs.push(`info string ${prefix} score played ${playedScoreText ?? "unknown"} best ${bestScoreText ?? "unknown"}`);
  }
  if (playedWdl?.text || bestWdl?.text) {
    outputs.push(`info string ${prefix} wdl played ${playedWdl?.text ?? "unknown"} best ${bestWdl?.text ?? "unknown"}`);
  }
}

function reviewScoreText(review, side) {
  if (!review) return null;
  if (side === "played") {
    return review.playedScoreText
      ?? review.playedScoreDetail?.text
      ?? (Number.isFinite(review.playedScore) ? formatScore(review.playedScore) : null);
  }

  return review.bestScoreText
    ?? review.bestScoreDetail?.text
    ?? review.bestAnalysis?.scoreDetail?.text
    ?? (Number.isFinite(review.bestScore) ? formatScore(review.bestScore) : null);
}

function pushPlanComparisonInfo(outputs, prefix, comparison) {
  if (!comparison?.summary) return;
  outputs.push(`info string ${prefix} plan comparison: ${comparison.summary}`);
}

function parseGoOptions(line, defaults, side = "red", position = null) {
  const tokens = line.split(/\s+/);
  const depth = readTokenInteger(tokens, "depth", defaults.depth);
  const rawOptions = {
    depth,
    movetime: readTokenInteger(tokens, "movetime", null),
    timeLimitMs: readTokenInteger(tokens, "time", null),
    wtime: readTokenInteger(tokens, "wtime", null),
    btime: readTokenInteger(tokens, "btime", null),
    winc: readTokenInteger(tokens, "winc", null),
    binc: readTokenInteger(tokens, "binc", null),
    movestogo: readTokenInteger(tokens, "movestogo", null),
    minTimeMs: defaults.minTimeMs,
    reserveMs: defaults.reserveMs,
    maxTimeFraction: defaults.maxTimeFraction,
    incrementFraction: defaults.incrementFraction
  };
  const timeBudget = resolveSearchBudget(rawOptions, side, defaults, { position });

  return {
    depth,
    ...rawOptions,
    timeLimitMs: timeBudget.timeLimitMs,
    timeBudget
  };
}

function applySessionOption(options, line) {
  const name = readSetOptionField(line, "name", "value");
  const value = readSetOptionField(line, "value");

  if (!name) return { changed: false, outputs: ["info string ignored empty option"] };

  const normalized = name.toLowerCase();
  if (normalized === "depth") {
    options.depth = clampInteger(value, 1, 12, options.depth);
  } else if (normalized === "movetime" || normalized === "timelimitms") {
    options.timeLimitMs = clampInteger(value, 50, 120000, options.timeLimitMs);
  } else if (normalized === "multipv") {
    options.multiPv = clampInteger(value, 1, 12, options.multiPv);
  } else if (normalized === "hintlevels") {
    options.hintLevels = clampInteger(value, 1, 4, options.hintLevels);
  } else if (normalized === "hashentries" || normalized === "maxtranspositionentries") {
    options.maxTranspositionEntries = clampInteger(value, 128, 1_000_000, options.maxTranspositionEntries);
  } else if (normalized === "usebook") {
    options.useBook = parseBoolean(value, options.useBook);
  } else {
    return { changed: false, outputs: [] };
  }

  return { changed: true, outputs: [] };
}

function readTokenInteger(tokens, name, fallback) {
  const index = tokens.findIndex((token) => token.toLowerCase() === name);
  if (index === -1 || index + 1 >= tokens.length) return fallback;

  const value = Number.parseInt(tokens[index + 1], 10);
  return Number.isFinite(value) ? value : fallback;
}

function readTokenBoolean(tokens, name, fallback) {
  const index = tokens.findIndex((token) => token.toLowerCase() === name);
  if (index === -1 || index + 1 >= tokens.length) return fallback;
  return parseBoolean(tokens[index + 1], fallback);
}

function readReviewMoveText(tokens) {
  const optionNames = new Set([
    "depth",
    "movetime",
    "time",
    "wtime",
    "btime",
    "winc",
    "binc",
    "movestogo",
    "move"
  ]);

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    const normalized = token.toLowerCase();
    if (normalized === "move") return tokens[index + 1] ?? null;
    if (optionNames.has(normalized)) {
      index += 1;
      continue;
    }
    return token;
  }

  return null;
}

function readSetOptionField(line, field, untilField = null) {
  const tokens = line.split(/\s+/);
  const start = tokens.findIndex((token) => token.toLowerCase() === field);
  if (start === -1) return "";

  const end = untilField
    ? tokens.findIndex((token, index) => index > start && token.toLowerCase() === untilField)
    : tokens.length;

  return tokens.slice(start + 1, end === -1 ? tokens.length : end).join(" ");
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function parseBoolean(value, fallback) {
  if (typeof value !== "string") return fallback;
  const normalized = value.toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
}
