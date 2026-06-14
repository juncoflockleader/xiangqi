import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve as resolvePath } from "node:path";

const DEFAULT_PIKAFISH_INSTALL_ROOT = ".engines/pikafish";

const PRESETS = Object.freeze({
  pikafish: Object.freeze({
    id: "pikafish",
    name: "Pikafish",
    protocol: "uci",
    description: "Preset defaults for Pikafish-compatible UCI Xiangqi engines.",
    engineOptions: Object.freeze([
      Object.freeze({ name: "UCI_ShowWDL", value: true })
    ])
  })
});

export function listNativeEnginePresets() {
  return Object.values(PRESETS).map((preset) => ({
    id: preset.id,
    name: preset.name,
    protocol: preset.protocol,
    description: preset.description,
    engineOptions: preset.engineOptions.map((option) => ({ ...option }))
  }));
}

export function resolveNativeEnginePreset(name, options = {}) {
  if (!name) return null;

  const preset = PRESETS[normalizePresetId(name)];
  if (!preset) {
    const known = Object.keys(PRESETS).join(", ");
    throw new Error(`Unknown native engine preset: ${name}. Known presets: ${known}.`);
  }

  if (preset.id === "pikafish") return resolvePikafishPreset(preset, options);
  return resolveGenericPreset(preset, options);
}

export function mergeNativeEngineOptions(...groups) {
  const merged = [];
  const indexByName = new Map();

  for (const group of groups) {
    for (const option of normalizeNativeEngineOptions(group)) {
      const key = option.name.toLowerCase();
      if (indexByName.has(key)) {
        merged[indexByName.get(key)] = option;
      } else {
        indexByName.set(key, merged.length);
        merged.push(option);
      }
    }
  }

  return merged;
}

function resolvePikafishPreset(preset, options) {
  const env = options.env ?? defaultEnv();
  const explicitCommand = firstText(
    options.command,
    env.XIANGQI_PIKAFISH_COMMAND,
    env.PIKAFISH_COMMAND,
    env.XIANGQI_ENGINE_COMMAND
  );
  const configuredHome = firstText(
    options.home,
    options.engineHome,
    env.XIANGQI_PIKAFISH_HOME,
    env.PIKAFISH_HOME
  );
  const home = firstText(
    configuredHome,
    explicitCommand ? null : discoverPikafishHome(options, env)
  );
  const command = firstText(
    options.command,
    env.XIANGQI_PIKAFISH_COMMAND,
    env.PIKAFISH_COMMAND,
    home ? inferPikafishCommand(home, options) : null,
    env.XIANGQI_ENGINE_COMMAND
  );
  const evalFile = firstText(
    options.evalFile,
    options.nnue,
    env.XIANGQI_PIKAFISH_EVAL_FILE,
    env.PIKAFISH_EVAL_FILE,
    home ? joinPath(home, "pikafish.nnue") : null,
    env.XIANGQI_ENGINE_EVAL_FILE
  );
  const evalOption = evalFile ? [{ name: "EvalFile", value: evalFile }] : [];

  return {
    preset: preset.id,
    name: preset.name,
    description: preset.description,
    protocol: options.protocol ?? preset.protocol,
    command,
    args: normalizeArgs(options.args),
    cwd: options.cwd ?? home ?? undefined,
    engineOptions: mergeNativeEngineOptions(
      preset.engineOptions,
      evalOption,
      options.engineOptions
    )
  };
}

function discoverPikafishHome(options, env) {
  if (!shouldDiscoverPikafish(options, env)) return undefined;

  const installRoot = firstText(
    options.installRoot,
    options.pikafishInstallRoot,
    env.XIANGQI_PIKAFISH_INSTALL_DIR,
    DEFAULT_PIKAFISH_INSTALL_ROOT
  );
  const root = resolvePath(options.baseDir ?? defaultCwd(), installRoot);
  const direct = pikafishInstallCandidate(root, options);
  if (direct) return direct.home;

  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return undefined;
  }

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => pikafishInstallCandidate(joinPath(root, entry.name), options, entry.name))
    .filter(Boolean)
    .sort(comparePikafishInstallCandidates)[0]?.home;
}

function shouldDiscoverPikafish(options, env) {
  if (options.discover === false || options.autoDiscover === false) return false;
  return !isFalseLike(env.XIANGQI_PIKAFISH_AUTO_DISCOVER);
}

function pikafishInstallCandidate(home, options, name = "") {
  const command = inferPikafishCommand(home, options);
  if (!existsSync(command)) return null;
  const stat = safeStat(command) ?? safeStat(home);
  return {
    home,
    name,
    mtimeMs: stat?.mtimeMs ?? 0
  };
}

function comparePikafishInstallCandidates(a, b) {
  if (b.mtimeMs !== a.mtimeMs) return b.mtimeMs - a.mtimeMs;
  return b.name.localeCompare(a.name);
}

function safeStat(path) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

function resolveGenericPreset(preset, options) {
  return {
    preset: preset.id,
    name: preset.name,
    description: preset.description,
    protocol: options.protocol ?? preset.protocol,
    command: options.command,
    args: normalizeArgs(options.args),
    cwd: options.cwd,
    engineOptions: mergeNativeEngineOptions(preset.engineOptions, options.engineOptions)
  };
}

function normalizeNativeEngineOptions(group) {
  if (!group) return [];

  if (Array.isArray(group)) {
    return group.map((entry) => normalizeNativeEngineOption(entry));
  }

  if (typeof group === "object") {
    return Object.entries(group).map(([name, value]) => normalizeNativeEngineOption({ name, value }));
  }

  throw new Error("Native engine options must be an object or array.");
}

function normalizeNativeEngineOption(entry) {
  if (Array.isArray(entry)) {
    const [name, value = null] = entry;
    return { name: normalizeOptionName(name), value };
  }

  if (entry && typeof entry === "object") {
    const name = entry.name ?? entry.key ?? entry.option;
    return {
      name: normalizeOptionName(name),
      value: Object.prototype.hasOwnProperty.call(entry, "value") ? entry.value : null
    };
  }

  if (typeof entry === "string" || typeof entry === "number") {
    return { name: normalizeOptionName(entry), value: null };
  }

  throw new Error("Native engine option entries must be strings, arrays, or objects.");
}

function normalizeOptionName(name) {
  if (typeof name !== "string" && typeof name !== "number") {
    throw new Error("Native engine option requires a name.");
  }

  const normalized = String(name).trim();
  if (!normalized) throw new Error("Native engine option requires a name.");
  return normalized;
}

function normalizePresetId(value) {
  return String(value).trim().toLowerCase();
}

function normalizeArgs(args) {
  return Array.isArray(args) ? [...args] : [];
}

function firstText(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function defaultEnv() {
  return typeof process !== "undefined" && process.env ? process.env : {};
}

function defaultCwd() {
  return typeof process !== "undefined" && typeof process.cwd === "function"
    ? process.cwd()
    : ".";
}

function isFalseLike(value) {
  return ["0", "false", "no", "off"].includes(String(value ?? "").trim().toLowerCase());
}

function inferPikafishCommand(home, options) {
  const platform = options.platform ?? defaultPlatform();
  const arch = options.arch ?? defaultArch();

  if (platform === "darwin" && arch === "arm64") {
    return joinPath(home, "MacOS", "pikafish-apple-silicon");
  }
  if (platform === "darwin") {
    return joinPath(home, "MacOS", "pikafish");
  }
  if (platform === "win32") {
    return joinPath(home, "Windows", "pikafish.exe");
  }
  return joinPath(home, "pikafish");
}

function defaultPlatform() {
  return typeof process !== "undefined" ? process.platform : "";
}

function defaultArch() {
  return typeof process !== "undefined" ? process.arch : "";
}

function joinPath(...parts) {
  const [first, ...rest] = parts;
  return [
    String(first).replace(/\/+$/u, ""),
    ...rest.map((part) => String(part).replace(/^\/+|\/+$/gu, ""))
  ].filter(Boolean).join("/");
}
