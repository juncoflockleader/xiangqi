import { SIDES } from "./constants.js";

const DEFAULT_TIME_LIMIT_MS = 2000;
const DEFAULT_MOVES_TO_GO = 30;
const DEFAULT_INCREMENT_FRACTION = 0.75;
const DEFAULT_MAX_FRACTION = 0.3;
const DEFAULT_RESERVE_MS = 100;
const DEFAULT_MIN_MS = 50;

export function resolveSearchBudget(options = {}, side = SIDES.RED, defaults = {}) {
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
      movesToGo: null
    };
  }

  const remainingMs = sideTimeOption(options, side);
  if (remainingMs === null) {
    return {
      source: "default",
      timeLimitMs: clampTime(fallbackTimeLimitMs, options, defaults),
      remainingMs: null,
      incrementMs: 0,
      movesToGo: null
    };
  }

  const incrementMs = sideIncrementOption(options, side) ?? 0;
  const movesToGo = Math.max(1, Math.floor(numberOption(options.movestogo, options.movesToGo, DEFAULT_MOVES_TO_GO)));
  const reserveMs = Math.max(0, numberOption(options.reserveMs, defaults.reserveMs, DEFAULT_RESERVE_MS));
  const maxFraction = numberOption(options.maxTimeFraction, defaults.maxTimeFraction, DEFAULT_MAX_FRACTION);
  const incrementFraction = numberOption(options.incrementFraction, defaults.incrementFraction, DEFAULT_INCREMENT_FRACTION);
  const minMs = Math.max(1, numberOption(options.minTimeMs, defaults.minTimeMs, DEFAULT_MIN_MS));
  const safeRemaining = Math.max(minMs, remainingMs - reserveMs);
  const byMoveShare = Math.floor(remainingMs / movesToGo);
  const byIncrement = Math.floor(incrementMs * incrementFraction);
  const maxByFraction = Math.max(minMs, Math.floor(remainingMs * maxFraction));
  const budget = Math.min(safeRemaining, maxByFraction, Math.max(minMs, byMoveShare + byIncrement));

  return {
    source: "clock",
    timeLimitMs: clampTime(budget, options, defaults),
    remainingMs,
    incrementMs,
    movesToGo
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

function numberOption(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}
