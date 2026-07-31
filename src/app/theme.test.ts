import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// Read off disk rather than imported: vitest stubs CSS modules out to an empty
// string, `?raw` included, so importing the stylesheet gives nothing to parse.
const css = readFileSync(fileURLToPath(new URL("./theme.css", import.meta.url)), "utf8");

/**
 * The two guardrails that keep the theme layer swappable.
 *
 * Both failures this covers are silent in the browser — nothing throws, the
 * page just comes out wrong, and only on the theme nobody had open at the
 * time. They are cheap to assert and expensive to notice by eye, which is
 * exactly what a test is for.
 *
 * The parsing helpers stay here rather than in a shared lib: theme.css is
 * their only subject, and this file is their only consumer.
 */

/** Comments first, always: they quote declarations (`--color-accent:
 * var(--accent)`) that would otherwise parse as real ones. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * The body of the block whose selector *starts a line*, brace-balanced so a
 * nested block (the `@keyframes` living inside `@theme`) does not end it early.
 *
 * Anchored to the line start because `[data-theme="dark"]` also appears inside
 * the light theme's own selector, as the `:not()` that keeps it from leaking.
 */
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

  /**
   * A raw var declared on one theme only keeps whatever the other theme
   * inherited — HeroUI's value if it owns the name, and an invalid property if
   * it does not (nothing outside this file defines `--family-metal`). Either
   * way the surface using it is wrong on that theme and right on the other,
   * which is the hardest kind of bug to see.
   */
  it("declares every light var in the dark block too", () => {
    const missing = [...light.keys()].filter((name) => !dark.has(name));
    expect(missing).toEqual([]);
  });

  it("declares no dark var the light block does not have", () => {
    const extra = [...dark.keys()].filter((name) => !light.has(name));
    expect(extra).toEqual([]);
  });

  /**
   * A colour written straight into `@theme` is frozen: `@theme` is emitted once,
   * outside any theme selector, so no `[data-theme]` block can reach it. It has
   * to be `var(--raw)` with the literal living in the two theme blocks — which
   * is how `bg-panel` and `bg-tray` stayed white on the dark theme.
   */
  it("holds no colour literal in @theme", () => {
    const literals = [...theme]
      .filter(([, value]) => /oklch\(|#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i.test(value))
      .map(([name]) => name);
    expect(literals).toEqual([]);
  });

  /**
   * `index.html` paints the window `--background` inline, before this
   * stylesheet exists — that is the whole point, and it means the value has to
   * be written out a second time. The copy is invisible when it drifts: the
   * launch simply flashes the old colour for a frame, on one theme, which is
   * exactly the bug the inline block was added to remove.
   */
  it("keeps the pre-paint background in index.html on the same value", () => {
    const html = readFileSync(fileURLToPath(new URL("../../index.html", import.meta.url)), "utf8");
    const painted = /style\.background = dark \? "([^"]+)" : "([^"]+)"/.exec(html);

    expect(painted?.[1]).toBe(dark.get("--background"));
    expect(painted?.[2]).toBe(light.get("--background"));
  });
});
