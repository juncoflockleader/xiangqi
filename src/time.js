import { SIDES } from "./constants.js";

const DEFAULT_TIME_LIMIT_MS = 2000;
const DEFAULT_MOVES_TO_GO = 30;
const DEFAULT_INCREMENT_FRACTION = 0.75;
const DEFAULT_MAX_FRACTION = 0.3;
const DEFAULT_RESERVE_MS = 100;
const DEFAULT_MIN_MS = 50;
const DEFAULT_MOVE_OVERHEAD_MS = 0;
const DEFAULT_LOW_TIME_THRESHOLD_MS = 15000;
const DEFAULT_CRITICAL_TIME_THRESHOLD_MS = 5000;
const DEFAULT_LOW_TIME_MAX_FRACTION = 0.24;
const DEFAULT_CRITICAL_TIME_MAX_FRACTION = 0.18;

export function resolveSearchBudget(options = {}, side = SIDES.RED, defaults = {}, context = {}) {
  const fallbackTimeLimitMs = numberOption(
    defaults.timeLimitMs,
    defaults.movetime,
    DEFAULT_TIME_LIMIT_MS
  );
  const explicitMoveTime = numberOption(
    options.timeLimitMs,
    options.movetime,
    options.moveTimeMs,
    options.moveTime
  );

  if (explicitMoveTime !== null) {
    return {
      source: "movetime",
      timeLimitMs: clampTime(explicitMoveTime, options, defaults),
      remainingMs: null,
      incrementMs: 0,
      movesToGo: null,
      estimatedMovesToGo: false,
      clockPressure: "none",
      phase: "none"
    };
  }

  const remainingMs = sideTimeOption(options, side);
  if (remainingMs === null) {
    return {
      source: "default",
      timeLimitMs: clampTime(fallbackTimeLimitMs, options, defaults),
      remainingMs: null,
      incrementMs: 0,
      movesToGo: null,
      estimatedMovesToGo: false,
      clockPressure: "none",
      phase: "none"
    };
  }

  const incrementMs = sideIncrementOption(options, side) ?? 0;
  const position = context.position ?? options.position ?? defaults.position ?? null;
  const moveEstimate = resolveMovesToGo(options, defaults, position);
  const movesToGo = moveEstimate.movesToGo;
  const reserveMs = Math.max(0, numberOption(options.reserveMs, defaults.reserveMs, DEFAULT_RESERVE_MS));
  const maxFraction = numberOption(options.maxTimeFraction, defaults.maxTimeFraction, DEFAULT_MAX_FRACTION);
  const incrementFraction = numberOption(options.incrementFraction, defaults.incrementFraction, DEFAULT_INCREMENT_FRACTION);
  const minMs = Math.max(1, numberOption(options.minTimeMs, defaults.minTimeMs, DEFAULT_MIN_MS));
  const moveOverheadMs = Math.max(0, numberOption(options.moveOverheadMs, defaults.moveOverheadMs, DEFAULT_MOVE_OVERHEAD_MS));
  const pressure = clockPressure(remainingMs, options, defaults);
  const pressureMaxFraction = maxFractionForPressure(maxFraction, pressure, options, defaults);
  const safeRemaining = Math.max(minMs, remainingMs - reserveMs - moveOverheadMs);
  const byMoveShare = Math.floor(remainingMs / movesToGo);
  const byIncrement = Math.floor(incrementMs * incrementFraction);
  const maxByFraction = Math.max(minMs, Math.floor(remainingMs * pressureMaxFraction));
  const rawBudget = Math.min(safeRemaining, maxByFraction, Math.max(minMs, byMoveShare + byIncrement));
  const budget = Math.max(minMs, rawBudget - moveOverheadMs);

  return {
    source: "clock",
    timeLimitMs: clampTime(budget, options, defaults),
    remainingMs,
    incrementMs,
    movesToGo,
    estimatedMovesToGo: moveEstimate.estimated,
    phase: moveEstimate.phase,
    clockPressure: pressure,
    reserveMs,
    moveOverheadMs,
    byMoveShare,
    byIncrement,
    maxByFraction,
    safeRemaining
  };
}

export function hasClockTimeControl(options = {}) {
  return [
    "wtime",
    "btime",
    "redTimeMs",
    "blackTimeMs",
    "redTime",
    "blackTime"
  ].some((key) => numberOption(options[key]) !== null);
}

function sideTimeOption(options, side) {
  return side === SIDES.RED
    ? numberOption(options.redTimeMs, options.redTime, options.wtime)
    : numberOption(options.blackTimeMs, options.blackTime, options.btime);
}

function sideIncrementOption(options, side) {
  return side === SIDES.RED
    ? numberOption(options.redIncrementMs, options.redIncrement, options.winc)
    : numberOption(options.blackIncrementMs, options.blackIncrement, options.binc);
}

function clampTime(value, options, defaults) {
  const min = Math.max(1, numberOption(options.minTimeMs, defaults.minTimeMs, DEFAULT_MIN_MS));
  const max = numberOption(options.maxTimeMs, defaults.maxTimeMs);
  const finite = Math.max(min, Math.floor(value));
  return max === null ? finite : Math.min(finite, Math.max(min, Math.floor(max)));
}

function resolveMovesToGo(options, defaults, position) {
  const explicit = numberOption(options.movestogo, options.movesToGo);
  if (explicit !== null) {
    return {
      movesToGo: Math.max(1, Math.floor(explicit)),
      estimated: false,
      phase: "explicit"
    };
  }

  const override = numberOption(options.estimatedMovesToGo, defaults.estimatedMovesToGo);
  if (override !== null) {
    return {
      movesToGo: Math.max(1, Math.floor(override)),
      estimated: true,
      phase: "override"
    };
  }

  const phase = estimatePhase(position, options, defaults);
  const movesToGo = Math.max(1, Math.floor(numberOption(
    phase === "opening" ? options.openingMovesToGo : null,
    phase === "opening" ? defaults.openingMovesToGo : null,
    phase === "middlegame" ? options.middleMovesToGo : null,
    phase === "middlegame" ? defaults.middleMovesToGo : null,
    phase === "endgame" ? options.endgameMovesToGo : null,
    phase === "endgame" ? defaults.endgameMovesToGo : null,
    phase === "opening" ? 36 : null,
    phase === "middlegame" ? 28 : null,
    phase === "endgame" ? 18 : null,
    DEFAULT_MOVES_TO_GO
  )));

  return {
    movesToGo,
    estimated: phase !== "unknown",
    phase
  };
}

function estimatePhase(position, options, defaults) {
  const explicit = options.phase ?? defaults.phase;
  if (explicit) return String(explicit).toLowerCase();

  const pieceCount = position?.board
    ? position.board.reduce((count, piece) => count + (piece ? 1 : 0), 0)
    : numberOption(options.pieceCount, defaults.pieceCount);
  const fullmove = numberOption(position?.fullmove, options.fullmove, defaults.fullmove);

  if (pieceCount !== null && pieceCount <= 12) return "endgame";
  if (fullmove !== null && fullmove <= 12) return "opening";
  if (pieceCount !== null && pieceCount <= 20) return "endgame";
  if (fullmove !== null && fullmove >= 45) return "endgame";
  if (position || fullmove !== null || pieceCount !== null) return "middlegame";
  return "unknown";
}

function clockPressure(remainingMs, options, defaults) {
  const lowThreshold = numberOption(options.lowTimeThresholdMs, defaults.lowTimeThresholdMs, DEFAULT_LOW_TIME_THRESHOLD_MS);
  const criticalThreshold = numberOption(options.criticalTimeThresholdMs, defaults.criticalTimeThresholdMs, DEFAULT_CRITICAL_TIME_THRESHOLD_MS);

  if (remainingMs <= criticalThreshold) return "critical";
  if (remainingMs <= lowThreshold) return "low";
  return "normal";
}

function maxFractionForPressure(maxFraction, pressure, options, defaults) {
  if (pressure === "critical") {
    return Math.min(maxFraction, numberOption(options.criticalTimeMaxFraction, defaults.criticalTimeMaxFraction, DEFAULT_CRITICAL_TIME_MAX_FRACTION));
  }
  if (pressure === "low") {
    return Math.min(maxFraction, numberOption(options.lowTimeMaxFraction, defaults.lowTimeMaxFraction, DEFAULT_LOW_TIME_MAX_FRACTION));
  }
  return maxFraction;
}

function numberOption(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}
