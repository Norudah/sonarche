/**
 * The public website, for the few places the app hands over to it. French is
 * the site's root locale and English lives under `/en` — the same rule its
 * router follows, so a link built here lands on the reader's own language.
 *
 * Every URL built here must stay inside what `opener:allow-open-url` permits
 * in `src-tauri/capabilities/default.json`.
 */
export const SITE_URL = "https://sonarche.org";

/** The how-to-use-the-app section, in the app's current language. */
export function guideUrl(language: string): string {
  return language.startsWith("fr") ? `${SITE_URL}/guide` : `${SITE_URL}/en/guide`;
}
