import { openUrl } from "@tauri-apps/plugin-opener";
import { CircleHelp } from "lucide-react";
import { useTranslation } from "react-i18next";

import { guideUrl } from "@/shared/lib/siteLinks";
import { chromeButton } from "@/shared/ui/chromeButton";
import { ActionHelp } from "@/shared/ui/FieldHelp";

/** Opens the online guide in the user's browser. */
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
