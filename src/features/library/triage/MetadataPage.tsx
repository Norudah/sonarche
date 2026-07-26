import { Alert, Spinner } from "@heroui/react";
import { CircleCheck } from "lucide-react";
import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { paths } from "@/app/routes";
import { groupAlbums } from "@/features/library/albums/albums";
import { groupArtists } from "@/features/library/artists/artists";
import { groupFamilies } from "@/features/library/genres/genres";
import { useLibrary } from "@/features/library/hooks";
import { GenreDistribution } from "@/features/library/triage/GenreDistribution";
import { buildTriageQueue, countToFix } from "@/features/library/triage/queue";
import { QueueLine } from "@/features/library/triage/QueueLine";
import { PageContainer } from "@/shared/ui/PageContainer";

/**
 * The triage post (docs/metadata-page-plan.md): a headline count of things to
 * fix, a queue of correction lines that each deep-link into the filtered
 * explorers, and the genre distribution folded underneath. No score, no module
 * you can only look at — zero open lines is the win state, shown calm.
 */
export function MetadataPage() {
  const { t } = useTranslation(["metadata", "library"]);
  const library = useLibrary();
  const queueRef = useRef<HTMLElement>(null);

  const tracks = useMemo(() => library.data ?? [], [library.data]);
  const albums = useMemo(() => groupAlbums(tracks), [tracks]);
  const queue = useMemo(() => buildTriageQueue(tracks, albums), [tracks, albums]);
  const families = useMemo(() => groupFamilies(tracks, albums), [tracks, albums]);
  const artistCount = useMemo(() => groupArtists(albums).length, [albums]);

  const toFix = countToFix(queue);
  const lines = queue.filter((line) => line.count > 0);

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
          {/* The KPI tiles of the mocks, reduced to what they were: context. */}
          <p className="mt-0.5 text-[0.8125rem] text-muted">
            {t("library:trackCount", { count: tracks.length })} · {t("library:albumCount", { count: albums.length })} ·{" "}
            {t("library:artistCount", { count: artistCount })}
          </p>
        </div>
        {toFix > 0 && (
          <button
            type="button"
            onClick={() => queueRef.current?.scrollIntoView({ behavior: "smooth" })}
            className="shrink-0 cursor-pointer rounded-full bg-warning-soft px-3.5 py-1.5 text-[0.8125rem] font-medium text-warning outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            {t("toFix", { count: toFix })}
          </button>
        )}
      </div>

      {library.isPending && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {library.isError && (
        <Alert status="danger">
          <Alert.Content>
            <Alert.Title>{t("library:loadFailed")}</Alert.Title>
            <Alert.Description>{String(library.error)}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {library.data && tracks.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-4xl">♪</p>
          <p className="text-muted">{t("library:empty")}</p>
          <Link to={paths.download} className="text-accent underline-offset-4 hover:underline">
            {t("library:goToDownload")}
          </Link>
        </div>
      )}

      {tracks.length > 0 && (
        <>
          <section ref={queueRef} className="flex scroll-mt-4 flex-col gap-2">
            {lines.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl bg-success-soft px-4 py-5">
                <CircleCheck className="size-5 shrink-0 text-success" />
                <div>
                  <p className="text-sm font-medium">{t("allClear")}</p>
                  <p className="mt-0.5 text-xs text-muted">{t("allClearHint")}</p>
                </div>
              </div>
            ) : (
              lines.map((line) => <QueueLine key={line.key} line={line} />)
            )}
          </section>

          <GenreDistribution families={families} />
        </>
      )}
    </PageContainer>
  );
}
