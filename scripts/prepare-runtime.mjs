/**
 * Fetches the runtime the app ships into `src-tauri/resources/` (gitignored,
 * reproducible from the pins). Runs via `npm run prepare:runtime` and the
 * `beforeBuildCommand`.
 *
 * - `python.tar.gz` stays an archive, so `tar` restores its symlinks and modes.
 * - `wheels/` (optional) makes the first run offline and fast.
 * - `tools/` (fpcalc, ffmpeg, deno) is fetched here rather than at runtime:
 *   an unsigned app downloading executables looks like a dropper.
 *
 * Always resolved on the target's own runner: environment markers differ per
 * platform (colorama is Windows-only).
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Bumping either field re-fetches everything. 3.13 because every native
 * dependency publishes wheels for it. */
const PYTHON = { release: "20260718", version: "3.13.14" };

/** Host → python-build-standalone triple. No win32-arm64 runner: Windows on
 * ARM runs the x64 build. */
const TRIPLES = {
  "darwin-arm64": "aarch64-apple-darwin",
  "darwin-x64": "x86_64-apple-darwin",
  "win32-x64": "x86_64-pc-windows-msvc",
};

/** Pinned by triple and digest, checked here at build time. Both Macs share
 * the universal binary; `member` is the file to extract. */
const FPCALC = { version: "1.5.1" };
const FPCALC_ASSETS = {
  "aarch64-apple-darwin": {
    archive: `chromaprint-fpcalc-${FPCALC.version}-macos-universal.tar.gz`,
    member: `chromaprint-fpcalc-${FPCALC.version}-macos-universal/fpcalc`,
    sha256: "d4d8faff4b5f7c558d9be053da47804f9501eaa6c2f87906a9f040f38d61c860",
  },
  "x86_64-pc-windows-msvc": {
    archive: `chromaprint-fpcalc-${FPCALC.version}-windows-x86_64.zip`,
    member: `chromaprint-fpcalc-${FPCALC.version}-windows-x86_64/fpcalc.exe`,
    sha256: "36b478e16aa69f757f376645db0d436073a42c0097b6bb2677109e7835b59bbc",
  },
};
FPCALC_ASSETS["x86_64-apple-darwin"] = FPCALC_ASSETS["aarch64-apple-darwin"];

/** Static GPL ffmpeg (eugeneware/ffmpeg-static), pinned by triple and digest,
 * used only to remux fragmented DASH m4a into classic MP4. Its licence ships
 * alongside (`ffmpeg.LICENSE`). */
const FFMPEG = { release: "b6.1.1" };
const FFMPEG_ASSETS = {
  "aarch64-apple-darwin": {
    asset: "ffmpeg-darwin-arm64.gz",
    licence: "darwin-arm64.LICENSE",
    sha256: "8923876afa8db5585022d7860ec7e589af192f441c56793971276d450ed3bbfa",
    licenceSha256: "cb48bf09a11f5fb576cddb0431c8f5ed0a60157a9ec942adffc13907cbe083f2",
  },
  "x86_64-apple-darwin": {
    asset: "ffmpeg-darwin-x64.gz",
    licence: "darwin-x64.LICENSE",
    sha256: "929b375c1182d956c51f7ac25e0b2b0411fb01f6f407aa15c9758efeb4242106",
    licenceSha256: "2e1d16c72fd74e12063776371da757322f8b77589386532f4fd8634bde7de1af",
  },
  "x86_64-pc-windows-msvc": {
    asset: "ffmpeg-win32-x64.gz",
    licence: "win32-x64.LICENSE",
    sha256: "8883a3dffbd0a16cf4ef95206ea05283f78908dbfb118f73c83f4951dcc06d77",
    licenceSha256: "8ceb4b9ee5adedde47b31e975c1d90c73ad27b6b165a1dcd80c7c545eb65b903",
  },
};

/** Deno, pinned by triple and digest: the JavaScript runtime yt-dlp needs for
 * YouTube's descrambler, run without permissions. The zip holds the bare binary. */
const DENO = { version: "2.9.6" };
const DENO_ASSETS = {
  "aarch64-apple-darwin": { sha256: "213a2f304f04d3c9cb5220669afad138f60a5aab1fe80962abdeb8f35807a472" },
  "x86_64-apple-darwin": { sha256: "7d4524b82bcc557fe020a1a5b56956ed42b992ae5b28026e8ad5d17329533f5f" },
  "x86_64-pc-windows-msvc": { sha256: "15e5300b0ba3c3695a7621d90160a746ec9e710228cee639afa9d580f6e3cd11" },
};

/** By absolute path. Windows 10 1803+ ships bsdtar, which also reads zip. */
const TAR = process.platform === "win32" ? "C:\\Windows\\System32\\tar.exe" : "/usr/bin/tar";

/** The Windows distribution has no `bin/`. */
const PYTHON_EXE = process.platform === "win32" ? ["python", "python.exe"] : ["python", "bin", "python3"];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const resources = path.join(root, "src-tauri", "resources");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed (exit ${result.status})`);
  }
}

async function exists(target) {
  return await fs
    .access(target)
    .then(() => true)
    .catch(() => false);
}

/** A stamp per resource: a second run is a no-op unless a pin changed. */
async function isCurrent(dir, stamp) {
  return (await fs.readFile(path.join(dir, ".pin"), "utf8").catch(() => null))?.trim() === stamp;
}

async function stampAs(dir, stamp) {
  await fs.writeFile(path.join(dir, ".pin"), `${stamp}\n`);
}

async function fetchInterpreter(triple) {
  const stamp = `${PYTHON.version}+${PYTHON.release}-${triple}`;
  const archive = path.join(resources, "python.tar.gz");
  if ((await isCurrent(resources, stamp)) && (await exists(archive))) {
    console.log(`[runtime] interpreter already at ${stamp}`);
    return;
  }

  const name = `cpython-${PYTHON.version}+${PYTHON.release}-${triple}-install_only.tar.gz`;
  const url = `https://github.com/astral-sh/python-build-standalone/releases/download/${PYTHON.release}/${name}`;
  console.log(`[runtime] fetching ${name}`);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`download failed: ${response.status} ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.mkdir(resources, { recursive: true });
  await fs.writeFile(archive, bytes);

  const digest = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  console.log(`[runtime] ${(bytes.length / 1e6).toFixed(1)} MB, sha256:${digest}…`);
  await stampAs(resources, stamp);
}

/** Resolves the wheels with the bundled interpreter itself (wheel tags bind a
 * Python version and platform). */
async function fetchWheels(triple) {
  // The requirements are part of the stamp, so a changed lock refetches.
  const requirements = path.join(root, "sidecar", "requirements.txt");
  const digest = createHash("sha256")
    .update(await fs.readFile(requirements))
    .digest("hex")
    .slice(0, 12);
  const stamp = `${PYTHON.version}+${PYTHON.release}-${triple}-wheels-${digest}`;
  const wheels = path.join(resources, "wheels");
  if (await isCurrent(wheels, stamp)) {
    console.log("[runtime] wheels already current");
    return;
  }

  const scratch = path.join(root, "node_modules", ".cache", "sonarche-runtime");
  await fs.rm(scratch, { recursive: true, force: true });
  await fs.mkdir(scratch, { recursive: true });
  run(TAR, ["-xzf", path.join(resources, "python.tar.gz"), "-C", scratch]);

  await fs.rm(wheels, { recursive: true, force: true });
  await fs.mkdir(wheels, { recursive: true });
  console.log("[runtime] resolving wheels");
  run(path.join(scratch, ...PYTHON_EXE), [
    "-m",
    "pip",
    "download",
    "--disable-pip-version-check",
    "-q",
    // Same flags as the app's install (see python_env.rs).
    "--no-deps",
    "--only-binary=:all:",
    "-r",
    requirements,
    "-d",
    wheels,
  ]);
  await fs.rm(scratch, { recursive: true, force: true });

  const files = (await fs.readdir(wheels)).filter((f) => f.endsWith(".whl"));
  const sizes = await Promise.all(files.map((f) => fs.stat(path.join(wheels, f)).then((s) => s.size)));
  console.log(`[runtime] ${files.length} wheels, ${(sizes.reduce((a, b) => a + b, 0) / 1e6).toFixed(0)} MB`);
  await stampAs(wheels, stamp);
}

async function fetchVerified(url, sha256, label) {
  console.log(`[runtime] fetching ${label}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`download failed: ${response.status} ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== sha256) {
    throw new Error(`${label} checksum mismatch\n  expected ${sha256}\n  got      ${digest}`);
  }
  return bytes;
}

/** Statically linked upstream. */
async function fetchFpcalc(triple, tools) {
  const asset = FPCALC_ASSETS[triple];
  if (!asset) throw new Error(`no fpcalc asset pinned for ${triple} — see FPCALC_ASSETS in this file`);

  const url = `https://github.com/acoustid/chromaprint/releases/download/v${FPCALC.version}/${asset.archive}`;
  const bytes = await fetchVerified(url, asset.sha256, asset.archive);

  // No extension: a tarball on macOS, a zip on Windows; bsdtar sniffs it.
  const archive = path.join(tools, "fpcalc-archive");
  await fs.writeFile(archive, bytes);
  // BSD tar reads everything after the first member name as more members.
  run(TAR, ["-xf", archive, "-C", tools, "--strip-components=1", asset.member]);
  await fs.rm(archive, { force: true });

  const binary = path.join(tools, path.basename(asset.member));
  if (!(await exists(binary))) throw new Error(`fpcalc missing after extraction (expected ${binary})`);
  const { size } = await fs.stat(binary);
  console.log(`[runtime] fpcalc ${FPCALC.version}, ${(size / 1e6).toFixed(1)} MB`);
}

/** A bare gzipped binary plus its licence. */
async function fetchFfmpeg(triple, tools) {
  const asset = FFMPEG_ASSETS[triple];
  if (!asset) throw new Error(`no ffmpeg asset pinned for ${triple} — see FFMPEG_ASSETS in this file`);

  const base = `https://github.com/eugeneware/ffmpeg-static/releases/download/${FFMPEG.release}`;
  const bytes = await fetchVerified(`${base}/${asset.asset}`, asset.sha256, asset.asset);
  const licence = await fetchVerified(`${base}/${asset.licence}`, asset.licenceSha256, asset.licence);

  const binary = path.join(tools, triple.includes("windows") ? "ffmpeg.exe" : "ffmpeg");
  await fs.writeFile(binary, gunzipSync(bytes));
  await fs.writeFile(path.join(tools, "ffmpeg.LICENSE"), licence);
  if (process.platform !== "win32") await fs.chmod(binary, 0o755);

  const { size } = await fs.stat(binary);
  console.log(`[runtime] ffmpeg ${FFMPEG.release}, ${(size / 1e6).toFixed(1)} MB`);
}

/** A zip holding the bare binary. */
async function fetchDeno(triple, tools) {
  const asset = DENO_ASSETS[triple];
  if (!asset) throw new Error(`no deno asset pinned for ${triple} — see DENO_ASSETS in this file`);

  const name = `deno-${triple}.zip`;
  const url = `https://github.com/denoland/deno/releases/download/v${DENO.version}/${name}`;
  const bytes = await fetchVerified(url, asset.sha256, name);

  const archive = path.join(tools, "deno-archive");
  await fs.writeFile(archive, bytes);
  const member = triple.includes("windows") ? "deno.exe" : "deno";
  run(TAR, ["-xf", archive, "-C", tools, member]);
  await fs.rm(archive, { force: true });

  const binary = path.join(tools, member);
  if (!(await exists(binary))) throw new Error(`deno missing after extraction (expected ${binary})`);
  if (process.platform !== "win32") await fs.chmod(binary, 0o755);

  const { size } = await fs.stat(binary);
  console.log(`[runtime] deno ${DENO.version}, ${(size / 1e6).toFixed(1)} MB`);
}

/** Populates `resources/tools/` under one shared stamp, so bumping any pin
 * rebuilds all three. */
async function fetchTools(triple) {
  const stamp = `fpcalc-${FPCALC.version}+ffmpeg-${FFMPEG.release}+deno-${DENO.version}-${triple}`;
  const tools = path.join(resources, "tools");
  if (await isCurrent(tools, stamp)) {
    console.log(`[runtime] tools already at ${stamp}`);
    return;
  }

  await fs.rm(tools, { recursive: true, force: true });
  await fs.mkdir(tools, { recursive: true });
  await fetchFpcalc(triple, tools);
  await fetchFfmpeg(triple, tools);
  await fetchDeno(triple, tools);
  await stampAs(tools, stamp);
}

const host = `${process.platform}-${process.arch}`;
const triple = TRIPLES[host];
if (!triple) {
  console.error(`[runtime] no interpreter pinned for ${host} — see TRIPLES in this file`);
  process.exit(1);
}

await fetchInterpreter(triple);
await fetchWheels(triple);
await fetchTools(triple);
console.log("[runtime] ready");
