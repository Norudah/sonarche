/**
 * Parses the engine's rejection string (AppError's `Display`) into a typed
 * failure. The prefixes are shared with `src-tauri/src/error.rs`, and tests
 * on both sides pin them.
 */

/** Undecodable format (e.g. Opus, WMA); carries the extension to name it. */
interface UnsupportedFormat {
  kind: "unsupportedFormat";
  /** Lowercase, no dot; empty when the path had none. */
  extension: string;
}

/** Anything else (moved file, unplugged disk, corrupt stream): the user's
 * remedy is the same. */
interface Unreadable {
  kind: "unreadable";
}

export type PlaybackFailure = UnsupportedFormat | Unreadable;

/** `AppError::UnsupportedFormat`'s `Display` prefix. */
const UNSUPPORTED_PREFIX = "unsupported audio format: ";

export function classifyPlaybackError(error: unknown): PlaybackFailure {
  const message = typeof error === "string" ? error : error instanceof Error ? error.message : "";
  if (!message.startsWith(UNSUPPORTED_PREFIX)) return { kind: "unreadable" };

  return { kind: "unsupportedFormat", extension: extensionOf(message.slice(UNSUPPORTED_PREFIX.length)) };
}

/** Last path segment only; a leading dot is a hidden file, not an extension. */
function extensionOf(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}
