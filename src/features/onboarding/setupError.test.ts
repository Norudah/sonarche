import { describe, expect, it } from "vitest";

import { describeSetupError } from "@/features/onboarding/setupError";

const PIP_FAILED = "setup failed: pip install failed (exit exit status: 1)";
const ONLINE = { offline: false };
const OFFLINE = { offline: true };

describe("describeSetupError", () => {
  it("finds a full disk in pip's log, where the real reason lives", () => {
    const logs = [
      "Collecting beets==2.12.0",
      "ERROR: Could not install packages due to an OSError: [Errno 28] No space left on device",
    ];
    expect(describeSetupError(PIP_FAILED, logs, OFFLINE)).toEqual({ cause: "diskFull", line: logs[1] });
  });

  it("reads a full disk from Rust's own io error", () => {
    const error = "No space left on device (os error 28)";
    expect(describeSetupError(error, [], OFFLINE)).toEqual({ cause: "diskFull", line: error });
  });

  it("names a permission problem", () => {
    const logs = ["Error: [Errno 13] Permission denied: '/Users/me/Library/Application Support/sonarche/venv'"];
    expect(describeSetupError("setup failed: venv creation failed (exit 1)", logs, OFFLINE).cause).toBe("permission");
  });

  it("blames the network only when pip had to use it", () => {
    const logs = [
      "WARNING: Retrying after connection broken by 'NewConnectionError(Failed to establish a new connection)'",
    ];
    expect(describeSetupError(PIP_FAILED, logs, ONLINE).cause).toBe("network");
    expect(describeSetupError(PIP_FAILED, logs, OFFLINE).cause).toBeNull();
  });

  it("keeps the last pip error as the raw line when the cause is unknown", () => {
    const logs = [
      "ERROR: Could not find a version that satisfies the requirement beets==9.9",
      "ERROR: No matching distribution found for beets==9.9",
    ];
    expect(describeSetupError(PIP_FAILED, logs, OFFLINE)).toEqual({ cause: null, line: logs[1] });
  });

  it("falls back to the error itself", () => {
    expect(describeSetupError(PIP_FAILED, ["Collecting beets==2.12.0"], OFFLINE)).toEqual({
      cause: null,
      line: PIP_FAILED,
    });
  });
});
