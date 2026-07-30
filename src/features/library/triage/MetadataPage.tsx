import { Alert, Spinner } from "@heroui/react";
import { CircleCheck, Music } from "lucide-react";
import { useMemo, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import { groupAlbums } from "@/features/library/albums/albums";
import { groupArtists } from "@/features/library/artists/artists";
import { EmptyLibrary } from "@/features/library/EmptyLibrary";
import { useLibrary } from "@/features/library/hooks";
import { AlignSection } from "@/features/library/triage/AlignSection";
import { buildTriageQueue, countToFix } from "@/features/library/triage/queue";
import { QueueLine } from "@/features/library/triage/QueueLine";
import { TriageHero } from "@/features/library/triage/TriageHero";
import { PageContainer } from "@/shared/ui/PageContainer";

/**
 * The triage post (docs/metadata-page-plan.md): the count of things to fix as
 * the page's headline, and under it a queue of correction lines that each
 * deep-link into the filtered explorers. No score, no module you can only look
 * at — zero open lines is the win state, shown calm.
 *
 * The genre distribution used to be folded in underneath. It was the one thing
 * here you could only look at: a percentage per family, on a page whose whole
 * doctrine is that every number is a door. The families already have their own
 * page, which is where that browsing belongs.
 */
export function MetadataPage() {
  const { t } = useTranslation(["metadata", "library"]);
  const library = useLibrary();

  const tracks = useMemo(() => library.data ?? [], [library.data]);
  const albums = useMemo(() => groupAlbums(tracks), [tracks]);
  const queue = useMemo(() => buildTriageQueue(tracks, albums), [tracks, albums]);
  const artistCount = useMemo(() => groupArtists(albums).length, [albums]);

  const lines = queue.filter((line) => line.count > 0);

  return (
    <PageContainer>
      <TriageHero
        toFix={tracks.length > 0 ? countToFix(queue) : null}
        trackCount={tracks.length}
        albumCount={albums.length}
        artistCount={artistCount}
      />

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
        <EmptyLibrary icon={Music} title={t("library:empty.title")} body={t("library:empty.body")} />
      )}

      {tracks.length > 0 && (
        <section className="flex flex-col gap-2">
          {lines.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl bg-success-soft px-4 py-5">
              <CircleCheck className="size-5 shrink-0 text-success" />
              <div>
                <p className="text-sm font-medium">{t("allClear")}</p>
                <p className="mt-0.5 text-xs text-muted">{t("allClearHint")}</p>
              </div>
            </div>
          ) : (
            // Same cascade as the album grid and the track table: the rows are
            // a result set, and they land in the same rhythm here as everywhere
            // a query produces a list.
            lines.map((line, position) => (
              <QueueLine
                key={line.key}
                line={line}
                style={{ "--row-stagger": `${position * 0.04}s` } as CSSProperties}
              />
            ))
          )}
        </section>
      )}

      {tracks.length > 0 && <AlignSection albums={albums} />}
    </PageContainer>
  );
}
