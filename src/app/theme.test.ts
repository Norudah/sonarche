import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// Read off disk rather than imported: vitest stubs CSS modules out to an empty
// string, `?raw` included, so importing the stylesheet gives nothing to parse.
const css = readFileSync(fileURLToPath(new URL("./theme.css", import.meta.url)), "utf8");

/** Guardrails for the theme layer: both failures are silent in the browser
 * and only visible on the theme not currently open. */

/** Comments first, always: they quote declarations (`--color-accent:
 * var(--accent)`) that would otherwise parse as real ones. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Body of the block whose selector starts a line, brace-balanced for nested
 * blocks. Anchored because `[data-theme="dark"]` also appears in the light
 * selector's `:not()`. */
function blockBody(source: string, selector: string): string {
  const start = source.search(new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "m"));
  if (start === -1) throw new Error(`selector not found in theme.css: ${selector}`);

  const open = source.indexOf("{", start);
  if (open === -1) throw new Error(`no block after selector: ${selector}`);

  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}" && --depth === 0) return source.slice(open + 1, i);
  }
  throw new Error(`unbalanced block for selector: ${selector}`);
}

/** Custom-property declarations at the block's own level. Anything inside a
 * nested block belongs to that block, not this one. */
function declarationsOf(body: string): Map<string, string> {
  const found = new Map<string, string>();
  let depth = 0;
  let buffer = "";

  for (const char of body) {
    if (char === "{") depth++;
    else if (char === "}") depth--;
    else if (char === ";" && depth === 0) {
      const match = /^\s*(--[\w-]+)\s*:\s*([\s\S]+)$/.exec(buffer);
      if (match) found.set(match[1], match[2].trim());
      buffer = "";
      continue;
    }
    if (depth === 0 && char !== "{" && char !== "}") buffer += char;
  }

  return found;
}

const source = stripComments(css);
const light = declarationsOf(blockBody(source, ':root:not([data-theme="dark"])'));
const dark = declarationsOf(blockBody(source, '[data-theme="dark"]'));
const theme = declarationsOf(blockBody(source, "@theme"));

describe("theme.css", () => {
  it("declares light and dark blocks that are not empty", () => {
    expect(light.size).toBeGreaterThan(20);
    expect(dark.size).toBeGreaterThan(20);
  });

  /** A var declared on one theme only inherits HeroUI's value, or nothing. */
  it("declares every light var in the dark block too", () => {
    const missing = [...light.keys()].filter((name) => !dark.has(name));
    expect(missing).toEqual([]);
  });

  it("declares no dark var the light block does not have", () => {
    const extra = [...dark.keys()].filter((name) => !light.has(name));
    expect(extra).toEqual([]);
  });

  /** `@theme` is emitted outside any theme selector, so a literal there can't be themed. */
  it("holds no colour literal in @theme", () => {
    const literals = [...theme]
      .filter(([, value]) => /oklch\(|#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i.test(value))
      .map(([name]) => name);
    expect(literals).toEqual([]);
  });

  /** index.html paints `--background` inline before the stylesheet loads; a
   * drifted copy flashes the old colour at launch. */
  it("keeps the pre-paint background in index.html on the same value", () => {
    const html = readFileSync(fileURLToPath(new URL("../../index.html", import.meta.url)), "utf8");
    const painted = /style\.background = dark \? "([^"]+)" : "([^"]+)"/.exec(html);

    expect(painted?.[1]).toBe(dark.get("--background"));
    expect(painted?.[2]).toBe(light.get("--background"));
  });
});
