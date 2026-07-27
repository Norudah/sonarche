import { Button, Spinner } from "@heroui/react";
import { FolderOpen, FolderSearch } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { ScanReport } from "@/features/import/api";
import { ScanSummary } from "@/features/import/ScanSummary";
import { hasAudio, shortenPath } from "@/features/import/summary";

interface FolderCardProps {
  /** The folder the user chose, or null before they have. */
  folder: string | null;
  report: ScanReport | null;
  isScanning: boolean;
  error: string | null;
  onChoose: () => void;
  /** Absent while the import runner does not exist yet: the button then says so
   * instead of being a control that quietly does nothing. One seam to remove. */
  onStart?: () => void;
}

/**
 * The one control this page exists for — same grammar as the download page's
 * composer: a single lifted panel that carries the whole decision, from picking
 * a folder to committing to it, rather than a form whose consequences are
 * scattered across the screen.
 *
 * The panel does not change shape between its states. Choosing a folder fills
 * it in; it never becomes a different card, because the thing being decided is
 * the same one throughout.
 */
export function FolderCard({ folder, report, isScanning, error, onChoose, onStart }: FolderCardProps) {
  const { t } = useTranslation("import");
  const canStart = onStart != null && report != null && hasAudio(report);

  return (
    // Capped rather than full-bleed: nothing in here wants the width. The
    // download composer stretches because its URL field needs the room; this
    // panel holds a paragraph and a verdict, and a banner-wide card with a
    // third of it empty reads as a layout that lost its right-hand column.
    <div className="flex max-w-2xl flex-col gap-5 rounded-2xl bg-surface p-6 shadow-md">
      <p className="max-w-prose text-[0.8125rem] leading-relaxed text-muted">{t("lead")}</p>

      {folder == null ? (
        <div className="flex">
          <Button variant="primary" onPress={onChoose} className="rounded-xl px-5">
            <FolderOpen className="size-4" />
            {t("choose")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* The path is the answer to "which folder", so it is set as data:
              one line, monospaced digits off, middle-truncated by `shortenPath`
              so the volume and the folder's own name both survive. */}
          <div className="flex items-center gap-2.5 rounded-xl bg-panel px-3.5 py-2.5">
            <FolderSearch className="size-4 shrink-0 text-muted" />
            <p className="truncate text-[0.8125rem]" title={folder}>
              {shortenPath(folder)}
            </p>
          </div>

          {isScanning && (
            <p className="flex items-center gap-2.5 text-sm text-muted">
              <Spinner size="sm" />
              {t("scanning")}
            </p>
          )}

          {error != null && (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-danger">{t("scanFailed")}</p>
              <p className="text-[0.8125rem] text-muted">{error}</p>
            </div>
          )}

          {report != null && !isScanning && <ScanSummary report={report} />}

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" onPress={onStart} isDisabled={!canStart} className="rounded-xl px-5">
                {t("start")}
              </Button>
              <Button variant="ghost" onPress={onChoose}>
                {t("chooseAnother")}
              </Button>
            </div>
            {onStart == null && report != null && hasAudio(report) && (
              <p className="text-[0.8125rem] text-muted">{t("notReady")}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
