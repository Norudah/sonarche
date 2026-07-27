import { Button, Spinner } from "@heroui/react";
import { Check, FolderOpen, FolderSearch } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { paths } from "@/app/routes";
import { ImportProgress } from "@/features/import/ImportProgress";
import type { ImportProgress as Progress } from "@/features/import/hooks";
import type { ImportPhase } from "@/features/import/phase";
import { ScanSummary } from "@/features/import/ScanSummary";
import { hasAudio, shortenPath } from "@/features/import/summary";

interface FolderCardProps {
  /** The folder the user chose, or null before they have. */
  folder: string | null;
  phase: ImportPhase;
  progress: Progress | null;
  onChoose: () => void;
  onStart: () => void;
}

/**
 * The one control this page exists for — same grammar as the download page's
 * composer: a single lifted panel that carries the whole decision, from picking
 * a folder to committing to it, rather than a form whose consequences are
 * scattered across the screen.
 *
 * The panel does not change shape between its states. Choosing a folder fills
 * it in and starting the copy fills it in further; it never becomes a different
 * card, because the thing being decided is the same one throughout.
 */
export function FolderCard({ folder, phase, progress, onChoose, onStart }: FolderCardProps) {
  const { t } = useTranslation("import");
  const canStart = phase.kind === "scanned" || phase.kind === "importFailed";
  const busy = phase.kind === "importing";

  return (
    // Capped rather than full-bleed: nothing in here wants the width. The
    // download composer stretches because its URL field needs the room; this
    // panel holds a paragraph and a verdict, and a banner-wide card with a
    // third of it empty reads as a layout that lost its right-hand column.
    <div className="flex max-w-2xl flex-col gap-5 rounded-2xl bg-surface p-6 shadow-md">
      <p className="max-w-prose text-[0.8125rem] leading-relaxed text-muted">{t("lead")}</p>

      {phase.kind === "empty" ? (
        <div className="flex">
          <Button variant="primary" onPress={onChoose} className="rounded-xl px-5">
            <FolderOpen className="size-4" />
            {t("choose")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* The path is the answer to "which folder", so it is set as data:
              one line, middle-truncated by `shortenPath` so the volume and the
              folder's own name both survive. */}
          <div className="flex items-center gap-2.5 rounded-xl bg-panel px-3.5 py-2.5">
            <FolderSearch className="size-4 shrink-0 text-muted" />
            <p className="truncate text-[0.8125rem]" title={folder ?? undefined}>
              {folder != null && shortenPath(folder)}
            </p>
          </div>

          <PhaseBody phase={phase} progress={progress} />

          <div className="flex flex-wrap items-center gap-3">
            {phase.kind === "imported" ? (
              <Button variant="primary" className="rounded-xl px-5" onPress={onChoose}>
                {t("importAnother")}
              </Button>
            ) : (
              <Button
                variant="primary"
                onPress={onStart}
                isDisabled={!canStart}
                isPending={busy}
                className="rounded-xl px-5"
              >
                {phase.kind === "importFailed" ? t("retry") : t("start")}
              </Button>
            )}

            {phase.kind === "imported" ? (
              <Link
                to={paths.libraryTracks}
                className="text-[0.8125rem] font-medium text-accent underline-offset-4 outline-none transition-colors hover:text-accent/80 focus-visible:underline"
              >
                {t("seeLibrary")}
              </Link>
            ) : (
              <Button variant="ghost" onPress={onChoose} isDisabled={busy}>
                {t("chooseAnother")}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** What is known about the folder right now. One branch per phase, so the card
 * above stays about the frame and the buttons. */
function PhaseBody({ phase, progress }: { phase: ImportPhase; progress: Progress | null }) {
  const { t } = useTranslation("import");

  switch (phase.kind) {
    case "scanning":
      return (
        <p className="flex items-center gap-2.5 text-sm text-muted">
          <Spinner size="sm" />
          {t("scanning")}
        </p>
      );

    case "scanFailed":
      return <Failure title={t("scanFailed")} message={phase.message} />;

    case "scanned":
      return <ScanSummary report={phase.report} />;

    case "importing":
      return <ImportProgress progress={progress} total={phase.report.albumFolders} />;

    case "importFailed":
      return (
        <div className="flex flex-col gap-4">
          <Failure title={t("importFailed")} message={phase.message} />
          {/* Still shown: what was in the folder has not changed, and a retry
              is about the same contents. */}
          {hasAudio(phase.report) && <ScanSummary report={phase.report} />}
        </div>
      );

    case "imported":
      return (
        <div className="flex items-start gap-2.5">
          <Check className="mt-0.5 size-4 shrink-0 text-success" />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium">{t("done")}</p>
            <p className="text-[0.8125rem] text-muted">{t("doneDetail", { count: phase.outcome.folders })}</p>
          </div>
        </div>
      );

    case "empty":
      return null;
  }
}

function Failure({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium text-danger">{title}</p>
      <p className="text-[0.8125rem] break-words text-muted">{message}</p>
    </div>
  );
}
