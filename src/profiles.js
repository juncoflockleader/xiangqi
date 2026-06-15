export const ENGINE_PROFILES = Object.freeze({
  fast: freezeProfile({
    id: "fast",
    name: "Fast Play",
    kind: "javascript",
    description: "Quick local replies for UI responsiveness and low-power devices.",
    options: {
      depth: 2,
      timeLimitMs: 500,
      maxTranspositionEntries: 20_000
    }
  }),
  balanced: freezeProfile({
    id: "balanced",
    name: "Balanced Play",
    kind: "javascript",
    description: "Default learning-app play strength for interactive sessions.",
    options: {
      depth: 4,
      timeLimitMs: 1500,
      maxTranspositionEntries: 50_000
    }
  }),
  analysis: freezeProfile({
    id: "analysis",
    name: "JavaScript Analysis",
    kind: "javascript",
    description: "Deeper local analysis with more principal variation candidates.",
    options: {
      depth: 5,
      timeLimitMs: 3000,
      lines: 5,
      maxTranspositionEntries: 150_000
    }
  }),
  "native-ucci": freezeProfile({
    id: "native-ucci",
    name: "Native UCCI Analysis",
    kind: "native-ucci",
    description: "External UCCI engine profile for stronger play and review.",
    options: {
      protocol: "ucci",
      depth: 8,
      timeLimitMs: 3000,
      lines: 3
    }
  }),
  "native-uci": freezeProfile({
    id: "native-uci",
    name: "Native UCI Analysis",
    kind: "native-uci",
    description: "External UCI engine profile for engines such as Pikafish.",
    options: {
      protocol: "uci",
      depth: 10,
      timeLimitMs: 5000,
      lines: 3
    }
  })
});

export const ENGINE_PLAY_LEVELS = Object.freeze({
  beginner: freezePlayLevel({
    id: "beginner",
    name: "Beginner Learner",
    description: "Small search budget and low native Elo target for first practice games.",
    options: {
      depth: 1,
      timeLimitMs: 250,
      lines: 1,
      maxTranspositionEntries: 10_000,
      engineOptions: {
        UCI_LimitStrength: true,
        UCI_Elo: 1200
      }
    }
  }),
  casual: freezePlayLevel({
    id: "casual",
    name: "Casual Learner",
    description: "Responsive play that still catches simple tactics.",
    options: {
      depth: 2,
      timeLimitMs: 500,
      lines: 2,
      maxTranspositionEntries: 20_000,
      engineOptions: {
        UCI_LimitStrength: true,
        UCI_Elo: 1600
      }
    }
  }),
  club: freezePlayLevel({
    id: "club",
    name: "Club Learner",
    description: "Balanced practice strength for players who want real resistance.",
    options: {
      depth: 4,
      timeLimitMs: 1500,
      lines: 3,
      maxTranspositionEntries: 50_000,
      engineOptions: {
        UCI_LimitStrength: true,
        UCI_Elo: 2000
      }
    }
  }),
  expert: freezePlayLevel({
    id: "expert",
    name: "Expert Learner",
    description: "Stronger play with more candidate evidence for serious review.",
    options: {
      depth: 6,
      timeLimitMs: 2500,
      lines: 3,
      maxTranspositionEntries: 100_000,
      engineOptions: {
        UCI_LimitStrength: true,
        UCI_Elo: 2400
      }
    }
  }),
  master: freezePlayLevel({
    id: "master",
    name: "Master Analysis",
    description: "Full-strength native play or deeper JavaScript analysis for hard positions.",
    options: {
      depth: 10,
      timeLimitMs: 5000,
      lines: 4,
      maxTranspositionEntries: 150_000,
      engineOptions: {
        UCI_LimitStrength: false
      }
    }
  })
});

export function listEngineProfiles() {
  return Object.values(ENGINE_PROFILES).map((profile) => ({
    id: profile.id,
    name: profile.name,
    kind: profile.kind,
    description: profile.description,
    options: { ...profile.options }
  }));
}

export function listEnginePlayLevels() {
  return Object.values(ENGINE_PLAY_LEVELS).map((level) => ({
    id: level.id,
    name: level.name,
    description: level.description,
    options: copyOptions(level.options)
  }));
}

export function resolveEngineOptions(options = {}) {
  const profile = resolveEngineProfile(options.profile ?? options.engineProfile);
  const playLevel = resolveEnginePlayLevel(options.playLevel ?? options.skillLevel ?? options.difficulty);
  const profileOptions = profile?.options ?? {};
  const playLevelOptions = playLevel?.options ?? {};
  const {
    profile: _profile,
    engineProfile: _engineProfile,
    playLevel: _playLevel,
    skillLevel: _skillLevel,
    difficulty: _difficulty,
    engineOptions,
    ...overrides
  } = options;
  const mergedEngineOptions = mergeEngineOptionGroups(
    profileOptions.engineOptions,
    playLevelOptions.engineOptions,
    engineOptions
  );

  const resolved = {
    ...withoutEngineOptions(profileOptions),
    ...withoutEngineOptions(playLevelOptions),
    ...overrides,
    profile: profile?.id ?? options.profile ?? options.engineProfile
  };

  if (playLevel || options.playLevel || options.skillLevel || options.difficulty) {
    resolved.playLevel = playLevel?.id ?? options.playLevel ?? options.skillLevel ?? options.difficulty;
  }
  if (mergedEngineOptions.length > 0) {
    resolved.engineOptions = mergedEngineOptions;
  }

  return resolved;
}

export function resolveEngineProfile(profile) {
  if (!profile) return null;
  if (typeof profile === "string") {
    return ENGINE_PROFILES[profile] ?? null;
  }
  if (typeof profile === "object") {
    const {
      id,
      name,
      kind,
      description,
      options,
      ...directOptions
    } = profile;
    return freezeProfile({
      id: id ?? "custom",
      name: name ?? "Custom Profile",
      kind: kind ?? "custom",
      description: description ?? "",
      options: options ?? directOptions
    });
  }
  return null;
}

export function resolveEnginePlayLevel(level) {
  if (!level) return null;
  if (typeof level === "string") {
    return ENGINE_PLAY_LEVELS[normalizeId(level)] ?? null;
  }
  if (typeof level === "object") {
    const {
      id,
      name,
      description,
      options,
      ...directOptions
    } = level;
    return freezePlayLevel({
      id: id ?? "custom",
      name: name ?? "Custom Level",
      description: description ?? "",
      options: options ?? directOptions
    });
  }
  return null;
}

function freezeProfile(profile) {
  return Object.freeze({
    id: profile.id,
    name: profile.name,
    kind: profile.kind,
    description: profile.description,
    options: Object.freeze({ ...(profile.options ?? {}) })
  });
}

function freezePlayLevel(level) {
  return Object.freeze({
    id: level.id,
    name: level.name,
    description: level.description,
    options: freezeOptions(level.options ?? {})
  });
}

function freezeOptions(options) {
  const copy = copyOptions(options);
  if (copy.engineOptions) {
    copy.engineOptions = Object.freeze(copy.engineOptions.map((option) => Object.freeze(option)));
  }
  return Object.freeze(copy);
}

function copyOptions(options) {
  return {
    ...options,
    ...(options.engineOptions ? { engineOptions: copyEngineOptions(options.engineOptions) } : {})
  };
}

function withoutEngineOptions(options) {
  const { engineOptions: _engineOptions, ...rest } = options ?? {};
  return rest;
}

function mergeEngineOptionGroups(...groups) {
  const merged = [];
  const indexByName = new Map();

  for (const group of groups) {
    for (const option of copyEngineOptions(group)) {
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

function copyEngineOptions(group) {
  if (!group) return [];

  if (Array.isArray(group)) {
    return group.map((entry) => normalizeEngineOption(entry));
  }

  if (typeof group === "object") {
    return Object.entries(group).map(([name, value]) => normalizeEngineOption({ name, value }));
  }

  throw new Error("Engine options must be an object or array.");
}

function normalizeEngineOption(entry) {
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

  throw new Error("Engine option entries must be strings, arrays, or objects.");
}

function normalizeOptionName(name) {
  if (typeof name !== "string" && typeof name !== "number") {
    throw new Error("Engine option requires a name.");
  }

  const normalized = String(name).trim();
  if (!normalized) throw new Error("Engine option requires a name.");
  return normalized;
}

function normalizeId(value) {
  return String(value).trim().toLowerCase();
}
