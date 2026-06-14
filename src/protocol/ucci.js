import {
  createInitialPosition,
  moveToNotation,
  parseFen,
  parseMoveNotation
} from "../board.js";
import { createEngine } from "../engine.js";
import { formatScore } from "../reasoning.js";

const DEFAULT_OPTIONS = Object.freeze({
  depth: 4,
  timeLimitMs: 2000,
  multiPv: 1,
  useBook: true
});

export class UcciSession {
  constructor(options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.engine = createEngine(this.options);
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
        case "review":
          return this.review(trimmed);
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
      "option name UseBook type check default true",
      "option name Explain type check default true",
      "ucciok"
    ];
  }

  setOption(line) {
    const name = readSetOptionField(line, "name", "value");
    const value = readSetOptionField(line, "value");

    if (!name) return ["info string ignored empty option"];

    const normalized = name.toLowerCase();
    if (normalized === "depth") {
      this.options.depth = clampInteger(value, 1, 12, this.options.depth);
    } else if (normalized === "movetime" || normalized === "timelimitms") {
      this.options.timeLimitMs = clampInteger(value, 50, 120000, this.options.timeLimitMs);
    } else if (normalized === "multipv") {
      this.options.multiPv = clampInteger(value, 1, 12, this.options.multiPv);
    } else if (normalized === "usebook") {
      this.options.useBook = parseBoolean(value, this.options.useBook);
    }

    this.engine = createEngine(this.options);
    return [];
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
    const options = parseGoOptions(line, this.options);
    const multiPv = readTokenInteger(line.split(/\s+/), "multipv", this.options.multiPv);
    if (multiPv > 1) {
      return this.analyze(`analyze depth ${options.depth} movetime ${options.timeLimitMs} lines ${multiPv}`);
    }

    const result = this.engine.chooseMove(this.position, {
      ...options,
      bannedMoves: this.bannedMoves,
      useBook: this.options.useBook
    });

    if (!result.bestMove) {
      return [
        `info depth ${result.depth} score cp ${Math.round(result.score)} nodes ${result.nodes}`,
        "bestmove 0000"
      ];
    }

    const pv = result.principalVariation.map(protocolMove).join(" ");
    const outputs = [];

    if (result.source === "opening-book") {
      outputs.push(`info string book ${result.book.name}: ${result.book.idea}`);
    }

    for (const iteration of result.iterations ?? []) {
      outputs.push(formatIterationInfo(iteration));
    }

    outputs.push(
      `info depth ${result.depth} score cp ${Math.round(result.score)} nodes ${result.nodes} qnodes ${result.stats.qnodes} qchecks ${result.stats.qchecks} tthits ${result.stats.ttHits} asp ${result.stats.aspirationSearches} asphi ${result.stats.aspirationFailHigh} asplo ${result.stats.aspirationFailLow} ext ${result.stats.extensions} nmp ${result.stats.nullMovePrunes} pvs ${result.stats.pvsResearches} pv ${pv}`,
      `info string ${result.explanation.summary}`
    );

    for (const reason of result.explanation.reasons.slice(0, 3)) {
      outputs.push(`info string reason: ${reason}`);
    }

    outputs.push(`bestmove ${protocolMove(result.bestMove)}`);
    return outputs;
  }

  analyze(line) {
    const tokens = line.split(/\s+/);
    const options = parseGoOptions(line.replace(/^analyze/i, "go"), this.options);
    const lines = readTokenInteger(tokens, "lines", readTokenInteger(tokens, "multipv", 3));
    const result = this.engine.analyzePosition(this.position, {
      ...options,
      lines,
      bannedMoves: this.bannedMoves
    });

    if (result.lines.length === 0) return ["info string no legal move"];

    const outputs = result.lines.map((entry) => (
      `info multipv ${entry.rank} depth ${result.depth} score cp ${entry.score} cploss ${entry.centipawnLoss} pv ${entry.principalVariation.map(stripMoveSeparator).join(" ")}`
    ));

    for (const entry of result.lines) {
      outputs.push(`info string line ${entry.rank}: ${entry.explanation.summary}`);
      for (const reason of entry.explanation.reasons.slice(0, 2)) {
        outputs.push(`info string line ${entry.rank} reason: ${reason}`);
      }
    }

    outputs.push(`bestmove ${protocolMove(result.bestMove)}`);
    return outputs;
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
      `info string probe score ${formatScore(result.score)} best ${result.bestMove ? protocolMove(result.bestMove) : "0000"}`
    ];
  }

  pressure(line) {
    const tokens = line.split(/\s+/);
    const limit = readTokenInteger(tokens, "limit", 3);
    const pressure = this.engine.pressure(this.position, { limit });
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

  review(line) {
    if (this.moveHistory.length === 0) return ["info string review no moves"];

    const options = parseGoOptions(line.replace(/^review/i, "go"), this.options);
    const result = this.engine.reviewGame(this.moveHistory, {
      initialPosition: this.initialPosition,
      reviewOptions: {
        ...options,
        useBook: this.options.useBook
      }
    });
    const outputs = [
      `info string review moves ${result.summary.totalMoves} avgcp ${result.summary.averageCentipawnLoss} book ${result.summary.bookMoves} blunders ${result.summary.classifications.blunder}`
    ];

    for (const moment of result.keyMoments.slice(0, 3)) {
      outputs.push(`info string moment ${moment.ply} ${moment.side} ${moment.notation} ${moment.classification} loss ${moment.centipawnLoss} best ${stripMoveSeparator(moment.bestMove)}: ${moment.summary}`);
    }

    return outputs;
  }

  explain() {
    const result = this.engine.chooseMove(this.position, {
      depth: this.options.depth,
      timeLimitMs: this.options.timeLimitMs,
      bannedMoves: this.bannedMoves
    });

    if (!result.bestMove) return ["info string no legal move"];

    return [
      `info string ${result.explanation.summary}`,
      ...result.explanation.reasons.map((reason) => `info string reason: ${reason}`)
    ];
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

function parseGoOptions(line, defaults) {
  const tokens = line.split(/\s+/);
  const depth = readTokenInteger(tokens, "depth", defaults.depth);
  const moveTime = readTokenInteger(tokens, "movetime", defaults.timeLimitMs);
  const timeLimitMs = readTokenInteger(tokens, "time", moveTime);

  return {
    depth,
    timeLimitMs
  };
}

function readTokenInteger(tokens, name, fallback) {
  const index = tokens.findIndex((token) => token.toLowerCase() === name);
  if (index === -1 || index + 1 >= tokens.length) return fallback;

  const value = Number.parseInt(tokens[index + 1], 10);
  return Number.isFinite(value) ? value : fallback;
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
