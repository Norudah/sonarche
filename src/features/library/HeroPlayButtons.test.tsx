// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HeroPlayButtons } from "@/features/library/HeroPlayButtons";

afterEach(cleanup);

/**
 * These two used to carry their own labels. They are icons now, so the
 * accessible name is the only thing naming them — losing it would leave a
 * screen reader with two unlabelled buttons and no way to tell the modes
 * apart, and nothing on screen would look wrong.
 *
 * i18next is not initialised here, so `t` echoes the key back; the keys are the
 * names asserted below.
 */
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
   * here, or every hero would have two extra tab stops that do nothing. */
  it("adds no tab stop beyond the two buttons and the slot", () => {
    const { container } = render(
      <HeroPlayButtons onPlay={() => {}} onShuffle={() => {}}>
        <button type="button">extra</button>
      </HeroPlayButtons>,
    );

    const focusable = container.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
    expect(focusable.length).toBe(3);
  });
});
