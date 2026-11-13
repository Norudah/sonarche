/**
 * Every check CI runs before a merge into `main`, runnable locally:
 *
 *   npm run check                  # all suites
 *   npm run check -- rust sidecar  # some of them
 *
 * CI calls this same script per suite, so a green run here means a green PR.
 * A failing step doesn't stop the others; the summary lists them all.
 *
 * Needs `uv` for the sidecar suite (the dev venv lives in `.venv/`).
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUFF = "ruff@0.16.9";
const manifest = ["--manifest-path", "src-tauri/Cargo.toml"];
const venvPython = path.join(
  root,
  ".venv",
  ...(process.platform === "win32" ? ["Scripts", "python.exe"] : ["bin", "python"]),
);

const SUITES = {
  front: [
    ["types", "npx", ["tsc", "--noEmit"]],
    ["lint", "npm", ["run", "-s", "lint"]],
    ["unused code", "npm", ["run", "-s", "knip"]],
    ["unused translations", "npm", ["run", "-s", "i18n:orphans"]],
    ["format", "npm", ["run", "-s", "format:check"]],
    ["tests", "npm", ["test", "--", "--silent"]],
  ],
  rust: [
    ["build prerequisites", stubTauriInputs],
    ["format", "cargo", ["fmt", ...manifest, "--check"]],
    ["clippy", "cargo", ["clippy", ...manifest, "--all-targets", "--", "-D", "warnings"]],
    ["tests", "cargo", ["test", ...manifest]],
  ],
  sidecar: [
    ["dev venv", syncVenv],
    ["lint", "uvx", [RUFF, "check", "sidecar"]],
    ["format", "uvx", [RUFF, "format", "--check", "sidecar"]],
    ["tests", venvPython, ["-m", "unittest", "discover", "-s", "sidecar", "-p", "*_test.py"]],
    ["python lock", venvPython, ["scripts/check-python-lock.py"]],
  ],
};

function runCommand(command, args) {
  // `shell` on Windows only, where npm/npx are `.cmd` shims.
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  if (result.error) console.error(result.error.message);
  return result.status === 0;
}

/** tauri-build refuses to compile without the frontend output and the declared
 * resources. Placeholders only when missing: a real build overwrites them. */
function stubTauriInputs() {
  const index = path.join(root, "dist", "index.html");
  if (!fs.existsSync(index)) {
    fs.mkdirSync(path.dirname(index), { recursive: true });
    fs.writeFileSync(index, "");
  }
  fs.mkdirSync(path.join(root, "src-tauri", "resources"), { recursive: true });
  return true;
}

/** `.venv/` holds exactly the lock, like the app's own venv. */
function syncVenv() {
  if (!fs.existsSync(venvPython) && !runCommand("uv", ["venv", "--quiet", "--python", "3.13", ".venv"])) return false;
  return runCommand("uv", ["pip", "sync", "--quiet", "--python", venvPython, "sidecar/requirements.txt"]);
}

/** Newer releases of the pins in `requirements.in`. Information, never a failure. */
function reportOutdated() {
  const direct = fs
    .readFileSync(path.join(root, "sidecar", "requirements.in"), "utf8")
    .split("\n")
    .map((line) => line.split("#")[0].trim().split("==")[0].toLowerCase())
    .filter(Boolean);
  const result = spawnSync("uv", ["pip", "list", "--outdated", "--format", "json", "--python", venvPython], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) return;
  const outdated = JSON.parse(result.stdout || "[]").filter((pkg) => direct.includes(pkg.name.toLowerCase()));
  for (const pkg of outdated) {
    console.log(`  ↑ ${pkg.name} ${pkg.version} → ${pkg.latest_version} available (npm run deps:python)`);
  }
}

const requested = process.argv.slice(2);
const unknown = requested.filter((name) => !SUITES[name]);
if (unknown.length) {
  console.error(`unknown suite: ${unknown.join(", ")} (expected ${Object.keys(SUITES).join(", ")})`);
  process.exit(2);
}
const suites = requested.length ? requested : Object.keys(SUITES);
const ci = Boolean(process.env.GITHUB_ACTIONS);

const results = [];
for (const suite of suites) {
  for (const [label, command, args] of SUITES[suite]) {
    const name = `${suite} · ${label}`;
    console.log(ci ? `::group::${name}` : `\n── ${name}`);
    const ok = typeof command === "function" ? command() : runCommand(command, args);
    if (ci) console.log("::endgroup::");
    if (!ok && ci) console.log(`::error title=${name}::failed`);
    results.push([name, ok]);
  }
}

console.log("\n── summary");
for (const [name, ok] of results) console.log(`  ${ok ? "✓" : "✗"} ${name}`);
if (suites.includes("sidecar") && fs.existsSync(venvPython)) reportOutdated();

const failed = results.filter(([, ok]) => !ok).length;
console.log(failed ? `\n${failed} failed` : "\nall green");
process.exit(failed ? 1 : 0);
