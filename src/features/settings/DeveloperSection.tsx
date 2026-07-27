import { useTranslation } from "react-i18next";

import { LibraryResetCard } from "@/features/settings/LibraryResetCard";
import { SettingsHero } from "@/features/settings/SettingsHero";
import { SetupResetCard } from "@/features/settings/SetupResetCard";

/** Dev-build helpers for testing; the section is only mounted in dev, and every
 * command behind it refuses to run in a release build. */
export function DeveloperSection() {
  const { t } = useTranslation("settings");

  return (
    <>
      <SettingsHero eyebrow={t("title")} title={t("developer.title")} description={t("developer.description")} />
      <SetupResetCard />
      <LibraryResetCard />
    </>
  );
}
