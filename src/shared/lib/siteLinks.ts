/** The public website. French at the root, English under `/en`. URLs must stay
 * within `opener:allow-open-url` in `src-tauri/capabilities/default.json`. */
export const SITE_URL = "https://sonarche.org";

export function guideUrl(language: string): string {
  return language.startsWith("fr") ? `${SITE_URL}/guide` : `${SITE_URL}/en/guide`;
}
