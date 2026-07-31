/**
 * Fetches the runtime the app ships with, into `src-tauri/resources/`.
 *
 * Run before any build (`npm run prepare:runtime`, and automatically from
 * tauri.conf.json's beforeBuildCommand). The fetched files are gitignored: they
 * are large, they are reproducible from the pins below, and a binary in git is a
 * binary forever.
 *
 * Three resources, deliberately shaped differently:
 *
 * - `python.tar.gz` stays an archive. The interpreter tree is full of symlinks
 *   (`bin/python3` → `python3.13`) and executable bits, and a bundler copying
 *   files one by one is not guaranteed to keep either. Handing the app a
 *   tarball and letting `tar` restore it at setup keeps the modes intact, and
 *   ships 24 MB instead of the 66 MB it becomes.
 * - `wheels/` is a plain directory. Wheels are inert files with nothing to
 *   preserve, and pip wants a directory to point `--find-links` at.
 * - `tools/fpcalc` is unpacked here rather than fetched at first use. The app
 *   used to download it itself, which is the one behaviour an unsigned binary
 *   cannot afford: a program nobody signed pulling an executable off the
 *   network and running it is what a dropper looks like, and Defender
 *   quarantined the installer on that basis alone.
 *
 * The wheels are optional: without them the app installs from PyPI as before.
 * They are what makes the first run offline-capable and quick.
 *
 * Resolved on the target's own runner, never cross-built: `--platform` does not
 * move the environment markers, and beets asks for colorama on Windows only.
 * A set prefetched from macOS for Windows would be one wheel short.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The interpreter, pinned. Bumping either field re-fetches everything.
 *
 * 3.13 rather than the newest: beets and its native dependencies publish
 * wheels for it, and a version with no wheel for one of them turns a silent
 * download into an on-device compile.
 */
const PYTHON = { release: "20260718", version: "3.13.14" };

/**
 * Host → python-build-standalone triple. Linux lands here when its port does.
 *
 * `win32-arm64` is now buildable — dropping llvmlite left nothing in the tree
 * without an ARM wheel — but no runner is wired for it: Windows on ARM runs the
 * x64 build under emulation, and a fourth bundle is a fourth set of release
 * minutes for an audience of nearly nobody. Add the line when that changes.
 */
const TRIPLES = {
  "darwin-arm64": "aarch64-apple-darwin",
  "darwin-x64": "x86_64-apple-darwin",
  "win32-x64": "x86_64-pc-windows-msvc",
};

/**
 * Chromaprint's fpcalc, pinned by triple and by digest.
 *
 * One asset covers both Macs — upstream ships a universal binary — so the two
 * darwin triples point at the same entry. `member` is the single file worth
 * keeping out of an archive that also carries a licence and a readme.
 *
 * The digests are checked here, at build time, on a machine we control. That is
 * a better place for the check than the user's: a mismatch stops a release
 * instead of stopping an app that has already shipped.
 */
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

/** System tar, by absolute path. Windows has shipped bsdtar in System32 since
 * 10 1803, and it reads the same gzipped tarball — and the same zip, which is
 * the shape the Windows fpcalc asset comes in. */
const TAR = process.platform === "win32" ? "C:\\Windows\\System32\\tar.exe" : "/usr/bin/tar";

/** Where the interpreter sits inside the unpacked tree. The Windows
 * distribution has no `bin/`: the executable is at the root. */
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

/** A stamp beside each resource, so a second run is a no-op and a changed pin
 * is not. */
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

/**
 * Unpacks the interpreter into a scratch directory so pip has something to run.
 * The wheels have to be resolved by the very interpreter that will install
 * them: the tags in a wheel's filename bind it to a Python version and a
 * platform, and resolving with the build machine's own Python would collect a
 * set the app cannot use.
 */
async function fetchWheels(triple) {
  // The requirements go into the stamp, not just the interpreter: a dependency
  // added to requirements.txt has to refetch the set, and keying on the pin
  // alone left the old wheels sitting there looking current. CI already hashes
  // the file into its cache key, so this is what closes the gap locally.
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
    // Same two flags as the install this set feeds (see python_env.rs): the
    // lock is the whole tree, and a package with no wheel has to fail on the
    // build machine rather than turn into a compile on the user's.
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

/**
 * Unpacks fpcalc into `resources/tools/`, ready to be copied into place on
 * first use. Statically linked upstream, so it needs no ffmpeg beside it.
 */
async function fetchFpcalc(triple) {
  const asset = FPCALC_ASSETS[triple];
  if (!asset) throw new Error(`no fpcalc asset pinned for ${triple} — see FPCALC_ASSETS in this file`);

  const stamp = `${FPCALC.version}-${triple}`;
  const tools = path.join(resources, "tools");
  const binary = path.join(tools, path.basename(asset.member));
  if ((await isCurrent(tools, stamp)) && (await exists(binary))) {
    console.log(`[runtime] fpcalc already at ${stamp}`);
    return;
  }

  const url = `https://github.com/acoustid/chromaprint/releases/download/v${FPCALC.version}/${asset.archive}`;
  console.log(`[runtime] fetching ${asset.archive}`);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`download failed: ${response.status} ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());

  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== asset.sha256) {
    throw new Error(`fpcalc checksum mismatch\n  expected ${asset.sha256}\n  got      ${digest}`);
  }

  await fs.rm(tools, { recursive: true, force: true });
  await fs.mkdir(tools, { recursive: true });
  // Extension-free on purpose: the asset is a tarball on macOS and a zip on
  // Windows, and bsdtar sniffs the format rather than trusting the name.
  const archive = path.join(tools, "fpcalc-archive");
  await fs.writeFile(archive, bytes);
  // BSD tar treats everything after the first member name as more member names,
  // so the options have to come before it.
  run(TAR, ["-xf", archive, "-C", tools, "--strip-components=1", asset.member]);
  await fs.rm(archive, { force: true });

  if (!(await exists(binary))) throw new Error(`fpcalc missing after extraction (expected ${binary})`);
  const { size } = await fs.stat(binary);
  console.log(`[runtime] fpcalc ${FPCALC.version}, ${(size / 1e6).toFixed(1)} MB`);
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
await fetchFpcalc(triple);
console.log("[runtime] ready");
