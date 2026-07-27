/**
 * Fetches the Python runtime the app ships with, into `src-tauri/resources/`.
 *
 * Run before any build (`npm run prepare:runtime`, and automatically from
 * tauri.conf.json's beforeBuildCommand). The fetched files are gitignored: they
 * are large, they are reproducible from the pin below, and a binary in git is a
 * binary forever.
 *
 * Two resources, deliberately shaped differently:
 *
 * - `python.tar.gz` stays an archive. The interpreter tree is full of symlinks
 *   (`bin/python3` → `python3.13`) and executable bits, and a bundler copying
 *   files one by one is not guaranteed to keep either. Handing the app a
 *   tarball and letting `tar` restore it at setup keeps the modes intact, and
 *   ships 24 MB instead of the 66 MB it becomes.
 * - `wheels/` is a plain directory. Wheels are inert files with nothing to
 *   preserve, and pip wants a directory to point `--find-links` at.
 *
 * The wheels are optional: without them the app installs from PyPI as before.
 * They are what makes the first run offline-capable and quick — beets pulls in
 * numpy, scipy, numba and llvmlite, which is 67 MB of the 73 MB and several
 * minutes of network on a first launch.
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

/** Host → python-build-standalone triple. Windows and Linux land here when
 * their ports do; the table is the only thing that has to grow. */
const TRIPLES = {
  "darwin-arm64": "aarch64-apple-darwin",
  "darwin-x64": "x86_64-apple-darwin",
};

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
  const stamp = `${PYTHON.version}+${PYTHON.release}-${triple}-wheels`;
  const wheels = path.join(resources, "wheels");
  if (await isCurrent(wheels, stamp)) {
    console.log("[runtime] wheels already current");
    return;
  }

  const scratch = path.join(root, "node_modules", ".cache", "sonarche-runtime");
  await fs.rm(scratch, { recursive: true, force: true });
  await fs.mkdir(scratch, { recursive: true });
  run("/usr/bin/tar", ["-xzf", path.join(resources, "python.tar.gz"), "-C", scratch]);

  await fs.rm(wheels, { recursive: true, force: true });
  await fs.mkdir(wheels, { recursive: true });
  console.log("[runtime] resolving wheels");
  run(path.join(scratch, "python", "bin", "python3"), [
    "-m",
    "pip",
    "download",
    "--disable-pip-version-check",
    "-q",
    "-r",
    path.join(root, "sidecar", "requirements.txt"),
    "-d",
    wheels,
  ]);
  await fs.rm(scratch, { recursive: true, force: true });

  const files = (await fs.readdir(wheels)).filter((f) => f.endsWith(".whl"));
  const sizes = await Promise.all(files.map((f) => fs.stat(path.join(wheels, f)).then((s) => s.size)));
  console.log(`[runtime] ${files.length} wheels, ${(sizes.reduce((a, b) => a + b, 0) / 1e6).toFixed(0)} MB`);
  await stampAs(wheels, stamp);
}

const host = `${process.platform}-${process.arch}`;
const triple = TRIPLES[host];
if (!triple) {
  console.error(`[runtime] no interpreter pinned for ${host} — see TRIPLES in this file`);
  process.exit(1);
}

await fetchInterpreter(triple);
await fetchWheels(triple);
console.log("[runtime] ready");
