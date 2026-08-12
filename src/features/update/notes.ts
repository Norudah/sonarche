/**
 * What the release body says, translated out of changelog-speak.
 *
 * `latest.json` carries the GitHub release body: release-please's generated
 * changelog — English commit subjects, scope prefixes, a commit link on every
 * line. Accurate, and unreadable for anyone who does not live in the repo.
 * This parser is the app's side of a two-part deal: the release editor may add
 * a hand-written `### En bref` section on the release PR before merging, and
 * the app shows that section as the story, with the generated lines cleaned up
 * underneath. When the hand-written part is missing, the cleaned lines are the
 * whole story — worse, but never empty for the wrong reason.
 */

export type SectionKind = "breaking" | "features" | "fixes" | "perf";

export interface NotesSection {
  /** Known release-please headings, mapped so the UI can translate them;
   * `null` keeps the heading as written. */
  kind: SectionKind | null;
  title: string;
  items: string[];
}

export interface ReleaseNotes {
  /** The hand-written `En bref` / `Highlights` bullets, when the release
   * editor wrote them. */
  highlights: string[];
  sections: NotesSection[];
}

const KINDS: [RegExp, SectionKind][] = [
  [/breaking/i, "breaking"],
  [/^features$/i, "features"],
  [/^bug fixes$/i, "fixes"],
  [/^performance/i, "perf"],
];

const HIGHLIGHTS = /^(en bref|highlights)$/i;

/** `[text](url)` → `text`, wherever it appears in a line. */
function stripLinks(text: string): string {
  return text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
}

/** One changelog bullet, made readable: the trailing commit ref goes, the
 * `**scope:**` prefix goes (repo vocabulary, not user vocabulary), remaining
 * links keep their text, and the sentence starts with a capital. */
function cleanItem(raw: string): string {
  let text = raw.trim();
  text = text.replace(/\s*\(\[[^\]]*\]\([^)]*\)\)\s*$/, "");
  text = text.replace(/^\*\*([^*]*?):?\*\*:?\s*/, "");
  text = stripLinks(text).trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * `null` when there is nothing worth a modal: no body, or a body with no
 * bullets (tauri-action's placeholder sentence, an empty release). The caller
 * falls back to the plain install offer.
 */
export function parseReleaseNotes(body: string | null | undefined): ReleaseNotes | null {
  if (!body) return null;

  const highlights: string[] = [];
  const sections: NotesSection[] = [];
  // Bullets before any heading land in a synthetic section with no title.
  let current: NotesSection | null = null;
  let inHighlights = false;

  for (const line of body.split(/\r?\n/)) {
    const heading = /^#{1,4}\s+(.*)$/.exec(line.trim());
    if (heading) {
      const title = stripLinks(heading[1])
        // Not a character class: the warning sign is a combining pair (U+26A0
        // U+FE0F) and ESLint rejects it inside brackets.
        .replace(/(?:⚠️?|\s)+/g, " ")
        .trim();
      // The version heading release-please opens with ("1.2.0 (2026-08-12)").
      if (/^\d+\.\d+\.\d+/.test(title)) continue;
      inHighlights = HIGHLIGHTS.test(title);
      if (inHighlights) {
        current = null;
        continue;
      }
      current = { kind: KINDS.find(([re]) => re.test(title))?.[1] ?? null, title, items: [] };
      sections.push(current);
      continue;
    }

    const bullet = /^\s*[*-]\s+(.*)$/.exec(line);
    if (!bullet) continue;
    const item = cleanItem(bullet[1]);
    if (!item) continue;
    if (inHighlights) {
      highlights.push(item);
    } else {
      if (!current) {
        current = { kind: null, title: "", items: [] };
        sections.push(current);
      }
      current.items.push(item);
    }
  }

  const kept = sections.filter((section) => section.items.length > 0);
  if (highlights.length === 0 && kept.length === 0) return null;
  return { highlights, sections: kept };
}
