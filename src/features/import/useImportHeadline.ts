import { useTranslation } from "react-i18next";

import type { ImportRecap, ImportScanCounts } from "@/features/import/api";
import { formatBytes } from "@/features/import/summary";

/** The imported count in one line ("312 tracks · 14 albums · 2.1 GB"), shared
 * by the archive row and the import page. Falls back to beets' folder count. */
export function useImportHeadline(folders: number, scan: ImportScanCounts | null, recap: ImportRecap | null): string {
  const { t, i18n } = useTranslation("import");
  const units = t("units", { returnObjects: true }) as unknown as string[];

  return [
    recap != null ? t("found", { count: recap.tracks }) : null,
    recap != null ? t("recap.albums", { count: recap.albums }) : t("recap.folders", { count: folders }),
    scan != null && scan.bytes > 0 ? formatBytes(scan.bytes, i18n.language, units) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
