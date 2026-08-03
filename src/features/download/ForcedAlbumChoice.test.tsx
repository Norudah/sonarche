// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ForcedAlbumChoice } from "@/features/download/ForcedAlbumChoice";

afterEach(cleanup);

/**
 * The toggle decides whether a download rewrites where every one of its tracks
 * is filed, so what it reports back has to be exact: null is "leave the
 * pipeline alone", and anything else is a promise to overwrite.
 */
describe("ForcedAlbumChoice", () => {
  it("hides the fields until the toggle is on", () => {
    const { rerender } = render(<ForcedAlbumChoice value={null} onChange={() => {}} />);
    expect(screen.queryByRole("textbox")).toBeNull();

    rerender(<ForcedAlbumChoice value={{ title: "", artist: null }} onChange={() => {}} />);
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
  });

  it("opens on an empty album rather than a half-filled guess", () => {
    const onChange = vi.fn();
    render(<ForcedAlbumChoice value={null} onChange={onChange} />);

    fireEvent.click(screen.getByRole("switch"));

    expect(onChange).toHaveBeenCalledWith({ title: "", artist: null });
  });

  it("gives the pipeline its album back when switched off", () => {
    const onChange = vi.fn();
    render(<ForcedAlbumChoice value={{ title: "Inception", artist: null }} onChange={onChange} />);

    fireEvent.click(screen.getByRole("switch"));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("reports the title as it is typed", () => {
    const onChange = vi.fn();
    render(<ForcedAlbumChoice value={{ title: "", artist: null }} onChange={onChange} />);

    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "Inception" } });

    expect(onChange).toHaveBeenCalledWith({ title: "Inception", artist: null });
  });

  it("reads an emptied artist as none, so the sidecar's default applies", () => {
    const onChange = vi.fn();
    render(<ForcedAlbumChoice value={{ title: "Tron", artist: "Daft Punk" }} onChange={onChange} />);

    fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "" } });

    expect(onChange).toHaveBeenCalledWith({ title: "Tron", artist: null });
  });

  it("offers nothing to fill on a single track, and says why", () => {
    render(<ForcedAlbumChoice value={{ title: "Inception", artist: null }} isDisabled onChange={() => {}} />);

    // The switch is unreachable and the fields are gone: a forced album needs a
    // playlist to gather, and a lit toggle over a dead form is a lie.
    expect(screen.getByRole("switch")).toHaveProperty("disabled", true);
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
