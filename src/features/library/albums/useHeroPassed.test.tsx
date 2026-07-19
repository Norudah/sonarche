// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { useRef } from "react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useHeroPassed } from "@/features/library/albums/useHeroPassed";
import { ScrollportProvider } from "@/shared/ui/Scrollport";

/**
 * One fake observer, driving intersection by hand. What is under test is when
 * the hook manages to observe anything at all — not the browser's geometry.
 */
let observed: Element[] = [];
let emit: (isIntersecting: boolean) => void;
let disconnects = 0;

beforeEach(() => {
  observed = [];
  disconnects = 0;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        emit = (isIntersecting) => act(() => callback([{ isIntersecting }]));
      }
      observe(element: Element) {
        observed.push(element);
      }
      disconnect() {
        disconnects += 1;
      }
      unobserve() {}
      takeRecords() {
        return [];
      }
    },
  );
});

// Vitest globals are off, so testing-library's auto-cleanup never registers —
// without this the previous test's DOM is still mounted and queries match twice.
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * Mirrors the album page: a loading state with no hero, then the hero once the
 * library resolves. The scrollport ref is empty here, which is fine — a null
 * root just means the viewport, and nothing in this test depends on geometry.
 */
function Page({ hasHero }: { hasHero: boolean }) {
  const { ref, passed } = useHeroPassed<HTMLElement>();

  return (
    <>
      <span data-testid="passed">{String(passed)}</span>
      {hasHero && <header ref={ref}>hero</header>}
    </>
  );
}

function Subject({ hasHero }: { hasHero: boolean }) {
  const scrollport = useRef<HTMLElement>(null);

  return (
    <ScrollportProvider value={scrollport}>
      <Page hasHero={hasHero} />
    </ScrollportProvider>
  );
}

describe("useHeroPassed", () => {
  it("observes the element when it only appears on a later render", () => {
    // The regression this exists for: the album page renders a spinner first,
    // so a ref read once in an effect finds nothing and never looks again.
    const { rerender } = render(<Subject hasHero={false} />);
    expect(observed).toHaveLength(0);

    rerender(<Subject hasHero />);
    expect(observed).toHaveLength(1);
    expect(observed[0].tagName).toBe("HEADER");
  });

  it("reports passed once the element stops intersecting", () => {
    const { getByTestId } = render(<Subject hasHero />);
    expect(getByTestId("passed").textContent).toBe("false");

    emit(false);
    expect(getByTestId("passed").textContent).toBe("true");

    emit(true);
    expect(getByTestId("passed").textContent).toBe("false");
  });

  it("disconnects when the element goes away", () => {
    const { rerender } = render(<Subject hasHero />);
    rerender(<Subject hasHero={false} />);
    expect(disconnects).toBe(1);
  });
});
