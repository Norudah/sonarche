import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";

import { openSettings, useSettingsDialog } from "@/shared/lib/settingsDialog";
import { chromeButton } from "@/shared/ui/chromeButton";
import { ActionHelp } from "@/shared/ui/FieldHelp";

/**
 * The way into settings — and only the way in.
 *
 * It used to be both doors: settings was a mode, so this button turned into a
 * cross to leave it, and a ref elsewhere remembered which page to return to.
 * The dialog closes itself now, from three places, and a control that keeps
 * one face is a control nobody has to re-read.
 */
export function SettingsToggle() {
  const { t } = useTranslation("settings");
  const { isOpen } = useSettingsDialog();

  return (
    <ActionHelp text={t("title")}>
      <button
        type="button"
        aria-label={t("title")}
        aria-expanded={isOpen}
        onClick={() => openSettings()}
        className={chromeButton(isOpen ? "accent" : "idle")}
      >
        <Settings className="size-4" />
      </button>
    </ActionHelp>
  );
}
