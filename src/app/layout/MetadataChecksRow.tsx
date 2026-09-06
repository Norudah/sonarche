import { Button } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { paths } from "@/app/routes";
import { CHECK_KEYS, useDisabledChecks } from "@/features/library/triage/enabledChecks";
import { SettingRow } from "@/features/settings/SettingsPanel";
import { closeSettings } from "@/shared/lib/settingsDialog";

/**
 * A pointer, not a control: the checks are switched on and off on the Metadata
 * page, beside the counts that make the choice mean something.
 *
 * Somebody who comes to Settings › Métadonnées to silence the year check finds
 * two switches about a badge and a confirmation, and nothing about checks. The
 * row says how many are on and opens the page that owns them — the same move
 * system settings make when a pane knows about something it does not hold.
 *
 * At app level because it reaches into two features at once: `library/triage`
 * owns the preference, `settings` owns the row, and features do not import
 * each other. The shell composes it into the pane (see `SettingsHost`).
 */
export function MetadataChecksRow() {
  const { t } = useTranslation("settings");
  const navigate = useNavigate();
  const disabled = useDisabledChecks();

  const open = () => {
    closeSettings();
    navigate(paths.metadata);
  };

  return (
    <SettingRow settingKey="metadata.checks">
      <div className="flex items-center gap-3">
        <span className="text-[0.8125rem] text-muted tabular-nums">
          {t("metadata.checks.count", { enabled: CHECK_KEYS.length - disabled.length, total: CHECK_KEYS.length })}
        </span>
        <Button variant="secondary" onPress={open}>
          {t("metadata.checks.action")}
        </Button>
      </div>
    </SettingRow>
  );
}
