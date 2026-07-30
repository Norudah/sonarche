import { useTranslation } from "react-i18next";

import { DangerZone } from "@/features/settings/DangerZone";
import { LibraryLocationCard } from "@/features/settings/LibraryLocationCard";
import { SettingsHero } from "@/features/settings/SettingsHero";

/** Where the library lives, and how to unmake it. The two belong together:
 * both answer "what does the app own on my disk", and both are things you want
 * to find once and never again. */
export function LibrarySection() {
  const { t } = useTranslation("settings");

  return (
    <>
      <SettingsHero eyebrow={t("title")} title={t("library.title")} description={t("library.description")} />
      <LibraryLocationCard />
      <DangerZone />
    </>
  );
}
