import { useTranslation } from "react-i18next";

import { LibraryResetCard } from "@/features/settings/LibraryResetCard";
import { SectionHeader } from "@/features/settings/SectionHeader";
import { SetupResetCard } from "@/features/settings/SetupResetCard";
import { ToastLabCard } from "@/features/settings/ToastLabCard";

/** Dev-build helpers for testing; the section is only mounted in dev, and every
 * command behind it refuses to run in a release build.
 *
 * Ordered by what they cost: replaying the install loses nothing, the toast
 * bench does not even touch the app, and the library wipe is last because it is
 * the one that deletes files. */
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
