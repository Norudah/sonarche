import type { MouseEvent } from "react";

/** Double-click a row to play, except on its controls (`closest`, since the
 * click usually lands on the icon inside a button). */
export function rowPlayHandler(play: () => void) {
  return (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button, a, input, [role='menuitem']")) return;
    play();
  };
}
