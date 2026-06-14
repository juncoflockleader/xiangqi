import test from "node:test";
import assert from "node:assert/strict";
import {
  listNativeEnginePresets,
  mergeNativeEngineOptions,
  resolveNativeEnginePreset
} from "../src/index.js";

test("lists the Pikafish native engine preset", () => {
  const presets = listNativeEnginePresets();
  const pikafish = presets.find((preset) => preset.id === "pikafish");

  assert.equal(pikafish.name, "Pikafish");
  assert.equal(pikafish.protocol, "uci");
  assert.deepEqual(pikafish.engineOptions, [
    { name: "UCI_ShowWDL", value: true }
  ]);
});

test("Pikafish preset configures UCI, WDL, and optional NNUE file", () => {
  const preset = resolveNativeEnginePreset("pikafish", {
    command: "/engines/pikafish",
    evalFile: "/engines/pikafish.nnue",
    env: {}
  });

  assert.equal(preset.protocol, "uci");
  assert.equal(preset.command, "/engines/pikafish");
  assert.deepEqual(preset.engineOptions, [
    { name: "UCI_ShowWDL", value: true },
    { name: "EvalFile", value: "/engines/pikafish.nnue" }
  ]);
});

test("Pikafish preset can infer local bundle paths from home", () => {
  const preset = resolveNativeEnginePreset("pikafish", {
    env: {
      PIKAFISH_HOME: "/tmp/pikafish"
    },
    platform: "darwin",
    arch: "arm64"
  });

  assert.equal(preset.command, "/tmp/pikafish/MacOS/pikafish-apple-silicon");
  assert.equal(preset.cwd, "/tmp/pikafish");
  assert.deepEqual(preset.engineOptions, [
    { name: "UCI_ShowWDL", value: true },
    { name: "EvalFile", value: "/tmp/pikafish/pikafish.nnue" }
  ]);
});

test("explicit native options override preset defaults", () => {
  const preset = resolveNativeEnginePreset("pikafish", {
    command: "/engines/pikafish",
    engineOptions: [
      { name: "UCI_ShowWDL", value: false },
      { name: "Hash", value: 256 }
    ],
    env: {}
  });

  assert.deepEqual(preset.engineOptions, [
    { name: "UCI_ShowWDL", value: false },
    { name: "Hash", value: 256 }
  ]);
});

test("native option merging deduplicates by option name", () => {
  assert.deepEqual(
    mergeNativeEngineOptions(
      { Hash: 64, Threads: 2 },
      [["hash", 128], { name: "EvalFile", value: "pikafish.nnue" }]
    ),
    [
      { name: "hash", value: 128 },
      { name: "Threads", value: 2 },
      { name: "EvalFile", value: "pikafish.nnue" }
    ]
  );
});
