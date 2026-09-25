import { useTranslation } from "react-i18next";

import { LogFileRow } from "@/features/settings/LogFileRow";
import { ReinstallRow } from "@/features/settings/ReinstallRow";
import { SectionHeader } from "@/features/settings/SectionHeader";
import { SettingsPanel } from "@/features/settings/SettingsPanel";

/** Troubleshooting: the log file and the environment rebuild. */
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
