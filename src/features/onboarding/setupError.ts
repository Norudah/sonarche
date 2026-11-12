/** A failed engine install, told in plain words when the cause is one we
 * can name. `setup_env`'s own error only says which step failed ("pip
 * install failed (exit 1)"); the reason is in the streamed log. */

type SetupErrorCause = "diskFull" | "permission" | "network";

export interface SetupErrorReport {
  /** `null`: no known pattern, only the raw line is shown. */
  cause: SetupErrorCause | null;
  /** The most telling raw line, shown as is under the explanation. */
  line: string;
}

// Python (`[Errno 28]`) and Rust io (`os error 28`) word errno the same way.
const PATTERNS: readonly { cause: SetupErrorCause; pattern: RegExp }[] = [
  { cause: "diskFull", pattern: /Errno 28\]|os error 28|No space left on device/i },
  { cause: "permission", pattern: /Errno 13\]|os error 13|Permission denied/i },
  {
    cause: "network",
    pattern:
      /Failed to establish a new connection|Could not fetch URL|Temporary failure in name resolution|Network is unreachable|ConnectionError|ReadTimeoutError/i,
  },
];

export function describeSetupError(
  error: string,
  logs: readonly string[],
  /** Wheels ship with the app: pip never touches the network, so a
   * connection message can't be the cause. */
  { offline }: { offline: boolean },
): SetupErrorReport {
  const lines = [...logs.map((line) => line.trim()).filter(Boolean), error.trim()].reverse();

  for (const { cause, pattern } of PATTERNS) {
    if (cause === "network" && offline) continue;
    const line = lines.find((candidate) => pattern.test(candidate));
    if (line) return { cause, line };
  }

  const pipError = lines.find((line) => line.startsWith("ERROR"));
  return { cause: null, line: pipError ?? error.trim() };
}
