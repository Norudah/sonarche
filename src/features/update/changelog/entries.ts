import { parseChangelogEntry, type ChangelogEntry } from "@/features/update/changelog/parse";

/**
 * The changelog, bundled with the app rather than fetched.
 *
 * Bundling is what makes "show me what changed" answerable at all. The release
 * body only ever reaches the app inside `latest.json`, which the updater reads
 * exactly when a *newer* version exists — so an up-to-date app has no text to
 * show, and the repo being private rules out asking GitHub for it. Reading the
 * notes off disk turns them from an argument for installing into something the
 * app simply knows about itself, offline, whenever asked.
 *
 * Authored in `changelog/` at the repo root and not under `src/`: these are
 * release copy, written alongside the Release PR by whoever cuts the version,
 * and one day read by the site — none of which is frontend source.
 */

/** `changelog/<version>.<lang>.md`. Anything else in the folder (the authoring
 * notes, a stray draft) fails this and is skipped rather than half-parsed. */
const FILE_NAME = /\/(\d+\.\d+\.\d+)\.([a-z]{2})\.md$/;

const FILES = import.meta.glob("/changelog/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

/** Bundled, hashed URLs for the screenshots — `img-src 'self'`, so they must
 * come through the bundler rather than being read off disk at runtime. */
const MEDIA = import.meta.glob("/changelog/media/*", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

/** Newest first. Numeric per segment, so 2.10.0 sorts above 2.9.0 — the
 * lexicographic order every hand-rolled version list gets wrong. */
export function compareVersionsDesc(a: string, b: string): number {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return right[index] - left[index];
  }
  return 0;
}

function load(): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  for (const [path, raw] of Object.entries(FILES)) {
    const name = FILE_NAME.exec(path);
    if (!name) continue;
    const entry = parseChangelogEntry(raw, name[1], name[2]);
    if (entry) entries.push(entry);
  }
  return entries.sort((a, b) => compareVersionsDesc(a.version, b.version));
}

const ENTRIES = load();

/**
 * One entry per version, in the closest language to the one asked for.
 *
 * A version written in one language only still shows up, in that language: a
 * release note the reader can mostly follow beats a gap where a version used to
 * be, and the alternative — refusing to show anything until every file is
 * translated — silently drops history.
 */
export function changelogEntries(language: string): ChangelogEntry[] {
  const wanted = language.split("-")[0].toLowerCase();
  const byVersion = new Map<string, ChangelogEntry>();

  for (const entry of ENTRIES) {
    const held = byVersion.get(entry.version);
    if (held == null || (held.language !== wanted && entry.language === wanted)) byVersion.set(entry.version, entry);
  }

  return [...byVersion.values()];
}

/** The screenshot's bundled URL, or `null` when the file it names is not
 * there — a broken image in a release note is worse than no image. */
export function changelogMedia(src: string): string | null {
  return MEDIA[`/changelog/${src.replace(/^\.?\//, "")}`] ?? null;
}
