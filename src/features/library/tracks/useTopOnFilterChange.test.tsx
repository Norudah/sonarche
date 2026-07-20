// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useTopOnFilterChange } from "@/features/library/tracks/useTopOnFilterChange";
import { ScrollportProvider } from "@/shared/ui/Scrollport";

afterEach(cleanup);

/** Renders the hook against a scrollport whose scrollTo is spied on. */
function setup(initialKey: string) {
  const scrollTo = vi.fn();

  function Probe({ filterKey }: { filterKey: string }) {
    useTopOnFilterChange(filterKey);
    return null;
  }

  function Harness({ filterKey }: { filterKey: string }) {
    const ref = useRef<HTMLElement | null>({ scrollTo } as unknown as HTMLElement);
    return (
      <ScrollportProvider value={ref}>
        <Probe filterKey={filterKey} />
      </ScrollportProvider>
    );
  }

  const view = render(<Harness filterKey={initialKey} />);
  return { scrollTo, rerender: (key: string) => view.rerender(<Harness filterKey={key} />) };
}

describe("useTopOnFilterChange", () => {
  it("does not scroll on mount", () => {
    const { scrollTo } = setup("");

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("scrolls to the top when the filter changes", () => {
    const { scrollTo, rerender } = setup("");

    rerender("nirvana");

    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
  });

  it("does not scroll when the filter is unchanged", () => {
    const { scrollTo, rerender } = setup("nirvana");

    rerender("nirvana");

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("scrolls again on each distinct change", () => {
    const { scrollTo, rerender } = setup("");

    rerender("nir");
    rerender("nirv");
    rerender("nirv");

    expect(scrollTo).toHaveBeenCalledTimes(2);
  });

  it("scrolls back to the top when the filter is cleared", () => {
    const { scrollTo, rerender } = setup("nirvana");

    rerender("");

    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
  });
});
