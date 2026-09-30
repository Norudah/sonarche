// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppearanceSection } from "@/features/settings/sections/AppearanceSection";
import { ThemeProvider } from "@/features/settings/ThemeContext";

/** Mounts the section with the root theme provider. */
function renderSection() {
  return render(
    <ThemeProvider>
      <AppearanceSection />
    </ThemeProvider>,
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

/** jsdom has no matchMedia; this stub lets a test flip the OS theme. */
function stubMatchMedia(prefersDark: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("dark") && prefersDark,
    media: query,
    addEventListener: (_: string, handler: (event: MediaQueryListEvent) => void) => listeners.add(handler),
    removeEventListener: (_: string, handler: (event: MediaQueryListEvent) => void) => listeners.delete(handler),
  }));

  return {
    flipTo(nowPrefersDark: boolean) {
      act(() => {
        for (const handler of listeners) handler({ matches: nowPrefersDark } as MediaQueryListEvent);
      });
    },
  };
}

/** react-aria's radio listens on the pointer sequence, not on a bare click, so
 * a `fireEvent.click` alone selects nothing. */
function pick(radio: HTMLElement) {
  fireEvent.pointerDown(radio, { pointerId: 1, pointerType: "mouse", button: 0 });
  fireEvent.pointerUp(radio, { pointerId: 1, pointerType: "mouse", button: 0 });
  fireEvent.click(radio);
}

/** i18next isn't initialised, so `t` echoes the keys used below. */
describe("AppearanceSection", () => {
  beforeEach(() => {
    stubMatchMedia(false);
  });

  it("applies the theme on the click and remembers it", async () => {
    renderSection();

    pick(screen.getByRole("radio", { name: /appearance.theme.dark/ }));

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem("sonarche.theme")).toBe("dark");
  });

  it("starts from the stored choice rather than the OS", () => {
    window.localStorage.setItem("sonarche.theme", "dark");
    stubMatchMedia(false);

    renderSection();

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("follows the OS when nothing has been chosen", () => {
    stubMatchMedia(true);

    renderSection();

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  /** An OS change repaints without changing the stored `system` choice. */
  it("repaints when the OS flips under a system choice", async () => {
    // Start from an explicit choice: clicking the selected segment fires nothing.
    window.localStorage.setItem("sonarche.theme", "dark");
    const media = stubMatchMedia(false);
    renderSection();

    pick(screen.getByRole("radio", { name: /appearance.theme.system/ }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    media.flipTo(true);

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem("sonarche.theme")).toBe("system");
  });

  it("keeps an explicit choice when the OS flips", async () => {
    const media = stubMatchMedia(false);
    renderSection();

    pick(screen.getByRole("radio", { name: /appearance.theme.light/ }));
    media.flipTo(true);

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
