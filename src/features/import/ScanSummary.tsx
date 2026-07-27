import { HardDrive, Music, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { ScanReport } from "@/features/import/api";
import { formatBytes, hasAudio, unplayableFormats } from "@/features/import/summary";

interface ScanSummaryProps {
  report: ScanReport;
}

/**
 * What the folder turned out to hold.
 *
 * Two registers, and the split is the point: the track count and the disc cost
 * are what the user is agreeing to, so they lead; the unplayable files are a
 * caveat about that agreement, so they sit under it in the app's amber — the
 * hue already reserved for "not quite complete", never for "something failed".
 * Nothing here is a reason not to import.
 */
export function ScanSummary({ report }: ScanSummaryProps) {
  const { t, i18n } = useTranslation("import");
  const total = report.playable + report.unplayable;
  // i18next types every `returnObjects` lookup as an opaque object — it cannot
  // see into the JSON to know this key holds an array of strings. The resource
  // file is right beside this one; the cast states what it contains.
  const units = t("units", { returnObjects: true }) as unknown as string[];

  if (!hasAudio(report)) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{t("foundNone")}</p>
        <p className="text-[0.8125rem] text-muted">{t("foundNoneHint")}</p>
      </div>
    );
  }

  const formats = unplayableFormats(report);

  return (
    <div className="flex flex-col gap-4">
      {/* The headline pair. The count is the thing; the size is what it costs,
          so it is the same line at a lower weight rather than a second card. */}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="flex items-baseline gap-2 text-2xl font-semibold tracking-tight">
          <Music className="size-5 shrink-0 self-center text-accent" />
          {t("found", { count: total })}
        </p>
        <p className="flex items-center gap-1.5 text-[0.8125rem] text-muted">
          <HardDrive className="size-3.5 shrink-0" />
          {t("toCopy", { size: formatBytes(report.bytes, i18n.language, units) })}
        </p>
      </div>

      {report.truncated && <p className="text-[0.8125rem] text-muted">{t("truncated")}</p>}

      {report.unplayable > 0 && (
        <div className="flex gap-2.5 rounded-xl bg-warning-soft/60 px-3.5 py-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="flex flex-col gap-0.5">
            <p className="text-[0.8125rem] font-medium">{t("unplayable", { count: report.unplayable })}</p>
            <p className="text-[0.8125rem] text-muted">
              {t("unplayableFormats", { formats: formats.join(", "), count: formats.length })}
            </p>
            <p className="text-[0.8125rem] text-muted">{t("unplayableKept")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
