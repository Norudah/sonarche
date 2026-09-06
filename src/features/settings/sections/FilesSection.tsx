import { useTranslation } from "react-i18next";

import { AudioFormatCard } from "@/features/settings/AudioFormatCard";
import { LibraryLocationCard } from "@/features/settings/LibraryLocationCard";
import { SectionHeader } from "@/features/settings/SectionHeader";

/**
 * What the app owns on this disk: where the music sits, and what the files
 * themselves are made of.
 *
 * The format used to be filed with the download page, because that is where it
 * takes effect. But nobody looks for "what my files are" under "how a page
 * behaves when I paste a link" — and the card carries a button that re-encodes
 * the *whole library*, which is this pane's subject and not that one's. Where a
 * setting applies is not where it is found.
 */
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
