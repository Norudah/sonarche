// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AlbumCover } from "@/features/library/albums/AlbumCover";

afterEach(cleanup);

/**
 * The loading mode is a performance contract, not decoration: a library-wide
 * grid holds one cover per album, and dropping `lazy` puts every one of them
 * on the wire at once.
 */
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
