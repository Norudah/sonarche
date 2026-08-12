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
      //
      // `h-12`, not the `h-10` it started at: once the bar carried a real
      // control (the 32px lens switch), 40px left it 4px of clearance and the
      // bar's edges visibly pressed on it. A control can only be as calm as
      // the band around it — 48px is ordinary toolbar height, and it also
      // widens the macOS drag strip.
      className="flex h-12 shrink-0 items-center justify-between border-b border-separator bg-surface px-4"
    >
      {/* The lens lives on the left, away from help and settings: those two are
          window furniture, the lens changes what the page below is showing —
          and parked in the right corner it kept reading as a third door beside
          them. The slot renders even without a lens so the pair stays pinned
          right. */}
      <span className="flex items-center">{hasLens && <InspectSwitch />}</span>
      {/* One anchor around the pair: the tour talks about "help and settings"
          as one corner of the window, not two separate stops. */}
      <span data-tour="chrome" className="flex items-center gap-0.5">
        <GuideButton />
        <SettingsToggle />
      </span>
    </div>
  );
}
