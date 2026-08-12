import { Settings, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";

import { paths } from "@/app/routes";
import { chromeButton } from "@/shared/ui/chromeButton";
import { ActionHelp } from "@/shared/ui/FieldHelp";

/**
 * The way in and out of settings, in one slot.
 *
 * Both faces are here on purpose. The entry used to sit at the foot of the
 * sidebar and the exit right under it, which worked while they were neighbours;
 * with the entry moved up to the bar, an exit left behind at the bottom-left
 * would have meant going in through one corner of the window and out through
 * the opposite one.
 *
 * Settings is a mode, not a page in the nav: the sidebar swaps its whole nav for
 * the categories while it is on, so the control that opened it is also the only
 * thing that can be counted on to be in the same place when you want out.
 */
export function SettingsToggle() {
  const { t } = useTranslation("settings");
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const inSettings = pathname.startsWith(paths.settings);

  // Where leaving returns to: the last place that wasn't settings. Kept in a ref
  // and written only while outside, so switching categories (all under
  // /settings) never overwrites the exit target. An effect because it records
  // navigation history — an external timeline, not render output.
  const exitTarget = useRef<string>(paths.download);
  useEffect(() => {
    if (!inSettings) exitTarget.current = pathname;
  }, [inSettings, pathname]);

  const label = inSettings ? t("back") : t("title");

  return (
    <ActionHelp text={label}>
      <button
        type="button"
        aria-label={label}
        onClick={() => navigate(inSettings ? exitTarget.current : paths.settings)}
        className={chromeButton(inSettings ? "accent" : "idle")}
      >
        {inSettings ? <X className="size-4" /> : <Settings className="size-4" />}
      </button>
    </ActionHelp>
  );
}
