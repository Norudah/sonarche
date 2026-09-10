// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearSettingsHighlight,
  closeSettings,
  openSettings,
  revealSetting,
  selectSettingsCategory,
  useSettingsDialog,
} from "@/shared/lib/settingsDialog";

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

    expect(result.current).toEqual({ isOpen: true, category: "services", highlight: null });
  });

  it("opens straight onto a named category", () => {
    const { result } = renderHook(() => useSettingsDialog());

    act(() => openSettings("updates"));

    expect(result.current).toEqual({ isOpen: true, category: "updates", highlight: null });
  });

  /** Closing must not reset the pane: reopening lands where you left, which is
   * what makes the dialog cheap to dip in and out of. */
  it("keeps the category across a close", () => {
    const { result } = renderHook(() => useSettingsDialog());

    act(() => openSettings("danger"));
    act(() => closeSettings());

    expect(result.current).toEqual({ isOpen: false, category: "danger", highlight: null });
  });

  /** The pane a search result asks for, and the ring on the setting itself.
   * Picking a category by hand clears it: you are no longer following a
   * pointer. */
  it("reveals a setting, and drops the pointer on the next hand-picked pane", () => {
    const { result } = renderHook(() => useSettingsDialog());

    act(() => revealSetting("adding", "adding.delay"));
    expect(result.current).toEqual({ isOpen: true, category: "adding", highlight: "adding.delay" });

    act(() => selectSettingsCategory("files"));
    expect(result.current.highlight).toBeNull();
  });

  it("clears the highlight once the ring has been seen", () => {
    const { result } = renderHook(() => useSettingsDialog());

    act(() => revealSetting("danger", "danger.erase"));
    act(() => clearSettingsHighlight());

    expect(result.current).toEqual({ isOpen: true, category: "danger", highlight: null });
  });

  it("notifies every subscriber when the category changes", () => {
    const first = renderHook(() => useSettingsDialog());
    const second = renderHook(() => useSettingsDialog());

    act(() => selectSettingsCategory("files"));

    expect(first.result.current.category).toBe("files");
    expect(second.result.current.category).toBe("files");
  });
});
