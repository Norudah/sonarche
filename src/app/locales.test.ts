import { describe, expect, it } from "vitest";

/** `tsc` checks keys against the English catalogues only: a key missing from
 * a French one would silently fall back to English at runtime. */

type Catalogue = Record<string, unknown>;

const files = import.meta.glob<Catalogue>("/src/**/locales/*.json", { eager: true, import: "default" });

/** Plural forms vary by language (French adds `_many`), so they count as one key. */
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

/** Leaf key → its `{{placeholders}}`, sorted; arrays are leaves. */
function leaves(node: Catalogue, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(node)) {
    const path = prefix + key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      for (const [child, vars] of leaves(value as Catalogue, `${path}.`)) out.set(child, vars);
    } else {
      const vars = [...JSON.stringify(value).matchAll(/\{\{\s*(\w+)/g)].map((match) => match[1]);
      const base = path.replace(PLURAL_SUFFIX, "");
      // Plural forms may drop `{{count}}` ("one track"); merge what they use.
      const merged = new Set([...(out.get(base)?.split(",").filter(Boolean) ?? []), ...vars]);
      out.set(base, [...merged].sort().join(","));
    }
  }
  return out;
}

const pairs = Object.keys(files)
  .filter((path) => path.endsWith("/en.json"))
  .map((en) => ({
    dir: en.slice(0, -"/en.json".length),
    en: files[en],
    fr: files[en.replace(/en\.json$/, "fr.json")],
  }));

describe("locale catalogues", () => {
  it("finds every namespace", () => {
    expect(pairs.length).toBeGreaterThanOrEqual(9);
  });

  it.each(pairs)("$dir has a French twin with the same keys and placeholders", ({ en, fr }) => {
    expect(fr).toBeDefined();
    const english = leaves(en);
    const french = leaves(fr);
    expect([...french.keys()].sort()).toEqual([...english.keys()].sort());
    for (const [key, vars] of english) expect({ key, vars: french.get(key) }).toEqual({ key, vars });
  });
});
