import test from "node:test";
import assert from "node:assert/strict";
import {
  ENGINE_PROFILES,
  createEngine,
  createInitialPosition,
  listEngineProfiles,
  resolveEngineOptions
} from "../src/index.js";

test("engine profiles are listed with safe option copies", () => {
  const profiles = listEngineProfiles();
  const fast = profiles.find((profile) => profile.id === "fast");

  assert.ok(fast);
  assert.equal(fast.options.depth, ENGINE_PROFILES.fast.options.depth);
  fast.options.depth = 99;
  assert.equal(ENGINE_PROFILES.fast.options.depth, 2);
});

test("profile options can be resolved and explicitly overridden", () => {
  const options = resolveEngineOptions({
    profile: "analysis",
    depth: 3,
    timeLimitMs: 1200
  });

  assert.equal(options.profile, "analysis");
  assert.equal(options.depth, 3);
  assert.equal(options.timeLimitMs, 1200);
  assert.equal(options.lines, 5);
  assert.equal(options.maxTranspositionEntries, 150_000);
});

test("custom profile objects do not leak metadata into search options", () => {
  const options = resolveEngineOptions({
    profile: {
      id: "lesson-fast",
      name: "Lesson Fast",
      options: {
        depth: 2,
        timeLimitMs: 400
      }
    },
    maxTranspositionEntries: 321
  });

  assert.equal(options.profile, "lesson-fast");
  assert.equal(options.depth, 2);
  assert.equal(options.timeLimitMs, 400);
  assert.equal(options.name, undefined);
  assert.equal(options.maxTranspositionEntries, 321);
});

test("createEngine applies profile cache and search defaults", () => {
  const engine = createEngine({ profile: "fast" });
  const result = engine.chooseMove(createInitialPosition(), { useBook: false });

  assert.equal(engine.cacheCapacity, 20_000);
  assert.ok(result.bestMove);
  assert.ok(result.depth >= 1);
});
