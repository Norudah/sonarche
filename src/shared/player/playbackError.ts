/**
 * What went wrong when the engine refused a file, in terms the interface can
 * speak.
 *
 * A Tauri command rejects with `AppError`'s `Display` string and nothing else,
 * so the wire carries a sentence rather than a code. Reading that sentence is a
 * boundary job: it happens once, here, and the rest of the front works with the
 * union below. The prefixes are the contract — `src-tauri/src/error.rs` holds
 * the other end of it, and a test on each side pins the pair.
 */

/** The engine cannot decode this file at all — an Opus or WMA track from an
 * imported library. Carries the extension because naming the format is the
 * difference between a message that explains and one that only regrets. */
interface UnsupportedFormat {
  kind: "unsupportedFormat";
  /** Lowercase, no dot. Empty when the path had no extension to read. */
  extension: string;
}

/** Anything else: the file moved, the disc is unplugged, the stream is corrupt.
 * One case rather than several, because the user's move is the same for all of
 * them and inventing distinctions we cannot act on would only add words. */
interface Unreadable {
  kind: "unreadable";
}

export type PlaybackFailure = UnsupportedFormat | Unreadable;

/** The `Display` prefix of `AppError::UnsupportedFormat`. */
const UNSUPPORTED_PREFIX = "unsupported audio format: ";

export function classifyPlaybackError(error: unknown): PlaybackFailure {
  const message = typeof error === "string" ? error : error instanceof Error ? error.message : "";
  if (!message.startsWith(UNSUPPORTED_PREFIX)) return { kind: "unreadable" };

  return { kind: "unsupportedFormat", extension: extensionOf(message.slice(UNSUPPORTED_PREFIX.length)) };
}

/** The extension of a path, lowercased and undotted. A dot in a directory name
 * must not be mistaken for one: only the last segment is looked at, and a
 * leading dot there is a hidden file, not an extension. */
function extensionOf(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}
