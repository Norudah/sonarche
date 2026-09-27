// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { parseToggle, storedToggle, useStoredToggle } from "@/shared/lib/storedToggle";

afterEach(() => window.localStorage.clear());

describe("parseToggle", () => {
  it("is on until somebody turns it off", () => {
    expect(parseToggle(null)).toBe(true);
    expect(parseToggle(undefined)).toBe(true);
    expect(parseToggle("on")).toBe(true);
  });

  it("is off only on the exact stored word", () => {
    expect(parseToggle("off")).toBe(false);
  });

  /** Unknown values (older builds, hand edits) keep the default. */
  it("treats anything it does not recognise as on", () => {
    expect(parseToggle("")).toBe(true);
    expect(parseToggle("false")).toBe(true);
    expect(parseToggle("OFF")).toBe(true);
  });
});

describe("storedToggle", () => {
  it("round-trips through localStorage under its own key", () => {
    const toggle = storedToggle("test.toggle");
    toggle.store(false);
    expect(window.localStorage.getItem("test.toggle")).toBe("off");
    expect(toggle.read()).toBe(false);
    expect(storedToggle("test.other").read()).toBe(true);
  });

  it("updates subscribed components live", () => {
    const toggle = storedToggle("test.live");
    const { result } = renderHook(() => useStoredToggle(toggle));
    expect(result.current).toBe(true);
    act(() => toggle.store(false));
    expect(result.current).toBe(false);
  });
});
