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

export function listEngineProfiles() {
  return Object.values(ENGINE_PROFILES).map((profile) => ({
    id: profile.id,
    name: profile.name,
    kind: profile.kind,
    description: profile.description,
    options: { ...profile.options }
  }));
}

export function resolveEngineOptions(options = {}) {
  const profile = resolveEngineProfile(options.profile ?? options.engineProfile);
  const {
    profile: _profile,
    engineProfile: _engineProfile,
    ...overrides
  } = options;

  return {
    ...(profile?.options ?? {}),
    ...overrides,
    profile: profile?.id ?? options.profile ?? options.engineProfile
  };
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

function freezeProfile(profile) {
  return Object.freeze({
    id: profile.id,
    name: profile.name,
    kind: profile.kind,
    description: profile.description,
    options: Object.freeze({ ...(profile.options ?? {}) })
  });
}
