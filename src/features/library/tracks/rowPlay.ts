import type { MouseEvent } from "react";

/**
 * Double-click anywhere on a track row to play it — the gesture every desktop
 * music library has had for twenty years, and the one people try first.
 *
 * The guard is the whole point. A row now carries permanently visible controls
 * (metadata, the overflow menu, the play button in the index cell), and a
 * double-click that lands on one of them means the user hit that control twice,
 * not "play this track". Without this, double-clicking the menu button would
 * open the menu *and* start the audio.
 *
 * `closest` rather than a check on the event target itself: the click usually
 * lands on the icon inside the button, not the button.
 */
export function rowPlayHandler(play: () => void) {
  return (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button, a, input, [role='menuitem']")) return;
    play();
  };
}
