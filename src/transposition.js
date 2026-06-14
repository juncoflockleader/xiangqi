const DEFAULT_MAX_ENTRIES = 50_000;
const DEFAULT_REPLACEMENT_SAMPLE = 64;

export function createTranspositionTable(options = {}) {
  const maxEntries = normalizePositiveInteger(options.maxEntries, DEFAULT_MAX_ENTRIES);
  const replacementSample = normalizePositiveInteger(options.replacementSample, DEFAULT_REPLACEMENT_SAMPLE);
  const entries = new Map();
  let generation = 0;

  return {
    get(key) {
      const entry = entries.get(key);
      if (entry) entry.generation = generation;
      return entry;
    },

    set(key, entry) {
      const stored = withGeneration(entry, generation);
      const existing = entries.get(key);

      if (existing) {
        if (!shouldReplace(existing, stored)) {
          existing.generation = generation;
          return { stored: false, replaced: false, evicted: false };
        }

        entries.delete(key);
        entries.set(key, stored);
        return { stored: true, replaced: true, evicted: false };
      }

      let evicted = false;
      if (entries.size >= maxEntries) {
        evicted = evictOne(entries, replacementSample);
      }

      entries.set(key, stored);
      return { stored: true, replaced: false, evicted };
    },

    clear() {
      entries.clear();
      generation = 0;
    },

    nextGeneration() {
      generation += 1;
      return generation;
    },

    get size() {
      return entries.size;
    },

    get maxEntries() {
      return maxEntries;
    },

    get generation() {
      return generation;
    }
  };
}

function shouldReplace(existing, incoming) {
  if (incoming.depth > existing.depth) return true;
  if (incoming.depth < existing.depth) return false;
  if (incoming.flag === "exact" && existing.flag !== "exact") return true;
  return incoming.generation >= existing.generation;
}

function evictOne(entries, sampleSize) {
  let victimKey = null;
  let victim = null;
  let seen = 0;

  for (const [key, entry] of entries) {
    if (!victim || isWorseReplacementCandidate(entry, victim)) {
      victimKey = key;
      victim = entry;
    }

    seen += 1;
    if (seen >= sampleSize) break;
  }

  if (victimKey === null) return false;
  entries.delete(victimKey);
  return true;
}

function isWorseReplacementCandidate(candidate, currentWorst) {
  if (candidate.generation !== currentWorst.generation) {
    return candidate.generation < currentWorst.generation;
  }
  if (candidate.depth !== currentWorst.depth) {
    return candidate.depth < currentWorst.depth;
  }
  return candidate.flag !== "exact" && currentWorst.flag === "exact";
}

function withGeneration(entry, generation) {
  return {
    ...entry,
    generation
  };
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}
