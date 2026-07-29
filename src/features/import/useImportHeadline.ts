import { useTranslation } from "react-i18next";

import type { ImportRecap, ImportScanCounts } from "@/features/import/api";
import { formatBytes } from "@/features/import/summary";

/**
 * What an import brought in, in one line — "312 pistes · 14 albums · 2,1 Go".
 *
 * A hook rather than a block inside the recap panel, because the line has two
 * homes and must not be in both at once: in the archive it is the row's own
 * subtitle, and on the page that just ran the import it sits above the panel.
 * Written twice it drifted immediately — the panel said "2,1 Go copiés" sixty
 * pixels under a row already saying "2,1 Go".
 *
 * Falls back to counting folders when the sidecar could not account for the run:
 * beets' own folder count is the one figure that survives whatever happened.
 */
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
