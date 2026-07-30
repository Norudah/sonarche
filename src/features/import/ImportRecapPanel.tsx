import { ArrowRight, CircleCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { paths } from "@/app/paths";
import type { ImportRecap, ImportScanCounts } from "@/features/import/api";
import { unplayableFormats } from "@/features/import/summary";
import { ActionLink } from "@/shared/ui/ActionLink";

interface ImportRecapPanelProps {
  renditions: number;
  /** What the folder held. Null when the run is recalled without it — the panel
   * then says what came in and stays quiet about what was on disk. */
  scan: ImportScanCounts | null;
  recap: ImportRecap | null;
}

/**
 * What an import brought in — the same panel on the page that just ran one and
 * in the archive, because they are the same facts and the app must not grow two
 * readings of them.
 *
 * It exists because "Import terminé" was the whole of what the app had to say
 * about a folder of four thousand files. The copy working is the least
 * interesting thing that happened: an import is deliberately as-is, so what
 * actually arrived is whatever the files were already tagged with, and the one
 * question worth answering is whether that is worth anything.
 *
 * The count of what came in is *not* here — see `useImportHeadline`. It has a
 * different place in each of the two homes, and stating it in both put the same
 * sentence twice on the same screen.
 *
 * The figures are stated, not linked. Every number on the Metadata page is a
 * door onto exactly as many items as it names, and these are counts over one
 * import — a door here would open on the whole library's missing years and
 * disagree with the number beside it. One honest link at the bottom instead.
 */
export function ImportRecapPanel({ renditions, scan, recap }: ImportRecapPanelProps) {
  const { t } = useTranslation("import");
  const caveats = [
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

      {recap != null && <TagState recap={recap} />}
    </div>
  );
}

/** One line per defect, in the order the Metadata queue lists them. Zero is
 * shown rather than hidden: "no album is missing its cover" is a result, and a
 * list that drops its clean lines makes the user wonder what was checked. */
function TagState({ recap }: { recap: ImportRecap }) {
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

      {/* An as-is import never carries a MusicBrainz identity, so the remedy is
          named here — but the door stays single and claims no count: the align
          card on the Metadata page answers for the whole library. */}
      <p className="text-xs text-muted">{t("recap.alignHint")}</p>
      <ActionLink to={paths.metadata} trailingIcon={ArrowRight}>
        {t("recap.openMetadata")}
      </ActionLink>
    </div>
  );
}
