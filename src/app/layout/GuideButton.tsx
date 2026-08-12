import { openUrl } from "@tauri-apps/plugin-opener";
import { CircleHelp } from "lucide-react";
import { useTranslation } from "react-i18next";

import { guideUrl } from "@/shared/lib/siteLinks";
import { chromeButton } from "@/shared/ui/chromeButton";
import { ActionHelp } from "@/shared/ui/FieldHelp";

/**
 * The way out to the guide on the website, from anywhere: whatever screen is
 * puzzling, help is behind the same corner of the window. It opens the user's
 * browser — the guide is a read, not a mode of the app, and a webview panel
 * would have to be chrome we then maintain.
 */
export function GuideButton() {
  const { t, i18n } = useTranslation("common");
  const label = t("guide.open");

  return (
    <ActionHelp text={label}>
      <button
        type="button"
        aria-label={label}
        onClick={() => void openUrl(guideUrl(i18n.language))}
        className={chromeButton("idle")}
      >
        <CircleHelp className="size-4" />
      </button>
    </ActionHelp>
  );
}
