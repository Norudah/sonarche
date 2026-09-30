import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";

import { openSettings, useSettingsDialog } from "@/shared/lib/settingsDialog";
import { chromeButton } from "@/shared/ui/chromeButton";
import { ActionHelp } from "@/shared/ui/FieldHelp";

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
