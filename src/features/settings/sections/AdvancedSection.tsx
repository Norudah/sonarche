import { useTranslation } from "react-i18next";

import { LogFileCard } from "@/features/settings/LogFileCard";
import { ReinstallCard } from "@/features/settings/ReinstallCard";
import { SectionHeader } from "@/features/settings/SectionHeader";

/**
 * The two things you reach for when the app misbehaves: the file that says
 * what happened, and the button that rebuilds the engine.
 *
 * Every settings menu worth using has a bucket like this. Without one, the
 * diagnostic log ends up filed next to the music folder because both happen to
 * live on disk — which is how "where is my log" became unanswerable. This is
 * the escape valve that lets the other categories stay about one thing each.
 */
export function AdvancedSection() {
  const { t } = useTranslation("settings");

  return (
    <>
      <SectionHeader title={t("advanced.title")} description={t("advanced.description")} />
      <LogFileCard />
      <ReinstallCard />
    </>
  );
}
