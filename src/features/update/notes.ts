/** Parses the release-please body into sections the UI can label, stripping
 * scope prefixes and commit links. */

export type SectionKind = "breaking" | "features" | "fixes" | "perf";

export interface NotesSection {
  /** Known headings; `null` keeps the original title. */
  kind: SectionKind | null;
  title: string;
  items: string[];
}

export interface ReleaseNotes {
  sections: NotesSection[];
}

const KINDS: [RegExp, SectionKind][] = [
  [/breaking/i, "breaking"],
  [/^features$/i, "features"],
  [/^bug fixes$/i, "fixes"],
  [/^performance/i, "perf"],
];

function stripLinks(text: string): string {
  return text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
}

/** Drops the commit ref, the `**scope:**` prefix and link targets; capitalises. */
function cleanItem(raw: string): string {
  let text = raw.trim();
  text = text.replace(/\s*\(\[[^\]]*\]\([^)]*\)\)\s*$/, "");
  text = text.replace(/^\*\*([^*]*?):?\*\*:?\s*/, "");
  text = stripLinks(text).trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** `null` when there are no bullets. */
export function parseReleaseNotes(body: string | null | undefined): ReleaseNotes | null {
  if (!body) return null;

  const sections: NotesSection[] = [];
  // Bullets before any heading go in an untitled section.
  let current: NotesSection | null = null;

  for (const line of body.split(/\r?\n/)) {
    const heading = /^#{1,4}\s+(.*)$/.exec(line.trim());
    if (heading) {
      const title = stripLinks(heading[1])
        // Not a character class: ⚠️ is a pair (U+26A0 U+FE0F), rejected by ESLint.
        .replace(/(?:⚠️?|\s)+/g, " ")
        .trim();
      // Skip release-please's version heading.
      if (/^\d+\.\d+\.\d+/.test(title)) continue;
      current = { kind: KINDS.find(([re]) => re.test(title))?.[1] ?? null, title, items: [] };
      sections.push(current);
      continue;
    }

    const bullet = /^\s*[*-]\s+(.*)$/.exec(line);
    if (!bullet) continue;
    const item = cleanItem(bullet[1]);
    if (!item) continue;
    if (!current) {
      current = { kind: null, title: "", items: [] };
      sections.push(current);
    }
    current.items.push(item);
  }

  const kept = sections.filter((section) => section.items.length > 0);
  if (kept.length === 0) return null;
  return { sections: kept };
}
