import { ENGINE_BACKEND_FEATURES, createEngineBackend, createJavaScriptEngineBackend } from "./backend.js";
import { createUcciEngineBackend } from "./ucci-backend.js";

const NATIVE_BACKEND_KINDS = new Set(["native", "native-ucci", "native-uci", "ucci", "uci"]);
const NATIVE_PROFILES = new Set(["native-ucci", "native-uci"]);

const ROUTING_KEYS = new Set([
  "backend",
  "backendKind",
  "fallback",
  "fallbackOnNativeError",
  "fallbackProfile",
  "javascript",
  "javascriptProfile",
  "kind",
  "native",
  "nativeProfile",
  "preferNative"
]);

const NATIVE_ONLY_KEYS = new Set([
  "args",
  "closeTimeoutMs",
  "command",
  "commandTimeoutMs",
  "cwd",
  "engineOptions",
  "env",
  "protocol",
  "referenceEngine",
  "referenceOptions",
  "shell",
  "startupTimeoutMs"
]);

export function createLearningEngineBackend(options = {}) {
  if (isEngineBackend(options.backend)) return options.backend;

  const config = resolveLearningEngineBackendConfig(options);
  if (config.kind === "native") {
    const nativeBackend = createUcciEngineBackend(config.options);
    if (config.fallbackOnNativeError === false) return nativeBackend;

    return createFallbackEngineBackend(
      nativeBackend,
      createJavaScriptEngineBackend(config.fallbackOptions),
      config
    );
  }

  return createJavaScriptEngineBackend(config.options);
}

export function resolveLearningEngineBackendConfig(options = {}) {
  const backendKind = normalizeBackendKind(options.kind ?? options.backendKind);
  const nativeDisabled = options.native === false || options.preferNative === false;
  const nativeOptions = nativeDisabled
    ? null
    : normalizeNativeOptions(options, backendKind);
  const hasNativeCommand = Boolean(nativeOptions?.command);
  const explicitlyNative = isNativeKind(backendKind);

  if (hasNativeCommand) {
    return {
      kind: "native",
      reason: "native-command",
      options: nativeOptions,
      fallbackOptions: normalizeJavaScriptOptions(options),
      fallbackOnNativeError: options.fallbackOnNativeError ?? true
    };
  }

  if (explicitlyNative) {
    throw new Error("Learning engine native backend requires a command.");
  }

  return {
    kind: "javascript",
    reason: nativeDisabled ? "native-disabled" : "javascript-fallback",
    options: normalizeJavaScriptOptions(options)
  };
}

export function isNativeEngineBackend(backend) {
  return Boolean(
    backend?.supports?.(ENGINE_BACKEND_FEATURES.NATIVE_READY)
      || isNativeKind(backend?.kind)
  );
}

export function createFallbackEngineBackend(primaryBackend, fallbackBackend, options = {}) {
  if (!isEngineBackend(primaryBackend)) {
    throw new Error("Primary engine backend must satisfy the engine backend contract.");
  }
  if (!isEngineBackend(fallbackBackend)) {
    throw new Error("Fallback engine backend must satisfy the engine backend contract.");
  }

  const state = {
    error: null,
    failedAt: null
  };

  const backend = createEngineBackend({
    id: options.id ?? `${primaryBackend.id}-with-${fallbackBackend.id}-fallback`,
    name: options.name ?? `${primaryBackend.name} with ${fallbackBackend.name} Fallback`,
    kind: options.kindName ?? "hybrid",
    description: options.description ?? `Prefers ${primaryBackend.name}; falls back to ${fallbackBackend.name} if native search is unavailable.`,
    features: unique([
      ...(primaryBackend.features ?? []),
      ...(fallbackBackend.features ?? []),
      ENGINE_BACKEND_FEATURES.FALLBACK,
      ENGINE_BACKEND_FEATURES.ASYNC_SEARCH
    ]),
    chooseMove: (...args) => searchWithFallback("chooseMove", args),
    analyzePosition: (...args) => searchWithFallback("analyzePosition", args),
    reviewMove: (...args) => searchWithFallback("reviewMove", args),
    reviewGame: (...args) => searchWithFallback("reviewGame", args),
    coachMove: (...args) => searchWithFallback("coachMove", args),
    studyPosition: (...args) => searchWithFallback("studyPosition", args),
    lessonPlan: (...args) => searchWithFallback("lessonPlan", args),
    gameStudy: (...args) => searchWithFallback("gameStudy", args),
    openingBook: (...args) => auxiliaryWithFallback("openingBook", args),
    evaluate: (...args) => auxiliaryWithFallback("evaluate", args),
    pressure: (...args) => auxiliaryWithFallback("pressure", args),
    play: (...args) => auxiliaryWithFallback("play", args),
    legalMoves: (...args) => auxiliaryWithFallback("legalMoves", args),
    resetCache: () => {
      primaryBackend.resetCache?.();
      fallbackBackend.resetCache?.();
    },
    ready: async () => {
      try {
        state.error = null;
        state.failedAt = null;
        return await primaryBackend.ready?.();
      } catch (error) {
        rememberNativeFailure(error);
        return null;
      }
    },
    close: async () => {
      await primaryBackend.close?.();
      await fallbackBackend.close?.();
    },
    get primaryBackend() {
      return primaryBackend;
    },
    get fallbackBackend() {
      return fallbackBackend;
    },
    get nativeOptions() {
      return Array.isArray(primaryBackend.nativeOptions)
        ? primaryBackend.nativeOptions.map((option) => ({ ...option }))
        : [];
    },
    get fallbackActive() {
      return Boolean(state.error);
    },
    get fallbackReason() {
      return state.error ? fallbackReason(state.error, primaryBackend, fallbackBackend) : null;
    },
    get cacheSize() {
      return typeof fallbackBackend.cacheSize === "number" ? fallbackBackend.cacheSize : null;
    },
    get cacheCapacity() {
      return typeof fallbackBackend.cacheCapacity === "number" ? fallbackBackend.cacheCapacity : null;
    }
  });

  return backend;

  async function searchWithFallback(method, args) {
    if (!state.error) {
      try {
        return await primaryBackend[method](...args);
      } catch (error) {
        rememberNativeFailure(error);
      }
    }

    const result = await fallbackBackend[method](...args);
    return annotateFallbackResult(result, method, state.error, primaryBackend, fallbackBackend);
  }

  function auxiliaryWithFallback(method, args) {
    const activeBackend = state.error ? fallbackBackend : primaryBackend;
    try {
      return activeBackend[method](...args);
    } catch (error) {
      rememberNativeFailure(error);
      return fallbackBackend[method](...args);
    }
  }

  function rememberNativeFailure(error) {
    state.error = error;
    state.failedAt = new Date().toISOString();
  }
}

function normalizeNativeOptions(options, backendKind) {
  const native = typeof options.native === "object" && options.native !== null
    ? options.native
    : {};
  const shared = stripRoutingOptions(options, { omitNativeOnly: false });
  const directNativeProfile = isNativeProfile(options.profile) ? options.profile : undefined;
  const nativeProfile = options.nativeProfile
    ?? native.profile
    ?? directNativeProfile
    ?? inferNativeProfile(options.protocol ?? native.protocol, backendKind);

  return {
    ...shared,
    ...native,
    profile: nativeProfile,
    protocol: native.protocol ?? options.protocol ?? inferNativeProtocol(nativeProfile, backendKind),
    command: native.command ?? options.command,
    args: native.args ?? options.args
  };
}

function normalizeJavaScriptOptions(options) {
  const javascript = typeof options.javascript === "object" && options.javascript !== null
    ? options.javascript
    : {};
  const fallback = typeof options.fallback === "object" && options.fallback !== null
    ? options.fallback
    : {};
  const shared = stripRoutingOptions(options, { omitNativeOnly: true });
  const profile = options.javascriptProfile
    ?? options.fallbackProfile
    ?? javascript.profile
    ?? fallback.profile
    ?? (isNativeProfile(shared.profile) ? undefined : shared.profile)
    ?? "balanced";

  return {
    ...shared,
    ...fallback,
    ...javascript,
    profile
  };
}

function stripRoutingOptions(options, { omitNativeOnly }) {
  const stripped = {};
  for (const [key, value] of Object.entries(options)) {
    if (ROUTING_KEYS.has(key)) continue;
    if (omitNativeOnly && NATIVE_ONLY_KEYS.has(key)) continue;
    stripped[key] = value;
  }
  return stripped;
}

function inferNativeProfile(protocol, backendKind) {
  if (backendKind === "native-uci" || backendKind === "uci") return "native-uci";
  if (backendKind === "native-ucci" || backendKind === "ucci") return "native-ucci";
  return inferNativeProtocol(null, backendKind) === "uci" || String(protocol ?? "").toLowerCase() === "uci"
    ? "native-uci"
    : "native-ucci";
}

function inferNativeProtocol(profile, backendKind) {
  if (backendKind === "native-uci" || backendKind === "uci") return "uci";
  if (backendKind === "native-ucci" || backendKind === "ucci") return "ucci";
  return profile === "native-uci" ? "uci" : "ucci";
}

function normalizeBackendKind(kind) {
  return String(kind ?? "").toLowerCase();
}

function isNativeKind(kind) {
  return NATIVE_BACKEND_KINDS.has(normalizeBackendKind(kind));
}

function isNativeProfile(profile) {
  return NATIVE_PROFILES.has(String(profile ?? "").toLowerCase());
}

function annotateFallbackResult(result, method, error, primaryBackend, fallbackBackend) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return result;

  const backendFallback = {
    method,
    primaryBackend: primaryBackend.id,
    primaryName: primaryBackend.name,
    fallbackBackend: fallbackBackend.id,
    fallbackName: fallbackBackend.name,
    message: errorMessage(error)
  };
  const reason = fallbackReason(error, primaryBackend, fallbackBackend);

  return {
    ...result,
    backendFallback,
    explanation: result.explanation
      ? {
          ...result.explanation,
          reasons: unique([reason, ...(result.explanation.reasons ?? [])]).slice(0, 7)
        }
      : result.explanation
  };
}

function fallbackReason(error, primaryBackend, fallbackBackend) {
  return `${primaryBackend.name} was unavailable (${errorMessage(error)}), so ${fallbackBackend.name} supplied this result.`;
}

function errorMessage(error) {
  return String(error?.message ?? error ?? "unknown error").split(/\r?\n/, 1)[0];
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function isEngineBackend(value) {
  return Boolean(
    value
      && typeof value === "object"
      && typeof value.chooseMove === "function"
      && typeof value.analyzePosition === "function"
      && typeof value.reviewMove === "function"
      && typeof value.openingBook === "function"
      && typeof value.play === "function"
      && typeof value.legalMoves === "function"
  );
}
