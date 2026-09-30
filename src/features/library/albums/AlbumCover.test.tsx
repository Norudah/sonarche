// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AlbumCover } from "@/features/library/albums/AlbumCover";

afterEach(cleanup);

/** `lazy` is a performance contract: a grid holds one cover per album. */
describe("AlbumCover", () => {
  it("defers loading when asked", () => {
    const { container } = render(<AlbumCover artUrl="/cover.jpg" className="size-full" loading="lazy" />);

    expect(container.querySelector("img")?.getAttribute("loading")).toBe("lazy");
  });

  it("loads eagerly by default", () => {
    const { container } = render(<AlbumCover artUrl="/cover.jpg" className="size-full" />);

    expect(container.querySelector("img")?.getAttribute("loading")).toBe("eager");
  });

  it("renders the fallback without an image when there is no cover", () => {
    const { container } = render(<AlbumCover artUrl={null} className="size-full" />);

    expect(container.querySelector("img")).toBeNull();
  });
});
