import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("Pikafish installer prints an offline dry-run plan", async () => {
  const dir = await mkdtemp(join(tmpdir(), "xiangqi-pikafish-install-"));
  const releaseFile = join(dir, "release.json");
  const dest = join(dir, "engines");

  try {
    await writeReleaseFixture(releaseFile);
    const { stdout } = await execFileAsync(process.execPath, [
      "examples/install-pikafish.mjs",
      "--release-file", releaseFile,
      "--dest", dest,
      "--platform", "darwin",
      "--arch", "arm64",
      "--dry-run",
      "--json"
    ], {
      cwd: root,
      timeout: 5000
    });
    const plan = JSON.parse(stdout);

    assert.equal(plan.ok, true);
    assert.equal(plan.dryRun, true);
    assert.equal(plan.release.tag, "Pikafish-2099-01-02");
    assert.equal(plan.asset.name, "Pikafish.2099-01-02.7z");
    assert.deepEqual(plan.asset.digest, {
      algorithm: "sha256",
      value: "abc123"
    });
    assert.equal(plan.installDir, join(dest, "Pikafish-2099-01-02"));
    assert.equal(plan.command, join(dest, "Pikafish-2099-01-02", "MacOS", "pikafish-apple-silicon"));
    assert.equal(plan.evalFile, join(dest, "Pikafish-2099-01-02", "pikafish.nnue"));
    assert.equal(plan.env.PIKAFISH_HOME, plan.installDir);
    assert.match(plan.next.play, /--engine-preset pikafish/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("Pikafish installer can select an explicit asset", async () => {
  const dir = await mkdtemp(join(tmpdir(), "xiangqi-pikafish-install-"));
  const releaseFile = join(dir, "release.json");

  try {
    await writeReleaseFixture(releaseFile);
    const { stdout } = await execFileAsync(process.execPath, [
      "examples/install-pikafish.mjs",
      "--release-file", releaseFile,
      "--asset", "Pikafish.2099-01-02-src.zip",
      "--dry-run",
      "--json"
    ], {
      cwd: root,
      timeout: 5000
    });
    const plan = JSON.parse(stdout);

    assert.equal(plan.asset.name, "Pikafish.2099-01-02-src.zip");
    assert.equal(plan.asset.digest, null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("Pikafish installer reports missing release assets", async () => {
  const dir = await mkdtemp(join(tmpdir(), "xiangqi-pikafish-install-"));
  const releaseFile = join(dir, "release.json");

  try {
    await writeFile(releaseFile, JSON.stringify({
      tag_name: "Pikafish-empty",
      assets: []
    }), "utf8");

    await assert.rejects(
      () => execFileAsync(process.execPath, [
        "examples/install-pikafish.mjs",
        "--release-file", releaseFile,
        "--dry-run"
      ], {
        cwd: root,
        timeout: 5000
      }),
      (error) => {
        assert.equal(error.code, 1);
        assert.match(error.stderr, /has no downloadable assets/);
        return true;
      }
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

async function writeReleaseFixture(path) {
  await writeFile(path, JSON.stringify({
    tag_name: "Pikafish-2099-01-02",
    name: "Pikafish 2099-01-02",
    html_url: "https://example.test/releases/Pikafish-2099-01-02",
    published_at: "2099-01-02T00:00:00Z",
    assets: [
      {
        name: "Pikafish.2099-01-02.7z",
        size: 55332846,
        digest: "sha256:abc123",
        browser_download_url: "https://example.test/Pikafish.2099-01-02.7z"
      },
      {
        name: "Pikafish.2099-01-02-src.zip",
        browser_download_url: "https://example.test/Pikafish.2099-01-02-src.zip"
      }
    ]
  }), "utf8");
}
