import { useTranslation } from "react-i18next";

import { LogFileRow } from "@/features/settings/LogFileRow";
import { ReinstallRow } from "@/features/settings/ReinstallRow";
import { SectionHeader } from "@/features/settings/SectionHeader";
import { SettingsPanel } from "@/features/settings/SettingsPanel";

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
      <SettingsPanel>
        <LogFileRow />
        <ReinstallRow />
      </SettingsPanel>
    </>
  );
}
