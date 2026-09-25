import { GuideButton } from "@/app/layout/GuideButton";
import { SettingsToggle } from "@/app/layout/SettingsToggle";
import { useLensAvailable } from "@/features/library/inspect/inspectMode";
import { InspectSwitch } from "@/features/library/inspect/InspectSwitch";
import { isMacOS } from "@/shared/lib/platform";

/**
 * The content column's bar. Always rendered at a fixed height so pages don't
 * jump; on macOS it is also a window drag region (only presses on the bar
 * itself drag, so its controls stay clickable).
 */
export function Topbar() {
  const hasLens = useLensAvailable();

  return (
    <div
      data-tauri-drag-region={isMacOS ? true : undefined}
      className="flex h-12 shrink-0 items-center justify-between border-b border-separator bg-surface px-4"
    >
      {/* The slot renders even without a lens, keeping the right group pinned. */}
      <span className="flex items-center">{hasLens && <InspectSwitch />}</span>
      <span data-tour="chrome" className="flex items-center gap-0.5">
        <GuideButton />
        <SettingsToggle />
      </span>
    </div>
  );
}
