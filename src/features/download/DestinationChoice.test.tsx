// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DestinationChoice, toForcedAlbum } from "@/features/download/DestinationChoice";

afterEach(cleanup);

/** The `new` mode's artist field suggests names from the library, so the tree
 * needs a QueryClient — one per render, queries left unresolved on purpose. */
function renderWithQueries(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

/**
 * The mapping decides whether a download rewrites where every one of its
 * tracks is filed, so what it reports has to be exact: null is "leave the
 * pipeline alone", and anything else is a promise to overwrite.
 */
describe("toForcedAlbum", () => {
  it("leaves the pipeline alone on automatic", () => {
    expect(toForcedAlbum({ mode: "auto" })).toBeNull();
  });

  it("treats a blank answer as automatic, not as a rejected download", () => {
    expect(toForcedAlbum({ mode: "existing", target: null })).toBeNull();
    expect(toForcedAlbum({ mode: "new", title: "   ", artist: "Hans Zimmer" })).toBeNull();
  });

  it("carries the picked row's id and its display words", () => {
    expect(
      toForcedAlbum({ mode: "existing", target: { albumId: 12, title: "Inception", artist: "Hans Zimmer" } }),
    ).toEqual({ title: "Inception", artist: "Hans Zimmer", albumId: 12 });
  });

  it("trims a new album and reads an emptied artist as none", () => {
    expect(toForcedAlbum({ mode: "new", title: " Tron ", artist: "  " })).toEqual({
      title: "Tron",
      artist: null,
    });
  });
});

describe("DestinationChoice", () => {
  it("shows no fields until a forcing mode is chosen", () => {
    render(<DestinationChoice value={{ mode: "auto" }} kind="album" onChange={() => {}} />);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("opens each mode on a blank answer rather than a half-filled guess", () => {
    const onChange = vi.fn();
    render(<DestinationChoice value={{ mode: "auto" }} kind="album" onChange={onChange} />);

    fireEvent.click(screen.getAllByRole("radio")[1]);
    expect(onChange).toHaveBeenCalledWith({ mode: "existing", target: null });

    fireEvent.click(screen.getAllByRole("radio")[2]);
    expect(onChange).toHaveBeenCalledWith({ mode: "new", title: "", artist: null });
  });

  it("reports the new album's title as it is typed", () => {
    const onChange = vi.fn();
    renderWithQueries(
      <DestinationChoice value={{ mode: "new", title: "", artist: null }} kind="album" onChange={onChange} />,
    );

    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "Inception" } });

    expect(onChange).toHaveBeenCalledWith({ mode: "new", title: "Inception", artist: null });
  });
});
