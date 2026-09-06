import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { SectionHeader } from "@/features/settings/SectionHeader";
import { SettingsPanel, SwitchRow } from "@/features/settings/SettingsPanel";
import { storeNotificationBadges, useNotificationBadges } from "@/shared/lib/notificationBadges";
import { storeRematchConfirm, useRematchConfirm } from "@/shared/lib/rematchConfirm";

/**
 * How the app talks about what is left to fix, and how carefully it lets the
 * automatic identification rewrite things: the sidebar badge, and the
 * confirmation the re-match button asks for.
 *
 * `checks` is a slot rather than a component this file imports: the row points
 * at a preference owned by `features/library/triage`, and features do not
 * import each other. The shell fills it (see `app/layout/SettingsHost`), and
 * the pane renders without it anywhere else.
 */
export function MetadataSection({ checks }: { checks?: ReactNode }) {
  const { t } = useTranslation("settings");
  const badges = useNotificationBadges();
  const rematchConfirm = useRematchConfirm();

  return (
    <>
      <SectionHeader title={t("metadata.title")} description={t("metadata.description")} />

      <SettingsPanel>
        <SwitchRow settingKey="metadata.badges" isSelected={badges} onChange={storeNotificationBadges} />
        {/* The same preference the dialog's "don't ask again" writes — the two
            surfaces read one store, so they can never disagree. */}
        <SwitchRow settingKey="metadata.rematchConfirm" isSelected={rematchConfirm} onChange={storeRematchConfirm} />
        {/* Last, and the only row here that is a door rather than a switch. */}
        {checks}
      </SettingsPanel>
    </>
  );
}
