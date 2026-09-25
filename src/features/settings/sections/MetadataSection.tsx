import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { SectionHeader } from "@/features/settings/SectionHeader";
import { SettingsPanel, SwitchRow } from "@/features/settings/SettingsPanel";
import { storeNotificationBadges, useNotificationBadges } from "@/shared/lib/notificationBadges";
import { storeRematchConfirm, useRematchConfirm } from "@/shared/lib/rematchConfirm";

/** Metadata preferences. `checks` is a slot filled by the shell, since it
 * holds a preference owned by `features/library/triage`. */
export function MetadataSection({ checks }: { checks?: ReactNode }) {
  const { t } = useTranslation("settings");
  const badges = useNotificationBadges();
  const rematchConfirm = useRematchConfirm();

  return (
    <>
      <SectionHeader title={t("metadata.title")} description={t("metadata.description")} />

      <SettingsPanel>
        <SwitchRow settingKey="metadata.badges" isSelected={badges} onChange={storeNotificationBadges} />
        {/* Same store as the dialog's "don't ask again". */}
        <SwitchRow settingKey="metadata.rematchConfirm" isSelected={rematchConfirm} onChange={storeRematchConfirm} />
      </SettingsPanel>

      {checks}
    </>
  );
}
