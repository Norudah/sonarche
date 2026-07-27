import { ProgressBar } from "@heroui/react";
import { useTranslation } from "react-i18next";

import type { ImportProgress as Progress } from "@/features/import/hooks";

interface ImportProgressProps {
  progress: Progress | null;
  /** Album folders the scan counted — the denominator of the copying stage. */
  total: number;
}

/**
 * How far the copy has got.
 *
 * A real bar, not the sweeping playhead the download rail uses: there, the
 * import stage reports no progress of its own and a percentage would be
 * invented. Here the scan counted the folders beforehand and beets names each
 * one as it takes it, so both ends of the fraction are known and the bar can
 * mean what it looks like it means.
 *
 * The bar restarts for the cover pass rather than carrying on to 100%: it is a
 * different count of different things, and a bar that crawls the last inch for
 * as long as it took to cross the rest is a bar that has lied about what it
 * measures.
 */
export function ImportProgress({ progress, total }: ImportProgressProps) {
  const { t } = useTranslation("import");
  const covers = progress?.stage === "covers";

  const done = progress == null ? 0 : covers ? progress.done : progress.folders;
  const of = covers ? progress.total : total;
  // Clamped: beets groups by what it finds in the files, not only by folder, so
  // it can announce more steps than the walk counted. A bar past 100% reads as
  // a bug; one that sits at full while the last folders land reads as nearly
  // done, which is true.
  const percent = of > 0 ? Math.min((done / of) * 100, 100) : 0;

  return (
    <div className="flex flex-col gap-2">
      <ProgressBar.Root value={percent} aria-label={t(covers ? "shrinking" : "importing")}>
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar.Root>

      <div className="flex flex-col gap-0.5">
        <p className="text-[0.8125rem] font-medium">{t(covers ? "coversProgress" : "progress", { done, total: of })}</p>
        {covers ? (
          <p className="text-[0.8125rem] text-muted">{t("shrinkingWhy")}</p>
        ) : (
          // The folder's own name, not its path: the path is already above, and
          // what moves here is which album is being copied.
          progress?.folder != null && (
            <p className="truncate text-[0.8125rem] text-muted" title={progress.folder}>
              {progress.folder.split("/").filter(Boolean).at(-1)}
            </p>
          )
        )}
      </div>
    </div>
  );
}
