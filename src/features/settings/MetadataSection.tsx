import { Switch } from "@heroui/react";
import { useTranslation } from "react-i18next";

import { SettingCard } from "@/features/settings/SettingCard";
import { SettingsHero } from "@/features/settings/SettingsHero";
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

      {/* Same anatomy as the launch-welcome card: a yes/no whose name and
          control share the row, the reason at full width underneath. */}
      <SettingCard>
        <div className="flex flex-col gap-1">
          <Switch isSelected={badges} onChange={storeNotificationBadges} className="w-full">
            <Switch.Content className="w-full flex-row-reverse justify-between">
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <span className="text-[0.8125rem] font-semibold">{t("metadata.badges.name")}</span>
            </Switch.Content>
          </Switch>
          <p className="text-[0.8125rem] leading-relaxed text-muted">{t("metadata.badges.why")}</p>
        </div>
      </SettingCard>

      {/* The same preference the dialog's "don't ask again" writes — the two
          surfaces read one store, so they can never disagree. */}
      <SettingCard>
        <div className="flex flex-col gap-1">
          <Switch isSelected={rematchConfirm} onChange={storeRematchConfirm} className="w-full">
            <Switch.Content className="w-full flex-row-reverse justify-between">
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <span className="text-[0.8125rem] font-semibold">{t("metadata.rematchConfirm.name")}</span>
            </Switch.Content>
          </Switch>
          <p className="text-[0.8125rem] leading-relaxed text-muted">{t("metadata.rematchConfirm.why")}</p>
        </div>
      </SettingCard>
    </>
  );
}
