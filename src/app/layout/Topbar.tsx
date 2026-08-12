import { GuideButton } from "@/app/layout/GuideButton";
import { SettingsToggle } from "@/app/layout/SettingsToggle";
import { useLensAvailable } from "@/features/library/inspect/inspectMode";
import { InspectSwitch } from "@/features/library/inspect/InspectSwitch";
import { isMacOS } from "@/shared/lib/platform";

/**
 * The content column's own bar: it starts where the sidebar ends and runs to the
 * right edge.
 *
 * Not a window-wide title bar. The sidebar keeps its top corner for the traffic
 * lights, and stretching a bar across both would have put the app's controls in
 * the same band as the OS's. This one belongs to whatever page is open.
 *
 * `bg-surface` and a hairline, like the sidebar and the player bar: the three
 * are one frame around the page, and a bar the same colour as the page it sits
 * above simply is not there.
 *
 * It renders on every route, at a fixed height, even when only settings is in
 * it. Chrome that appears and disappears makes every page below it jump by its
 * own height on navigation, and the empty stretch is not idle anyway: on macOS
 * it is the band you grab to move the window, which the overlay title bar took
 * away. `data-tauri-drag-region` is bare on purpose — only presses landing on
 * the bar itself drag, so the controls inside it stay clickable.
 */
export function Topbar() {
  const hasLens = useLensAvailable();

  return (
    <div
      data-tauri-drag-region={isMacOS ? true : undefined}
      // Tighter than the page's own 2rem gutter. Chrome sits closer to the edge
      // of the window than content does — aligning these with the search field
      // below made them read as page furniture parked in a strip of its own.
      className="flex h-10 shrink-0 items-center justify-end gap-0.5 border-b border-separator bg-surface px-4"
    >
      {hasLens && <InspectSwitch />}
      <GuideButton />
      <SettingsToggle />
    </div>
  );
}
