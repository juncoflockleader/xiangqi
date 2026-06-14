#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { access, chmod, mkdir, readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import { resolveNativeEnginePreset } from "../src/index.js";

const DEFAULT_RELEASE_URL = "https://api.github.com/repos/official-pikafish/Pikafish/releases/latest";
const DEFAULT_DEST = ".engines/pikafish";
const EXTRACTORS = ["7zz", "7z", "unar", "bsdtar"];

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  console.error("");
  printUsage();
  process.exit(1);
}

if (options.help) {
  printUsage();
  process.exit(0);
}

try {
  const plan = await buildInstallPlan(options);
  const result = options.dryRun ? plan : await installPikafish(plan, options);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatInstallReport(result, options));
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

async function buildInstallPlan(options) {
  const release = await loadRelease(options);
  const asset = selectReleaseAsset(release, options);
  const installRoot = resolve(options.dest);
  const tag = safePathSegment(release.tag_name ?? release.name ?? "latest");
  const installDir = resolve(installRoot, tag);
  const archivePath = resolve(installDir, asset.name);
  const digest = parseDigest(asset.digest);
  const preset = resolveNativeEnginePreset("pikafish", {
    home: installDir,
    platform: options.platform,
    arch: options.arch,
    env: {}
  });

  return {
    ok: true,
    dryRun: options.dryRun,
    release: {
      name: release.name ?? release.tag_name ?? "Pikafish",
      tag: release.tag_name ?? null,
      url: release.html_url ?? options.releaseUrl,
      publishedAt: release.published_at ?? null
    },
    asset: {
      name: asset.name,
      size: asset.size ?? null,
      digest,
      downloadUrl: asset.browser_download_url
    },
    installRoot,
    installDir,
    archivePath,
    command: preset.command,
    evalFile: findPresetOption(preset, "EvalFile") ?? null,
    env: {
      PIKAFISH_HOME: installDir
    },
    next: {
      probe: `PIKAFISH_HOME=${shellQuote(installDir)} npm run probe:native -- --preset pikafish --lines 3`,
      play: `PIKAFISH_HOME=${shellQuote(installDir)} npm run play -- --side black --engine-preset pikafish`,
      sparring: `PIKAFISH_HOME=${shellQuote(installDir)} npm run spar -- --red-preset pikafish --black-depth 2 --plies 12`
    }
  };
}

async function installPikafish(plan, options) {
  await mkdir(plan.installDir, { recursive: true });

  const archiveExists = await fileExists(plan.archivePath);
  if (!archiveExists || options.force) {
    await downloadFile(plan.asset.downloadUrl, plan.archivePath);
  }

  const verification = plan.asset.digest
    ? await verifyDigest(plan.archivePath, plan.asset.digest)
    : { checked: false, ok: true, reason: "no-digest" };

  if (!verification.ok) {
    throw new Error(`Downloaded asset digest mismatch: expected ${plan.asset.digest.algorithm}:${plan.asset.digest.value}, got ${verification.actual}.`);
  }

  const extractor = options.skipExtract ? null : await resolveExtractor(options.extractor);
  if (!options.skipExtract) {
    await extractArchive(extractor, plan.archivePath, plan.installDir);
    await markExecutableIfPresent(plan.command);
  }

  return {
    ...plan,
    dryRun: false,
    downloaded: !archiveExists || options.force,
    verified: verification,
    extracted: !options.skipExtract,
    extractor: extractor?.command ?? null,
    commandExists: await fileExists(plan.command),
    evalFileExists: await fileExists(plan.evalFile)
  };
}

async function loadRelease(options) {
  if (options.releaseFile) {
    return JSON.parse(await readFile(options.releaseFile, "utf8"));
  }

  const response = await fetch(options.releaseUrl, {
    headers: {
      "Accept": "application/vnd.github+json",
      "User-Agent": "xiangqi-engine-installer"
    }
  });

  if (!response.ok) {
    throw new Error(`Could not fetch Pikafish release metadata: HTTP ${response.status}.`);
  }

  return response.json();
}

function selectReleaseAsset(release, options) {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  if (assets.length === 0) {
    throw new Error("Pikafish release has no downloadable assets.");
  }

  if (options.assetName) {
    const exact = assets.find((asset) => asset.name === options.assetName);
    if (!exact) throw new Error(`Pikafish release does not include asset ${options.assetName}.`);
    return assertDownloadableAsset(exact);
  }

  const archive = assets.find((asset) => /\.7z$/i.test(asset.name))
    ?? assets.find((asset) => /\.(zip|tar\.gz|tgz)$/i.test(asset.name));
  if (!archive) {
    throw new Error("Pikafish release does not include a supported archive asset.");
  }
  return assertDownloadableAsset(archive);
}

function assertDownloadableAsset(asset) {
  if (!asset.browser_download_url) {
    throw new Error(`Release asset ${asset.name} does not have a browser_download_url.`);
  }
  return asset;
}

async function downloadFile(url, outputPath) {
  await mkdir(dirname(outputPath), { recursive: true });
  const response = await fetch(url, {
    headers: {
      "User-Agent": "xiangqi-engine-installer"
    }
  });

  if (!response.ok || !response.body) {
    throw new Error(`Could not download Pikafish asset: HTTP ${response.status}.`);
  }

  await pipeline(Readable.fromWeb(response.body), createWriteStream(outputPath));
}

async function verifyDigest(filePath, digest) {
  const hash = createHash(digest.algorithm);
  const file = await readFile(filePath);
  hash.update(file);
  const actual = hash.digest("hex");

  return {
    checked: true,
    ok: actual.toLowerCase() === digest.value.toLowerCase(),
    expected: `${digest.algorithm}:${digest.value}`,
    actual: `${digest.algorithm}:${actual}`
  };
}

async function resolveExtractor(requested) {
  const candidates = requested ? [requested] : EXTRACTORS;
  for (const command of candidates) {
    if (await commandExists(command)) return { command };
  }

  throw new Error(`Could not find an archive extractor. Install one of: ${EXTRACTORS.join(", ")}.`);
}

async function extractArchive(extractor, archivePath, installDir) {
  if (extractor.command === "7z" || extractor.command === "7zz") {
    await runCommand(extractor.command, ["x", "-y", `-o${installDir}`, archivePath]);
    return;
  }

  if (extractor.command === "unar") {
    await runCommand(extractor.command, ["-force-overwrite", "-output-directory", installDir, archivePath]);
    return;
  }

  await runCommand(extractor.command, ["-xf", archivePath, "-C", installDir]);
}

async function markExecutableIfPresent(path) {
  if (!path || !(await fileExists(path))) return;
  await chmod(path, 0o755);
}

function runCommand(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "ignore", "pipe"]
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`${command} exited with code ${code}: ${stderr.trim()}`));
    });
  });
}

async function commandExists(command) {
  if (isAbsolute(command) || command.includes("/")) {
    return fileExists(command);
  }

  const paths = String(process.env.PATH ?? "").split(":").filter(Boolean);
  for (const path of paths) {
    if (await fileExists(join(path, command))) return true;
  }
  return false;
}

async function fileExists(path) {
  if (!path) return false;
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function parseDigest(value) {
  if (!value) return null;
  const [algorithm, digest] = String(value).split(":", 2);
  if (!algorithm || !digest) return null;
  if (!["sha256", "sha384", "sha512"].includes(algorithm)) return null;
  return { algorithm, value: digest };
}

function findPresetOption(preset, name) {
  return preset.engineOptions.find((option) => option.name.toLowerCase() === name.toLowerCase())?.value;
}

function formatInstallReport(result, options) {
  const lines = [
    `${result.dryRun ? "Pikafish install plan" : "Pikafish installed"}: ${result.release.name}`,
    `Release: ${result.release.url}`,
    `Asset: ${result.asset.name}${result.asset.size ? ` (${formatBytes(result.asset.size)})` : ""}`,
    `Install dir: ${result.installDir}`,
    `Command: ${result.command}`,
    `Eval file: ${result.evalFile ?? "none"}`
  ];

  if (result.asset.digest) {
    lines.push(`Digest: ${result.asset.digest.algorithm}:${result.asset.digest.value}`);
  }
  if (!result.dryRun) {
    lines.push(`Downloaded: ${result.downloaded ? "yes" : "reused existing archive"}`);
    lines.push(`Verified: ${result.verified.checked ? (result.verified.ok ? "yes" : "no") : "not available"}`);
    lines.push(`Extracted: ${result.extracted ? `yes (${result.extractor})` : "skipped"}`);
  }

  lines.push("");
  lines.push("Next commands:");
  lines.push(`  ${result.next.probe}`);
  if (!options.quiet) {
    lines.push(`  ${result.next.play}`);
    lines.push(`  ${result.next.sparring}`);
  }

  return lines.join("\n");
}

function parseArgs(args) {
  const options = {
    releaseUrl: process.env.XIANGQI_PIKAFISH_RELEASE_URL ?? DEFAULT_RELEASE_URL,
    releaseFile: process.env.XIANGQI_PIKAFISH_RELEASE_FILE,
    dest: process.env.XIANGQI_PIKAFISH_INSTALL_DIR ?? DEFAULT_DEST,
    assetName: process.env.XIANGQI_PIKAFISH_ASSET,
    extractor: process.env.XIANGQI_ARCHIVE_EXTRACTOR,
    platform: process.platform,
    arch: process.arch,
    dryRun: false,
    skipExtract: false,
    force: false,
    json: false,
    quiet: false,
    help: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--skip-extract") {
      options.skipExtract = true;
      continue;
    }
    if (arg === "--force") {
      options.force = true;
      continue;
    }
    if (arg === "--quiet") {
      options.quiet = true;
      continue;
    }
    if (arg === "--release-url") {
      options.releaseUrl = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--release-file") {
      options.releaseFile = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--dest") {
      options.dest = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--asset") {
      options.assetName = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--extractor") {
      options.extractor = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--platform") {
      options.platform = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--arch") {
      options.arch = requireValue(args, index, arg);
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function requireValue(args, index, option) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function safePathSegment(value) {
  return String(value).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "latest";
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return String(value);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function printUsage() {
  console.log(`Usage: node examples/install-pikafish.mjs [options]

Downloads the latest official Pikafish release archive, verifies its digest when
GitHub provides one, extracts it into .engines/pikafish/<tag>, and prints the
commands needed to use the pikafish native engine preset.

Options:
  --dest DIR            Install root (default: .engines/pikafish)
  --release-url URL     GitHub release API URL (default: official latest)
  --release-file FILE   Read release metadata JSON from a file
  --asset NAME          Pick a specific release asset
  --extractor CMD       Archive extractor to use: 7zz, 7z, unar, or bsdtar
  --platform NAME       Platform for command inference (default: current)
  --arch NAME           CPU arch for command inference (default: current)
  --skip-extract        Download and verify only
  --force               Re-download the release archive
  --dry-run             Print the install plan without downloading
  --json                Print machine-readable JSON

Environment:
  XIANGQI_PIKAFISH_RELEASE_URL, XIANGQI_PIKAFISH_RELEASE_FILE,
  XIANGQI_PIKAFISH_INSTALL_DIR, XIANGQI_PIKAFISH_ASSET,
  XIANGQI_ARCHIVE_EXTRACTOR
`);
}
