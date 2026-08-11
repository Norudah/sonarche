import { ScanSearch } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useInspectMode } from "@/features/library/inspect/inspectMode";
import { chromeButton } from "@/shared/ui/chromeButton";
import { ActionHelp } from "@/shared/ui/FieldHelp";

/**
 * The lens, as one button that lights up.
 *
 * It began as a two-segment switch naming both modes, which was the honest way
 * to say that listening is a *place* and not the absence of a feature. In a bar
 * of this height it was simply too much furniture — two labels and a sliding
 * pill for a control you throw twice a week. The mode is still legible: off is
 * quiet chrome, on is an amber plate, and amber means "something to fix"
 * everywhere else in the app. The tooltip names what the click does, which is
 * the one thing an icon cannot say.
 */
export function InspectSwitch() {
  const { t } = useTranslation("library");
  const { inspecting, setInspecting } = useInspectMode();

  return (
    <ActionHelp text={t(inspecting ? "inspect.exit" : "inspect.enter")}>
      <button
        type="button"
        aria-pressed={inspecting}
        aria-label={t(inspecting ? "inspect.exit" : "inspect.enter")}
        onClick={() => setInspecting(!inspecting)}
        className={chromeButton(inspecting ? "warning" : "idle")}
      >
        <ScanSearch className="size-4" />
      </button>
    </ActionHelp>
  );
}
