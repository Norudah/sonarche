// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HeroPlayButtons } from "@/features/library/HeroPlayButtons";

afterEach(cleanup);

/** Shuffle is icon-only, so its `aria-label` matters. i18next isn't
 * initialised here, so `t` echoes the keys asserted below. */
describe("HeroPlayButtons", () => {
  it("names both modes for assistive tech", () => {
    render(<HeroPlayButtons onPlay={() => {}} onShuffle={() => {}} />);

    expect(screen.getByRole("button", { name: "playAll" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "playShuffled" })).toBeTruthy();
  });

  it("presses the mode that was clicked", () => {
    const onPlay = vi.fn();
    const onShuffle = vi.fn();
    render(<HeroPlayButtons onPlay={onPlay} onShuffle={onShuffle} />);

    fireEvent.click(screen.getByRole("button", { name: "playShuffled" }));
    expect(onShuffle).toHaveBeenCalledOnce();
    expect(onPlay).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "playAll" }));
    expect(onPlay).toHaveBeenCalledOnce();
  });

  /** The tooltip wrapper renders its own focusable trigger by default; stripped
   * here, or every hero would carry a tab stop that does nothing. */
  it("adds no tab stop beyond the two buttons", () => {
    const { container } = render(<HeroPlayButtons onPlay={() => {}} onShuffle={() => {}} />);

    const focusable = container.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
    expect(focusable.length).toBe(2);
  });
});
