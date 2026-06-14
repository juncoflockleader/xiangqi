import { ENGINE_BACKEND_FEATURES, createJavaScriptEngineBackend } from "./backend.js";
import { createUcciEngineBackend } from "./ucci-backend.js";

const NATIVE_BACKEND_KINDS = new Set(["native", "native-ucci", "native-uci", "ucci", "uci"]);
const NATIVE_PROFILES = new Set(["native-ucci", "native-uci"]);

const ROUTING_KEYS = new Set([
  "backend",
  "backendKind",
  "fallback",
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
    return createUcciEngineBackend(config.options);
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
      options: nativeOptions
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
