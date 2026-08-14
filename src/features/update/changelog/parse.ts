/**
 * The hand-written changelog, parsed out of the Markdown it is authored in.
 *
 * Two changelogs live side by side and neither replaces the other. The
 * generated one (release-please, `CHANGELOG.md`) is the repo's inventory:
 * exhaustive, English, one line per commit. This one is the app's story —
 * written for whoever uses Sonarche, in their language, with screenshots when
 * a picture says it faster. `notes.ts` reads the first; this reads the second.
 *
 * Deliberately not a Markdown library. The dialect is ours and it is four
 * constructs wide (heading, paragraph, bullet list, image), which is a hundred
 * lines here against a parser-plus-renderer dependency and the sanitising that
 * comes with rendering arbitrary HTML. Anything outside the dialect is dropped
 * rather than passed through — nothing authored here ever becomes markup.
 */

export interface ChangelogImage {
  /** The `media/…` path as written, still to be resolved to a bundled URL. */
  src: string;
  /** Doubles as the caption when there is one — an image worth a screenshot is
   * an image worth a sentence, so the two are never written separately. */
  alt: string;
}

export type ChangelogBlock =
  { kind: "text"; text: string } | { kind: "list"; items: string[] } | ({ kind: "image" } & ChangelogImage);

export interface ChangelogSection {
  /** `null` for the blocks that open the entry, before any `##`. */
  title: string | null;
  blocks: ChangelogBlock[];
}

export interface ChangelogEntry {
  version: string;
  /** The language this file was written in, from its name — not a translation
   * key: these are prose, and a missing one falls back to another file rather
   * than to a placeholder. */
  language: string;
  /** `YYYY-MM-DD` from the front matter, `null` when unstated. Kept as the
   * written string and formatted at the last moment through `Intl`. */
  date: string | null;
  /** The `#` heading — the version's headline. `null` falls back to its
   * number, which is never wrong, only dull. */
  title: string | null;
  sections: ChangelogSection[];
}

/** One run of text and how it is marked — the two inline marks the dialect has.
 * Returned as data rather than HTML so the renderer stays a React tree and no
 * authored string is ever fed to `dangerouslySetInnerHTML`. */
export interface TextSpan {
  text: string;
  mark: "plain" | "bold" | "code";
}

const FRONT_MATTER_FENCE = /^---\s*$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^\s*[*-]\s+(.*)$/;
const IMAGE = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/;
const KEY_VALUE = /^([a-z][\w-]*)\s*:\s*(.*)$/i;

/** `**bold**` and `` `code` `` split out of the surrounding prose, in order. An
 * unclosed marker is text like any other: an author's typo must not swallow the
 * rest of the paragraph. */
export function inlineSpans(text: string): TextSpan[] {
  const spans: TextSpan[] = [];
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let cursor = 0;

  for (let match = pattern.exec(text); match != null; match = pattern.exec(text)) {
    if (match.index > cursor) spans.push({ text: text.slice(cursor, match.index), mark: "plain" });
    spans.push(match[1] != null ? { text: match[1], mark: "bold" } : { text: match[2], mark: "code" });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) spans.push({ text: text.slice(cursor), mark: "plain" });

  return spans;
}

/** The `key: value` block between the opening fences, and the line the body
 * starts on. No fence means no front matter and a body starting at zero. */
function readFrontMatter(lines: string[]): { fields: Map<string, string>; start: number } {
  const fields = new Map<string, string>();
  if (!FRONT_MATTER_FENCE.test(lines[0] ?? "")) return { fields, start: 0 };

  for (let index = 1; index < lines.length; index += 1) {
    if (FRONT_MATTER_FENCE.test(lines[index])) return { fields, start: index + 1 };
    const pair = KEY_VALUE.exec(lines[index].trim());
    if (pair) fields.set(pair[1].toLowerCase(), pair[2].trim());
  }
  // Unterminated: treat the whole file as front matter rather than rendering
  // the fence and the fields as prose.
  return { fields, start: lines.length };
}

/**
 * One authored file into the entry the app draws.
 *
 * `version` and `language` are the caller's, not the file's: they come from its
 * name, which is the one place they cannot drift from where the file is looked
 * up. `null` when the file holds nothing to show — an empty file, or one whose
 * every line fell outside the dialect.
 */
export function parseChangelogEntry(raw: string, version: string, language: string): ChangelogEntry | null {
  const lines = raw.split(/\r?\n/);
  const { fields, start } = readFrontMatter(lines);

  const sections: ChangelogSection[] = [];
  let title: string | null = null;
  let current: ChangelogSection = { title: null, blocks: [] };
  let paragraph: string[] = [];
  let list: string[] = [];

  const flush = () => {
    if (paragraph.length > 0) current.blocks.push({ kind: "text", text: paragraph.join(" ") });
    if (list.length > 0) current.blocks.push({ kind: "list", items: list });
    paragraph = [];
    list = [];
  };

  const closeSection = () => {
    flush();
    if (current.title != null || current.blocks.length > 0) sections.push(current);
  };

  for (const line of lines.slice(start)) {
    const text = line.trim();

    if (text === "") {
      flush();
      continue;
    }

    const heading = HEADING.exec(text);
    if (heading) {
      // The first `#` is the entry's headline and opens nothing; deeper ones
      // are all sections, so an author reaching for `###` still gets a break
      // rather than a line that silently vanishes.
      if (heading[1] === "#" && title == null) {
        flush();
        title = heading[2].trim();
        continue;
      }
      closeSection();
      current = { title: heading[2].trim(), blocks: [] };
      continue;
    }

    const image = IMAGE.exec(text);
    if (image) {
      flush();
      current.blocks.push({ kind: "image", alt: image[1].trim(), src: image[2].trim() });
      continue;
    }

    const bullet = BULLET.exec(text);
    if (bullet) {
      // A list interrupts a paragraph but not the other way round: the bullets
      // keep piling up until a blank line or a block of another kind.
      if (paragraph.length > 0) flush();
      list.push(bullet[1].trim());
      continue;
    }

    if (list.length > 0) flush();
    paragraph.push(text);
  }

  closeSection();

  if (title == null && sections.length === 0) return null;

  const date = fields.get("date") ?? null;
  return { version, language, date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null, title, sections };
}
