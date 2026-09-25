import { HardDrive, History, Music } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { PreviousImport, ScanReport } from "@/features/import/api";
import { formatBytes, hasAudio, unplayableFormats } from "@/features/import/summary";

interface ScanSummaryProps {
  report: ScanReport;
}

/** What the folder holds; unplayable files are an amber caveat, not an error. */
export function ScanSummary({ report }: ScanSummaryProps) {
  const { t, i18n } = useTranslation("import");
  const total = report.playable + report.unplayable;
  // `returnObjects` is typed opaquely; this key holds a string array.
  const units = t("units", { returnObjects: true }) as unknown as string[];

  if (!hasAudio(report)) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{t("foundNone")}</p>
        <p className="text-[0.8125rem] text-muted">{t("foundNoneHint")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="flex items-baseline gap-2 text-2xl font-semibold tracking-tight tabular-nums">
          <Music className="size-5 shrink-0 self-center text-accent" />
          {t("found", { count: total })}
        </p>
        <p className="text-[0.8125rem] text-muted">{t("inFolders", { count: report.albumFolders })}</p>
        <p className="flex items-center gap-1.5 text-[0.8125rem] text-muted">
          <HardDrive className="size-3.5 shrink-0" />
          {t("toCopy", { size: formatBytes(report.bytes, i18n.language, units) })}
        </p>
      </div>

      {report.truncated && <p className="text-[0.8125rem] text-muted">{t("truncated")}</p>}

      {report.previouslyImported && <AlreadyImported previous={report.previouslyImported} />}

      {report.unplayable > 0 && <UnplayableShare report={report} total={total} />}
    </div>
  );
}

/** The folder was imported before. beets skips seen directories, so a run
 * that adds nothing would otherwise look like a failure. A stopped run gets
 * its own wording: relaunching resumes. */
function AlreadyImported({ previous }: { previous: PreviousImport }) {
  const { t, i18n } = useTranslation("import");
  const when = new Intl.DateTimeFormat(i18n.language, { dateStyle: "long" }).format(previous.finishedAt);

  return (
    <div className="flex gap-2.5 rounded-xl bg-surface-secondary px-3.5 py-3 text-[0.8125rem]">
      <History className="mt-0.5 size-4 shrink-0 text-muted" />
      <div className="flex flex-col gap-0.5">
        <p className="font-medium">{t(previous.cancelled ? "again.stopped" : "again.done", { when })}</p>
        <p className="text-muted">{t(previous.cancelled ? "again.stoppedHint" : "again.doneHint")}</p>
      </div>
    </div>
  );
}

/** Undecodable share as one flush bar; only shown when non-zero. */
function UnplayableShare({ report, total }: { report: ScanReport; total: number }) {
  const { t } = useTranslation("import");
  const formats = unplayableFormats(report);
  const playableShare = (report.playable / total) * 100;

  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-warning-soft/50 px-3.5 py-3">
      {/* The amber trough is the unplayable share. */}
      <div className="flex h-1.5 overflow-hidden rounded-full bg-warning">
        <span style={{ width: `${playableShare}%` }} className="bg-accent" />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem]">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 shrink-0 rounded-full bg-accent" />
          {t("playable", { count: report.playable })}
        </span>
        <span className="flex items-center gap-1.5 font-medium">
          <span className="size-1.5 shrink-0 rounded-full bg-warning" />
          {t("unplayable", { count: report.unplayable })}
        </span>
      </div>

      <div className="flex flex-col gap-0.5 text-[0.8125rem] text-muted">
        <p>{t("unplayableFormats", { formats: formats.join(", "), count: formats.length })}</p>
        <p>{t("unplayableKept")}</p>
      </div>
    </div>
  );
}
