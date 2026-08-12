import { Button } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { CircleCheck, Disc3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { groupAlbums } from "@/features/library/albums/albums";
import { libraryKey, useLibrary } from "@/features/library/hooks";
import {
  type AlignPlan,
  type AlignResult,
  alignApply,
  alignScan,
  summarizePlan,
  unidentifiedAlbumCount,
} from "@/features/library/triage/align";

interface AlignProgress {
  stage: "scan" | "apply";
  done: number;
  total: number;
  album: string;
}

/** Follow the pass while it runs; subscribed only while `active`, same
 * pattern (and same reason) as the import page's progress hook. */
function useAlignProgress(active: boolean): AlignProgress | null {
  const [progress, setProgress] = useState<AlignProgress | null>(null);
  const [lastActive, setLastActive] = useState(active);

  if (lastActive !== active) {
    setLastActive(active);
    setProgress(null);
  }

  useEffect(() => {
    if (!active) return;
    const unlisten = listen<{ event: string; data: Record<string, unknown> }>("sidecar:event", (event) => {
      const { event: name, data } = event.payload;
      if (name !== "library_align_progress") return;
      setProgress({
        stage: data.stage === "apply" ? "apply" : "scan",
        done: Number(data.done ?? 0),
        total: Number(data.total ?? 0),
        album: typeof data.album === "string" ? data.album : "",
      });
    });
    return () => {
      void unlisten.then((off) => off());
    };
  }, [active]);

  return progress;
}

function Glyph() {
  return (
    <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
      <Disc3 className="size-[1.125rem] text-accent" />
    </span>
  );
}

function ProgressBar({ progress }: { progress: AlignProgress | null }) {
  const percent = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-secondary">
      <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${percent}%` }} />
    </div>
  );
}

/**
 * The align pass (docs: one MusicBrainz search per album, fills blank fields
 * only). One card whose content changes phase — idle → scanning → verdict →
 * applying → done — the geometry stays put, only the words move; the import
 * card taught us what remounting rows does.
 *
 * Accent, not amber: where triage rows name defects, this one is a remedy.
 *
 * Self-sufficient — it reads the library itself rather than taking albums as
 * a prop, because it no longer has one home: it sits on the Import page (the
 * app layer composes it there), where the albums it counts are the ones the
 * import just landed. The query behind `useLibrary` is cached, so a second
 * subscriber costs nothing.
 */
export function AlignSection() {
  const { t } = useTranslation("metadata");
  const queryClient = useQueryClient();
  const library = useLibrary();
  // Memoised like every other consumer of the grouping: this section rerenders
  // on each progress tick, and the library underneath is thousands of tracks.
  const albums = useMemo(() => groupAlbums(library.data ?? []), [library.data]);
  const [plan, setPlan] = useState<AlignPlan | null>(null);
  const [result, setResult] = useState<AlignResult | null>(null);

  const scan = useMutation({
    mutationFn: alignScan,
    onSuccess: (found) => {
      setResult(null);
      setPlan(found);
    },
  });
  const apply = useMutation({
    mutationFn: alignApply,
    onSuccess: (outcome) => {
      setPlan(null);
      setResult(outcome);
      queryClient.invalidateQueries({ queryKey: libraryKey });
    },
  });

  const running = scan.isPending || apply.isPending;
  const progress = useAlignProgress(running);
  const unidentified = unidentifiedAlbumCount(albums);

  // Nothing to align and nothing in flight: the win state here is silence,
  // like the import history's — a second empty-state would just be furniture.
  if (unidentified === 0 && plan === null && result === null && !running) return null;

  const summary = plan ? summarizePlan(plan) : null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[0.6875rem] font-semibold tracking-wider text-muted uppercase">{t("align.heading")}</h2>
      <div className="rounded-xl border border-separator/60 bg-surface px-4 py-3">
        {/* Idle — the count and the offer. */}
        {!running && plan === null && result === null && (
          <div className="flex items-center gap-4">
            <Glyph />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t("align.idle", { count: unidentified })}</p>
              <p className="mt-0.5 text-xs text-muted">{t("align.idleHint")}</p>
            </div>
            <Button variant="primary" onPress={() => scan.mutate()}>
              {t("align.scan")}
            </Button>
          </div>
        )}

        {/* Running — one line of progress, scan and apply alike. */}
        {running && (
          <div className="flex items-center gap-4">
            <Glyph />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {t(apply.isPending ? "align.applying" : "align.scanning", {
                  done: progress?.done ?? 0,
                  total: progress?.total ?? 0,
                })}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted">{progress?.album ?? "…"}</p>
              <ProgressBar progress={progress} />
            </div>
          </div>
        )}

        {/* Verdict — what the fill would write, and the two ways out. */}
        {!running && plan !== null && summary !== null && (
          <div className="flex items-start gap-4">
            <Glyph />
            <div className="min-w-0 flex-1">
              {summary.albums === 0 ? (
                <>
                  <p className="text-sm font-medium">{t("align.planNone")}</p>
                  <p className="mt-0.5 text-xs text-muted">{t("align.planNoneHint")}</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">{t("align.planTitle", { count: summary.albums })}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {[
                      t("align.planFields", { count: summary.fields }),
                      summary.covers > 0 ? t("align.planCovers", { count: summary.covers }) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <ul className="mt-2 flex max-h-52 flex-col gap-1 overflow-y-auto pr-1">
                    {plan.albums.map((album) => (
                      <li key={album.album_id} className="flex min-w-0 items-baseline gap-2 text-xs">
                        <span className="truncate font-medium">{album.album || album.release_title}</span>
                        <span className="truncate text-muted">
                          {[album.release_title, album.release_year].filter(Boolean).join(" · ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {apply.isError && <p className="mt-2 text-xs text-danger">{t("align.failed")}</p>}
            </div>
            <div className="flex shrink-0 flex-col items-stretch gap-2">
              {summary.albums > 0 && (
                <Button variant="primary" onPress={() => apply.mutate(plan)}>
                  {t("align.apply")}
                </Button>
              )}
              <Button variant="secondary" onPress={() => setPlan(null)}>
                {summary.albums > 0 ? t("align.dismiss") : t("align.ok")}
              </Button>
            </div>
          </div>
        )}

        {/* Done — the receipt, in the queue's win-state green. */}
        {!running && plan === null && result !== null && (
          <div className="flex items-center gap-4">
            <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success-soft">
              <CircleCheck className="size-[1.125rem] text-success" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {[
                  t("align.doneAlbums", { count: result.albumsUpdated }),
                  t("align.doneItems", { count: result.itemsUpdated }),
                  result.genresFilled > 0 ? t("align.doneGenres", { count: result.genresFilled }) : null,
                  result.coversFetched > 0 ? t("align.doneCovers", { count: result.coversFetched }) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <Button variant="secondary" onPress={() => setResult(null)}>
              {t("align.ok")}
            </Button>
          </div>
        )}

        {scan.isError && !running && <p className="mt-2 text-xs text-danger">{t("align.failed")}</p>}
      </div>
    </section>
  );
}
