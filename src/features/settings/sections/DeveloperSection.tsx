import { useTranslation } from "react-i18next";

import { LibraryResetCard } from "@/features/settings/LibraryResetCard";
import { SectionHeader } from "@/features/settings/SectionHeader";
import { SetupResetCard } from "@/features/settings/SetupResetCard";
import { ToastLabCard } from "@/features/settings/ToastLabCard";

/** Dev-build testing helpers (every command refuses in release), ordered by cost. */
export function DeveloperSection() {
  const { t } = useTranslation("settings");

  return (
    <>
      <SectionHeader title={t("developer.title")} description={t("developer.description")} />
      <SetupResetCard />
      <ToastLabCard />
      <LibraryResetCard />
    </>
  );
}
