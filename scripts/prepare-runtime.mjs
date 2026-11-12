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
 * One `resources/<arch>/` folder per target architecture, named as Rust's
 * `std::env::consts::ARCH` so the app picks its own. A universal macOS build
 * (`--target universal-apple-darwin`) gets both, and each slice of the
 * universal binary reads its half.
 *
 * The target comes from `--target`, else from the triple Tauri exports to its
 * build hooks, else from the host. Windows still builds on Windows: pip
 * evaluates environment markers against the interpreter running it, and
 * colorama is Windows-only.
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

const UNIVERSAL_MAC = "universal-apple-darwin";

/** The oldest wheel tag each target accepts (pip also takes anything older and
 * universal2). Explicit so the build host's OS version never decides which
 * wheels a user's machine gets. */
const WHEEL_PLATFORMS = {
  "aarch64-apple-darwin": "macosx_11_0_arm64",
  "x86_64-apple-darwin": "macosx_10_13_x86_64",
  "x86_64-pc-windows-msvc": "win_amd64",
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
const scratch = path.join(root, "node_modules", ".cache", "sonarche-runtime");

const archOf = (triple) => triple.split("-")[0];

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

/** `python.tar.gz` for `triple` into `dir`; returns the archive path. */
async function fetchInterpreter(triple, dir) {
  const stamp = `${PYTHON.version}+${PYTHON.release}-${triple}`;
  const archive = path.join(dir, "python.tar.gz");
  if ((await isCurrent(dir, stamp)) && (await exists(archive))) {
    console.log(`[runtime] interpreter already at ${stamp}`);
    return archive;
  }

  const name = `cpython-${PYTHON.version}+${PYTHON.release}-${triple}-install_only.tar.gz`;
  const url = `https://github.com/astral-sh/python-build-standalone/releases/download/${PYTHON.release}/${name}`;
  console.log(`[runtime] fetching ${name}`);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`download failed: ${response.status} ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(archive, bytes);

  const digest = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  console.log(`[runtime] ${(bytes.length / 1e6).toFixed(1)} MB, sha256:${digest}…`);
  await stampAs(dir, stamp);
  return archive;
}

/** A Python the build host can run, to drive pip. Unpacked once, on demand. */
let hostPython = null;
async function runnablePython(hostTriple, targets) {
  if (hostPython) return hostPython;
  // The host's own target folder when it has one, else a cached copy.
  const dir = targets.includes(hostTriple) ? path.join(resources, archOf(hostTriple)) : path.join(scratch, "host");
  const archive = await fetchInterpreter(hostTriple, dir);
  const unpacked = path.join(scratch, "python-host");
  await fs.rm(unpacked, { recursive: true, force: true });
  await fs.mkdir(unpacked, { recursive: true });
  run(TAR, ["-xzf", archive, "-C", unpacked]);
  hostPython = path.join(unpacked, ...PYTHON_EXE);
  return hostPython;
}

/** The lock's wheels for `triple`, verified against its hashes. */
async function fetchWheels(triple, dir, python) {
  // The requirements are part of the stamp, so a changed lock refetches.
  const requirements = path.join(root, "sidecar", "requirements.txt");
  const digest = createHash("sha256")
    .update(await fs.readFile(requirements))
    .digest("hex")
    .slice(0, 12);
  const stamp = `${PYTHON.version}+${PYTHON.release}-${triple}-wheels-${digest}`;
  const wheels = path.join(dir, "wheels");
  if (await isCurrent(wheels, stamp)) {
    console.log(`[runtime] ${archOf(triple)} wheels already current`);
    return;
  }

  await fs.rm(wheels, { recursive: true, force: true });
  await fs.mkdir(wheels, { recursive: true });
  console.log(`[runtime] resolving ${archOf(triple)} wheels`);
  run(await python(), [
    "-m",
    "pip",
    "download",
    "--disable-pip-version-check",
    "-q",
    // Same flags as the app's install (see python_env/mod.rs). The lock's
    // hashes turn on pip's hash-checking mode.
    "--no-deps",
    "--only-binary=:all:",
    "--platform",
    WHEEL_PLATFORMS[triple],
    "-r",
    requirements,
    "-d",
    wheels,
  ]);

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

/** Populates `<dir>/tools/` under one shared stamp, so bumping any pin
 * rebuilds all three. */
async function fetchTools(triple, dir) {
  const stamp = `fpcalc-${FPCALC.version}+ffmpeg-${FFMPEG.release}+deno-${DENO.version}-${triple}`;
  const tools = path.join(dir, "tools");
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

/** The triples to prepare: `universal-apple-darwin` stands for both Macs. */
function resolveTargets(hostTriple) {
  const flag = process.argv.indexOf("--target");
  const requested =
    (flag !== -1 ? process.argv[flag + 1] : undefined) ?? process.env.TAURI_ENV_TARGET_TRIPLE ?? hostTriple;
  const targets = requested === UNIVERSAL_MAC ? ["aarch64-apple-darwin", "x86_64-apple-darwin"] : [requested];
  for (const target of targets) {
    if (!WHEEL_PLATFORMS[target]) throw new Error(`no runtime pinned for ${target} — see TRIPLES in this file`);
    if (target.includes("apple") !== hostTriple.includes("apple")) {
      throw new Error(`cannot prepare ${target} on ${hostTriple}: build it on its own OS`);
    }
  }
  return targets;
}

const hostTriple = TRIPLES[`${process.platform}-${process.arch}`];
if (!hostTriple) {
  console.error(`[runtime] no interpreter pinned for ${process.platform}-${process.arch} — see TRIPLES in this file`);
  process.exit(1);
}
const targets = resolveTargets(hostTriple);
console.log(`[runtime] preparing ${targets.join(" + ")}`);

// Anything else in `resources/` would be bundled too: a previous target's
// folder, or the flat layout from before per-arch folders.
const keep = new Set(targets.map(archOf));
for (const entry of await fs.readdir(resources).catch(() => [])) {
  if (!keep.has(entry)) await fs.rm(path.join(resources, entry), { recursive: true, force: true });
}

for (const triple of targets) {
  const dir = path.join(resources, archOf(triple));
  await fetchInterpreter(triple, dir);
  await fetchWheels(triple, dir, () => runnablePython(hostTriple, targets));
  await fetchTools(triple, dir);
}
console.log("[runtime] ready");
