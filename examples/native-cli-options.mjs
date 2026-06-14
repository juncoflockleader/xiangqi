export function splitEnvArgs(value) {
  return value?.trim() ? value.trim().split(/\s+/) : [];
}

export function parseNativeEngineOptions(value, source) {
  if (!value?.trim()) return [];
  const text = value.trim();

  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      return jsonEngineOptions(JSON.parse(text), source);
    } catch (error) {
      throw new Error(`${source} must be JSON engine options or comma-separated name=value entries: ${error.message}`);
    }
  }

  return text
    .split(/[,\n;]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => parseNativeEngineOption(entry, source));
}

export function parseNativeEngineOption(text, source) {
  if (!text) throw new Error(`${source} requires an option name.`);
  const separatorIndex = text.indexOf("=");
  const name = separatorIndex === -1 ? text : text.slice(0, separatorIndex);
  const value = separatorIndex === -1 ? null : parseNativeEngineOptionValue(text.slice(separatorIndex + 1));
  return { name: assertEngineOptionName(name, source), value };
}

export function formatNativeOptions(options) {
  return options.map((option) => {
    if (option.value === null) return option.name;
    return `${option.name}=${formatNativeOptionValue(option.value)}`;
  }).join(", ");
}

function jsonEngineOptions(value, source) {
  if (Array.isArray(value)) {
    return value.map((entry, index) => normalizeJsonEngineOption(entry, `${source}[${index}]`));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).map(([name, optionValue]) => ({ name, value: optionValue }));
  }

  throw new Error(`${source} must be an object or array.`);
}

function normalizeJsonEngineOption(entry, source) {
  if (typeof entry === "string") return { name: entry, value: null };
  if (Array.isArray(entry)) {
    const [name, value = null] = entry;
    return { name: assertEngineOptionName(name, source), value };
  }
  if (entry && typeof entry === "object") {
    return {
      name: assertEngineOptionName(entry.name ?? entry.key ?? entry.option, source),
      value: Object.prototype.hasOwnProperty.call(entry, "value") ? entry.value : null
    };
  }

  throw new Error(`${source} must be a string, [name, value], or { name, value } entry.`);
}

function assertEngineOptionName(name, source) {
  if (typeof name !== "string" && typeof name !== "number") {
    throw new Error(`${source} requires an option name.`);
  }

  const normalized = String(name).trim();
  if (!normalized) throw new Error(`${source} requires an option name.`);
  return normalized;
}

function parseNativeEngineOptionValue(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase() === "true";
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function formatNativeOptionValue(value) {
  if (Array.isArray(value)) return value.join(" ");
  return String(value);
}
