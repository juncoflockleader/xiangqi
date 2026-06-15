import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
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

test("lists the local C++ native engine preset", () => {
  const presets = listNativeEnginePresets();
  const localCpp = presets.find((preset) => preset.id === "local-cpp");

  assert.equal(localCpp.name, "Xiangqi Native C++");
  assert.equal(localCpp.protocol, "uci");
  assert.deepEqual(localCpp.engineOptions, []);
});

test("local C++ preset resolves the in-repository build artifact", () => {
  const preset = resolveNativeEnginePreset("local-cpp", {
    baseDir: "/repo/xiangqi",
    env: {}
  });

  assert.equal(preset.protocol, "uci");
  const expectedCommand = process.platform === "win32"
    ? "build/xiangqi-native.exe"
    : "build/xiangqi-native";
  assert.equal(preset.command, resolve("/repo/xiangqi", expectedCommand));
  assert.deepEqual(preset.engineOptions, []);
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

test("Pikafish preset infers Linux binaries from the official bundle layout", () => {
  const root = mkdtempSync(join(tmpdir(), "xiangqi-pikafish-linux-preset-"));

  try {
    const home = join(root, "Pikafish-2026-01-02");
    const command = createPikafishBinary(home, "Linux", "pikafish-avx2");
    createPikafishBinary(home, "Linux", "pikafish-sse41-popcnt");
    const preset = resolveNativeEnginePreset("pikafish", {
      env: { PIKAFISH_HOME: home },
      platform: "linux",
      arch: "x64"
    });

    assert.equal(preset.command, command);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Pikafish preset infers Windows binaries from the official bundle layout", () => {
  const root = mkdtempSync(join(tmpdir(), "xiangqi-pikafish-windows-preset-"));

  try {
    const home = join(root, "Pikafish-2026-01-02");
    const command = createPikafishBinary(home, "Windows", "pikafish-avx2.exe");
    createPikafishBinary(home, "Windows", "pikafish-sse41-popcnt.exe");
    const preset = resolveNativeEnginePreset("pikafish", {
      env: { PIKAFISH_HOME: home },
      platform: "win32",
      arch: "x64"
    });

    assert.equal(preset.command, command);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Pikafish preset can select an explicit official bundle variant", () => {
  const root = mkdtempSync(join(tmpdir(), "xiangqi-pikafish-variant-preset-"));

  try {
    const home = join(root, "Pikafish-2026-01-02");
    createPikafishBinary(home, "Linux", "pikafish-avx2");
    const command = createPikafishBinary(home, "Linux", "pikafish-sse41-popcnt");
    const preset = resolveNativeEnginePreset("pikafish", {
      env: { PIKAFISH_HOME: home },
      platform: "linux",
      arch: "x64",
      variant: "sse41-popcnt"
    });

    assert.equal(preset.command, command);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Pikafish preset discovers the latest local installer bundle", () => {
  const root = mkdtempSync(join(tmpdir(), "xiangqi-pikafish-preset-"));

  try {
    createPikafishBundle(root, "Pikafish-2025-01-02");
    const latest = createPikafishBundle(root, "Pikafish-2026-01-02");
    const preset = resolveNativeEnginePreset("pikafish", {
      env: {},
      installRoot: root,
      platform: "darwin",
      arch: "arm64"
    });

    assert.equal(preset.command, latest.command);
    assert.equal(preset.cwd, latest.home);
    assert.deepEqual(preset.engineOptions, [
      { name: "UCI_ShowWDL", value: true },
      { name: "EvalFile", value: latest.evalFile }
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Pikafish preset can disable local installer discovery", () => {
  const root = mkdtempSync(join(tmpdir(), "xiangqi-pikafish-preset-"));

  try {
    createPikafishBundle(root, "Pikafish-2026-01-02");
    const preset = resolveNativeEnginePreset("pikafish", {
      env: {},
      installRoot: root,
      autoDiscover: false,
      platform: "darwin",
      arch: "arm64"
    });

    assert.equal(preset.command, undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
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

function createPikafishBundle(root, tag) {
  const home = join(root, tag);
  const command = createPikafishBinary(home, "MacOS", "pikafish-apple-silicon");
  const evalFile = join(home, "pikafish.nnue");
  writeFileSync(evalFile, "nnue", "utf8");
  return { home, command, evalFile };
}

function createPikafishBinary(home, directory, name) {
  const command = join(home, directory, name);
  mkdirSync(join(home, directory), { recursive: true });
  writeFileSync(command, "#!/bin/sh\n", "utf8");
  chmodSync(command, 0o755);
  return command;
}
