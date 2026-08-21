import { useTranslation } from "react-i18next";

import { DangerZone } from "@/features/settings/DangerZone";
import { LibraryLocationCard } from "@/features/settings/LibraryLocationCard";
import { LogFileCard } from "@/features/settings/LogFileCard";
import { SettingsHero } from "@/features/settings/SettingsHero";

/** Where the library lives, where the log lands, and how to unmake it all.
 * The three belong together: all answer "what does the app own on my disk",
 * and all are things you want to find once and never again. */
export function LibrarySection() {
  const { t } = useTranslation("settings");

  return (
    <>
      <SettingsHero eyebrow={t("title")} title={t("library.title")} description={t("library.description")} />
      <LibraryLocationCard />
      <LogFileCard />
      <DangerZone />
    </>
  );
}
