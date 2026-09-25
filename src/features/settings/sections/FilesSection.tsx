import { useTranslation } from "react-i18next";

import { AudioFormatCard } from "@/features/settings/AudioFormatCard";
import { LibraryLocationCard } from "@/features/settings/LibraryLocationCard";
import { SectionHeader } from "@/features/settings/SectionHeader";

/** Library location and audio format. */
export function FilesSection() {
  const { t } = useTranslation("settings");

  return (
    <>
      <SectionHeader title={t("files.title")} description={t("files.description")} />
      <LibraryLocationCard />
      <AudioFormatCard />
    </>
  );
}
