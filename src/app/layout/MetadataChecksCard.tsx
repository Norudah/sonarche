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
 * The eight checks, switchable from here too.
 *
 * This was a pointer: one row saying "8 sur 8" beside a button to the Metadata
 * page, on the grounds that the switches mean more next to the counts they
 * silence. True, and still not an answer to somebody who opened Settings ›
 * Métadonnées to stop being told about missing years — being sent somewhere
 * else is the thing a settings pane exists to spare you. The switches are the
 * same ones the page's popover shows (`ChecksList`), reading and writing the
 * same store, so the two surfaces cannot drift apart.
 *
 * The counts stay on the page. They are the argument for flipping a switch, not
 * part of the switch, and putting them here would mean walking the whole
 * library every time this pane opens.
 *
 * At app level because it reaches into two features at once: `library/triage`
 * owns the preference, `settings` owns the card, and features do not import
 * each other. The shell composes it into the pane (see `SettingsHost`).
 */
export function MetadataChecksCard() {
  const { t } = useTranslation("settings");
  const navigate = useNavigate();
  const disabled = useDisabledChecks();

  // Closes before it navigates: a `Link` would leave the dialog standing over
  // the page it just opened.
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
