import { Headphones, ScanSearch } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useInspectMode } from "@/features/library/inspect/inspectMode";
import { chromePill } from "@/shared/ui/chromeButton";
import { ActionHelp } from "@/shared/ui/FieldHelp";

/**
 * The lens, as a switch that says which of the two rooms you are standing in.
 *
 * It began as a two-segment control naming both modes, which was too much
 * furniture for a bar this tall; it then became a bare icon, which read as a
 * third door beside settings and the guide. This is the middle: one control,
 * one word, and the word is the mode you are *in* — the tooltip is where the
 * next click is named, because that is the one thing a state cannot say.
 *
 * The colour carries the argument. Listening is the app's ordinary chrome;
 * inspecting is amber, the same amber every missing tag and every doubtful
 * match wears underneath — so the switch is not only the way into that room,
 * it is a sample of what the room looks like.
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
        className={chromePill(inspecting ? "warning" : "idle")}
      >
        {inspecting ? <ScanSearch className="size-3.5" /> : <Headphones className="size-3.5" />}
        {t(inspecting ? "inspect.modeInspecting" : "inspect.modeListening")}
      </button>
    </ActionHelp>
  );
}
