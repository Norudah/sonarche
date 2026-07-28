import { describe, expect, it } from "vitest";

import { updateStatus, type UpdateState } from "@/features/update/status";

const idle: UpdateState = {
  checking: false,
  installing: false,
  checkFailed: false,
  installFailed: false,
  available: undefined,
};

describe("updateStatus", () => {
  it("says nothing before the button has been pressed", () => {
    expect(updateStatus(idle)).toBeNull();
  });

  it("tells apart 'not checked' from 'checked, up to date'", () => {
    expect(updateStatus({ ...idle, available: null })).toEqual({ key: "upToDate", tone: "muted" });
  });

  it("carries the version through for interpolation", () => {
    expect(updateStatus({ ...idle, available: "0.10.0" })).toEqual({
      key: "version",
      tone: "success",
      version: "0.10.0",
    });
  });

  it("shows the install failure over the update that is still on offer", () => {
    // The mutation keeps its data after a failed install, so without the
    // ordering the pane would go back to announcing the version as if the
    // press had never happened.
    expect(updateStatus({ ...idle, available: "0.10.0", installFailed: true })).toEqual({
      key: "failedHint",
      tone: "danger",
    });
  });

  it("shows progress over a previous failure", () => {
    expect(updateStatus({ ...idle, checking: true, checkFailed: false })).toEqual({
      key: "checking",
      tone: "muted",
    });
    expect(updateStatus({ ...idle, available: "0.10.0", installing: true })).toEqual({
      key: "installing",
      tone: "muted",
    });
  });
});
