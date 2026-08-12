import { HardDrive, History, Music } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { PreviousImport, ScanReport } from "@/features/import/api";
import { formatBytes, hasAudio, unplayableFormats } from "@/features/import/summary";

interface ScanSummaryProps {
  report: ScanReport;
}

/**
 * What the folder turned out to hold.
 *
 * Two registers, and the split is the point: the track count, the shelves it
 * makes and the disc cost are what the user is agreeing to, so they lead; the
 * unplayable files are a caveat about that agreement, so they sit under it in
 * the app's amber — the hue already reserved for "not quite complete", never for
 * "something failed". Nothing here is a reason not to import.
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

  return (
    <div className="flex flex-col gap-4">
      {/* The headline. The count is the thing; how many shelves it makes and
          what it costs are the same line at a lower weight, rather than three
          tiles pretending to be three separate facts. */}
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

/**
 * This folder has been here before.
 *
 * beets skips the directories it has already taken on, so a second import adds
 * only what is new — which is the right behaviour and an alarming one to watch
 * in silence: a run that copies nothing looks exactly like a run that failed.
 * Saying it up front turns "why did nothing happen" into "of course".
 *
 * A stopped run gets its own sentence. It is the common case now that imports
 * can be stopped, and there the message is the opposite: relaunching is the
 * thing to do, and only the part that never landed will be copied.
 */
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

/**
 * How much of the folder the engine cannot decode, drawn before it is stated.
 *
 * One flush bar rather than the rail's gapped segments: this is a proportion of
 * one whole, not a chain of stages, and the two must not look alike. It appears
 * only when there is something to show — a bar that is always fully accent is a
 * decoration, and it would make the amber case harder to notice rather than
 * easier.
 */
function UnplayableShare({ report, total }: { report: ScanReport; total: number }) {
  const { t } = useTranslation("import");
  const formats = unplayableFormats(report);
  const playableShare = (report.playable / total) * 100;

  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-warning-soft/50 px-3.5 py-3">
      {/* The trough *is* the unplayable share: one span over an amber track
          costs one element and can never disagree with itself about the total. */}
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
