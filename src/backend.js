import { createEngine } from "./engine.js";

export const ENGINE_BACKEND_FEATURES = Object.freeze({
  LOCAL_SEARCH: "local-search",
  EXPLANATION: "explanation",
  OPENING_BOOK: "opening-book",
  REVIEW: "review",
  PRESSURE: "pressure",
  UCCI_COMPATIBLE: "ucci-compatible",
  NATIVE_READY: "native-ready",
  ASYNC_SEARCH: "async-search"
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
  const engine = createEngine(options);

  return createEngineBackend({
    id: options.id ?? "javascript-reference",
    name: options.name ?? "JavaScript Reference Engine",
    kind: "javascript",
    description: "Dependency-free explainable engine used as the reference backend and learning layer.",
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
    cacheCapacity: typeof backend.cacheCapacity === "number" ? backend.cacheCapacity : null
  };
}
