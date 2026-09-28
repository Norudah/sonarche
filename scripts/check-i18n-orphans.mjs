/**
 * Fails on translation keys nothing in `src/` uses. `tsc` already rejects a
 * key missing from a catalogue; this is the other direction.
 *
 * Static and deliberately lenient: a key counts as used if its full path
 * appears as a string literal, if one of its ancestors does (`SettingRow`
 * takes `appearance.theme` and reads `.name`/`.why`), or if a template literal
 * like `danger.${key}.name` can produce it. It can miss an orphan, never flag a
 * live key.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = "src";

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

/** A template made only of key characters and `${…}` holes; nested templates
 * match on their own. */
const KEY_TEMPLATE = /`((?:[\w.-]|\$\{[^}`]*\})*\$\{[^}`]*\}(?:[\w.-]|\$\{[^}`]*\})*)`/g;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function leafKeys(node, prefix = "") {
  return Object.entries(node).flatMap(([key, value]) =>
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? leafKeys(value, `${prefix}${key}.`)
      : [(prefix + key).replace(PLURAL_SUFFIX, "")],
  );
}

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const files = walk(ROOT);
const code = files
  .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
  .map((file) => fs.readFileSync(file, "utf8"))
  .join("\n");

// Each hole stands for one key segment.
const templates = [...code.matchAll(KEY_TEMPLATE)].map(
  ([, body]) =>
    new RegExp(
      `^${body
        .split(/\$\{[^}]*\}/)
        .map(escape)
        .join("[\\w-]+")}$`,
    ),
);

const isLiteral = (key) => code.includes(`"${key}"`) || code.includes(`'${key}'`) || code.includes(`\`${key}\``);

function isUsed(key) {
  if (isLiteral(key) || templates.some((template) => template.test(key))) return true;
  const parts = key.split(".");
  // Two segments at least: a bare `"title"` literal proves nothing.
  for (let depth = parts.length - 1; depth >= 2; depth--) {
    if (isLiteral(parts.slice(0, depth).join("."))) return true;
  }
  return false;
}

let total = 0;
for (const catalogue of files.filter((file) => file.endsWith(`locales${path.sep}en.json`)).sort()) {
  const keys = [...new Set(leafKeys(JSON.parse(fs.readFileSync(catalogue, "utf8"))))];
  const orphans = keys.filter((key) => !isUsed(key));
  if (orphans.length === 0) continue;
  total += orphans.length;
  console.error(`${catalogue} (and its fr.json twin):`);
  for (const key of orphans) console.error(`  ${key}`);
}

if (total > 0) {
  console.error(`\n${total} unused translation key(s).`);
  process.exit(1);
}
console.log("No unused translation keys.");
