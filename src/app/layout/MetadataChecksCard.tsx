import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { paths } from "@/app/routes";
import { ChecksList } from "@/features/library/triage/ChecksList";
import { CHECK_KEYS, useDisabledChecks } from "@/features/library/triage/enabledChecks";
import { SettingCard, SettingCardHeader } from "@/features/settings/SettingCard";
import { closeSettings } from "@/shared/lib/settingsDialog";
import { ActionButton } from "@/shared/ui/ActionLink";

/**
 * The metadata check switches in Settings, sharing the Metadata page's store
 * (`ChecksList`). Counts stay on the page to avoid walking the library here.
 * Lives in the shell because it spans `library/triage` and `settings`.
 */
export function MetadataChecksCard() {
  const { t } = useTranslation("settings");
  const navigate = useNavigate();
  const disabled = useDisabledChecks();

  // Close first, or the dialog would stay over the new page.
  const open = () => {
    closeSettings();
    navigate(paths.metadata);
  };

  return (
    <SettingCard settingKey="metadata.checks">
      <div className="flex flex-col gap-3">
        <SettingCardHeader
          title={t("metadata.checks.name")}
          description={t("metadata.checks.why")}
          trailing={
            <span className="text-[0.8125rem] text-muted tabular-nums">
              {t("metadata.checks.count", { enabled: CHECK_KEYS.length - disabled.length, total: CHECK_KEYS.length })}
            </span>
          }
        />

        <div className="overflow-hidden rounded-lg border border-separator/60 bg-default/30">
          <ChecksList disabled={disabled} layout="rows" />
        </div>

        <ActionButton onPress={open} trailingIcon={ArrowRight}>
          {t("metadata.checks.action")}
        </ActionButton>
      </div>
    </SettingCard>
  );
}
