// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeSettings, openSettings, selectSettingsCategory, useSettingsDialog } from "@/shared/lib/settingsDialog";

/** Module state, so every test starts by putting it back where it began. */
beforeEach(() => {
  closeSettings();
  selectSettingsCategory("appearance");
});

afterEach(cleanup);

describe("settingsDialog", () => {
  it("opens on the remembered category when none is named", () => {
    const { result } = renderHook(() => useSettingsDialog());

    act(() => selectSettingsCategory("services"));
    act(() => closeSettings());
    act(() => openSettings());

    expect(result.current).toEqual({ isOpen: true, category: "services" });
  });

  it("opens straight onto a named category", () => {
    const { result } = renderHook(() => useSettingsDialog());

    act(() => openSettings("updates"));

    expect(result.current).toEqual({ isOpen: true, category: "updates" });
  });

  /** Closing must not reset the pane: reopening lands where you left, which is
   * what makes the dialog cheap to dip in and out of. */
  it("keeps the category across a close", () => {
    const { result } = renderHook(() => useSettingsDialog());

    act(() => openSettings("danger"));
    act(() => closeSettings());

    expect(result.current).toEqual({ isOpen: false, category: "danger" });
  });

  it("notifies every subscriber when the category changes", () => {
    const first = renderHook(() => useSettingsDialog());
    const second = renderHook(() => useSettingsDialog());

    act(() => selectSettingsCategory("files"));

    expect(first.result.current.category).toBe("files");
    expect(second.result.current.category).toBe("files");
  });
});
