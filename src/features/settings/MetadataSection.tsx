import { useTranslation } from "react-i18next";

import { SettingsHero } from "@/features/settings/SettingsHero";
import { SwitchCard } from "@/features/settings/SwitchCard";
import { storeNotificationBadges, useNotificationBadges } from "@/shared/lib/notificationBadges";
import { storeRematchConfirm, useRematchConfirm } from "@/shared/lib/rematchConfirm";

/**
 * How the app talks about what is left to fix, and how carefully it lets the
 * automatic identification rewrite things: the sidebar badge, and the
 * confirmation the re-match button asks for.
 */
export function MetadataSection() {
  const { t } = useTranslation("settings");
  const badges = useNotificationBadges();
  const rematchConfirm = useRematchConfirm();

  return (
    <>
      <SettingsHero eyebrow={t("title")} title={t("metadata.title")} description={t("metadata.description")} />

      <SwitchCard
        name={t("metadata.badges.name")}
        why={t("metadata.badges.why")}
        isSelected={badges}
        onChange={storeNotificationBadges}
      />

      {/* The same preference the dialog's "don't ask again" writes — the two
          surfaces read one store, so they can never disagree. */}
      <SwitchCard
        name={t("metadata.rematchConfirm.name")}
        why={t("metadata.rematchConfirm.why")}
        isSelected={rematchConfirm}
        onChange={storeRematchConfirm}
      />
    </>
  );
}
