import { useTranslation } from "react-i18next";

import { LibraryResetCard } from "@/features/settings/LibraryResetCard";
import { SectionHeader } from "@/features/settings/SectionHeader";
import { SetupResetCard } from "@/features/settings/SetupResetCard";

/** Dev-build helpers for testing; the section is only mounted in dev, and every
 * command behind it refuses to run in a release build. */
export function DeveloperSection() {
  const { t } = useTranslation("settings");

  return (
    <>
      <SectionHeader title={t("developer.title")} description={t("developer.description")} />
      <SetupResetCard />
      <LibraryResetCard />
    </>
  );
}
