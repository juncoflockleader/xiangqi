import { createEngine } from "./engine.js";
import { resolveEngineOptions } from "./profiles.js";

export const ENGINE_BACKEND_FEATURES = Object.freeze({
  LOCAL_SEARCH: "local-search",
  EXPLANATION: "explanation",
  OPENING_BOOK: "opening-book",
  REVIEW: "review",
  PRESSURE: "pressure",
  UCCI_COMPATIBLE: "ucci-compatible",
  UCI_COMPATIBLE: "uci-compatible",
  NATIVE_READY: "native-ready",
  ASYNC_SEARCH: "async-search",
  FALLBACK: "fallback",
  ORACLE_REVIEW: "oracle-review"
});

const REQUIRED_BACKEND_METHODS = Object.freeze([
  "chooseMove",
  "analyzePosition",
  "reviewMove",
  "openingBook",
  "play",
  "legalMoves"
]);

export function createJavaScriptEngineBackend(options = {}) {
  const engineOptions = resolveEngineOptions(options);
  const engine = createEngine(engineOptions);

  return createEngineBackend({
    id: options.id ?? "javascript-reference",
    name: options.name ?? "JavaScript Reference Engine",
    kind: "javascript",
    description: "Dependency-free explainable engine used as the reference backend and learning layer.",
    settings: summarizeEngineSettings(engineOptions),
    features: [
      ENGINE_BACKEND_FEATURES.LOCAL_SEARCH,
      ENGINE_BACKEND_FEATURES.EXPLANATION,
      ENGINE_BACKEND_FEATURES.OPENING_BOOK,
      ENGINE_BACKEND_FEATURES.REVIEW,
      ENGINE_BACKEND_FEATURES.PRESSURE
    ],
    chooseMove: (position, searchOptions = {}) => engine.chooseMove(position, searchOptions),
    analyzePosition: (position, searchOptions = {}) => engine.analyzePosition(position, searchOptions),
    reviewMove: (position, move, reviewOptions = {}) => engine.reviewMove(position, move, reviewOptions),
    reviewGame: (moves, reviewOptions = {}) => engine.reviewGame(moves, reviewOptions),
    coachMove: (position, coachOptions = {}) => engine.coachMove(position, coachOptions),
    studyPosition: (position, studyOptions = {}) => engine.studyPosition(position, studyOptions),
    lessonPlan: (moves, lessonOptions = {}) => engine.lessonPlan(moves, lessonOptions),
    gameStudy: (moves, gameStudyOptions = {}) => engine.gameStudy(moves, gameStudyOptions),
    openingBook: (position, bookOptions = {}) => engine.openingBook(position, bookOptions),
    evaluate: (position, evaluationOptions = {}) => engine.evaluate(position, evaluationOptions),
    pressure: (position, pressureOptions = {}) => engine.pressure(position, pressureOptions),
    play: (position, notation) => engine.play(position, notation),
    legalMoves: (position) => engine.legalMoves(position),
    resetCache: () => engine.resetCache(),
    get cacheSize() {
      return engine.cacheSize;
    },
    get cacheCapacity() {
      return engine.cacheCapacity;
    }
  });
}

export function createEngineBackend(backend) {
  if (!backend || typeof backend !== "object") {
    throw new Error("Engine backend must be an object.");
  }

  for (const method of REQUIRED_BACKEND_METHODS) {
    if (typeof backend[method] !== "function") {
      throw new Error(`Engine backend is missing required method: ${method}`);
    }
  }

  const features = Object.freeze([...(backend.features ?? [])]);
  const normalized = {};
  Object.defineProperties(normalized, Object.getOwnPropertyDescriptors(backend));
  Object.defineProperty(normalized, "id", {
    value: backend.id ?? "custom-engine",
    enumerable: true
  });
  Object.defineProperty(normalized, "name", {
    value: backend.name ?? "Custom Engine",
    enumerable: true
  });
  Object.defineProperty(normalized, "kind", {
    value: backend.kind ?? "custom",
    enumerable: true
  });
  Object.defineProperty(normalized, "features", {
    value: features,
    enumerable: true
  });
  Object.defineProperty(normalized, "supports", {
    value(feature) {
      return features.includes(feature);
    },
    enumerable: true
  });

  return Object.freeze(normalized);
}

export function describeEngineBackend(backend) {
  return {
    id: backend.id,
    name: backend.name,
    kind: backend.kind,
    description: backend.description ?? "",
    features: [...(backend.features ?? [])],
    cacheSize: typeof backend.cacheSize === "number" ? backend.cacheSize : null,
    cacheCapacity: typeof backend.cacheCapacity === "number" ? backend.cacheCapacity : null,
    settings: summarizeEngineSettings(backend.settings),
    nativeOptions: Array.isArray(backend.nativeOptions)
      ? backend.nativeOptions.map((option) => ({ ...option }))
      : [],
    status: describeEngineBackendStatus(backend)
  };
}

export function describeEngineBackendStatus(backend) {
  const features = backend.features ?? [];
  const hasFallback = features.includes(ENGINE_BACKEND_FEATURES.FALLBACK);
  const fallbackActive = Boolean(backend.fallbackActive);

  return {
    state: fallbackActive ? "fallback" : "primary",
    native: Boolean(
      features.includes(ENGINE_BACKEND_FEATURES.NATIVE_READY)
        || backend.kind === "native-ucci"
        || backend.kind === "native-uci"
    ),
    async: Boolean(features.includes(ENGINE_BACKEND_FEATURES.ASYNC_SEARCH)),
    fallback: hasFallback,
    fallbackActive,
    fallbackReason: backend.fallbackReason ?? null,
    primaryBackend: summarizeBackend(backend.primaryBackend),
    fallbackBackend: summarizeBackend(backend.fallbackBackend)
  };
}

function summarizeBackend(backend) {
  if (!backend) return null;

  return {
    id: backend.id,
    name: backend.name,
    kind: backend.kind,
    settings: summarizeEngineSettings(backend.settings),
    features: [...(backend.features ?? [])]
  };
}

export function summarizeEngineSettings(settings = {}) {
  return {
    profile: textOrNull(settings.profile),
    playLevel: textOrNull(settings.playLevel),
    protocol: textOrNull(settings.protocol),
    depth: numberOrNull(settings.depth),
    timeLimitMs: numberOrNull(settings.timeLimitMs),
    lines: numberOrNull(settings.lines),
    maxTranspositionEntries: numberOrNull(settings.maxTranspositionEntries ?? settings.ttSize)
  };
}

function textOrNull(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberOrNull(value) {
  return Number.isFinite(value) ? value : null;
}
