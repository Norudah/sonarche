import { Switch } from "@heroui/react";
import { useTranslation } from "react-i18next";

import { SettingCard } from "@/features/settings/SettingCard";
import { SettingsHero } from "@/features/settings/SettingsHero";
import { storeNotificationBadges, useNotificationBadges } from "@/features/settings/notificationBadges";

/**
 * How the app talks about what is left to fix. One switch today — the sidebar
 * badge — and the category exists so the next metadata preferences have a
 * home waiting rather than a move to plan.
 */
export function MetadataSection() {
  const { t } = useTranslation("settings");
  const badges = useNotificationBadges();

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
    </>
  );
}
