import { ArrowRight, CircleCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { paths } from "@/app/paths";
import type { ImportRecap, ImportScanCounts } from "@/features/import/api";
import { unplayableFormats } from "@/features/import/summary";
import { ActionLink } from "@/shared/ui/ActionLink";

interface ImportRecapPanelProps {
  renditions: number;
  /** Null when recalled without the scan counts. */
  scan: ImportScanCounts | null;
  recap: ImportRecap | null;
  /** Only the archive needs the link; on the import page the section is right below. */
  alignDoor?: boolean;
}

/**
 * The tag quality an import brought in, shared by the import page and the
 * archive. The imported count lives in `useImportHeadline`. Figures aren't
 * links: they count one import, while Metadata pages cover the whole library.
 */
export function ImportRecapPanel({ renditions, scan, recap, alignDoor = false }: ImportRecapPanelProps) {
  const { t } = useTranslation("import");
  const caveats = [
    // First: the only line about a decision the import made.
    recap != null && (recap.collections ?? 0) > 0 ? t("recap.collections", { count: recap.collections }) : null,
    renditions > 0 ? t("doneRenditions", { count: renditions }) : null,
    scan != null && scan.unplayable > 0
      ? t("recap.unplayable", { count: scan.unplayable, formats: unplayableFormats(scan).join(", ") })
      : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-4">
      {caveats.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {caveats.map((line) => (
            <p key={line} className="text-[0.8125rem] text-muted">
              {line}
            </p>
          ))}
        </div>
      )}

      {recap != null && <TagState recap={recap} alignDoor={alignDoor} />}
    </div>
  );
}

/** One line per defect, in Metadata queue order. Zeros are shown: they are results. */
function TagState({ recap, alignDoor }: { recap: ImportRecap; alignDoor: boolean }) {
  const { t } = useTranslation("import");

  const rows = [
    { key: "withoutYear", count: recap.withoutYear },
    { key: "withoutGenre", count: recap.withoutGenre },
    { key: "offTree", count: recap.offTree },
    { key: "albumsWithoutArt", count: recap.albumsWithoutArt },
    { key: "albumsWithGaps", count: recap.albumsWithGaps },
  ];
  const clean = rows.every((row) => row.count === 0);

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-default/50 px-3.5 py-3">
      <p className="text-[0.6875rem] font-semibold tracking-wider text-muted uppercase">{t("recap.tagState")}</p>

      {clean ? (
        <p className="flex items-center gap-2 text-[0.8125rem]">
          <CircleCheck className="size-4 shrink-0 text-success" />
          {t("recap.clean")}
        </p>
      ) : (
        <dl className="flex flex-col gap-1">
          {rows.map((row) => (
            <div key={row.key} className="flex items-baseline justify-between gap-4 text-[0.8125rem]">
              <dt className={row.count > 0 ? "" : "text-muted"}>{t(`recap.${row.key}`)}</dt>
              <dd className={"tabular-nums " + (row.count > 0 ? "font-medium text-warning" : "text-muted")}>
                {row.count}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {/* No count: alignment covers the whole library, not this run. */}
      <p className="text-xs text-muted">{t("recap.alignHint")}</p>
      {alignDoor && (
        <ActionLink to={paths.import} trailingIcon={ArrowRight}>
          {t("recap.openAlign")}
        </ActionLink>
      )}
    </div>
  );
}
