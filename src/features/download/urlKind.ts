export type DetectedUrlKind = "single" | "album" | "mixed" | null;

/** Offline URL classification: single video, playlist, or a video opened from
 * a playlist (mixed: the UI asks). Radio/mix lists (RD…, UL…) are ignored. */
export function detectUrlKind(raw: string): DetectedUrlKind {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, "");
  if (host !== "youtube.com" && host !== "youtu.be") return null;

  const list = url.searchParams.get("list");
  const realList = list != null && !/^(RD|UL)/.test(list);
  if (url.pathname === "/playlist") return realList ? "album" : null;

  const isWatch = url.pathname === "/watch" || host === "youtu.be";
  if (isWatch) return realList ? "mixed" : "single";
  return null;
}
