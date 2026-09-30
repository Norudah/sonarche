import { Alert, Spinner } from "@heroui/react";
import { CircleCheck, Music } from "lucide-react";
import { useMemo, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import { groupAlbums } from "@/features/library/albums/albums";
import { groupArtists } from "@/features/library/artists/artists";
import { EmptyLibrary } from "@/features/library/EmptyLibrary";
import { useArtistImages, useLibrary, useSetCheckAccepted } from "@/features/library/hooks";
import { AcceptedNotice } from "@/features/library/triage/AcceptedNotice";
import { enabledLines, useDisabledChecks } from "@/features/library/triage/enabledChecks";
import {
  acceptedTargets,
  buildSystemQueue,
  buildTriageQueue,
  tallyToFix,
  type AcceptTarget,
} from "@/features/library/triage/queue";
import { QueueLine } from "@/features/library/triage/QueueLine";
import { TriageHero } from "@/features/library/triage/TriageHero";
import { PageContainer } from "@/shared/ui/PageContainer";

/** The triage page: a count of things to complete and a queue of lines, each
 * linking to the filtered explorer. */
export function MetadataPage() {
  const { t } = useTranslation(["metadata", "library"]);
  const library = useLibrary();

  const tracks = useMemo(() => library.data ?? [], [library.data]);
  const albums = useMemo(() => groupAlbums(tracks), [tracks]);
  const queue = useMemo(() => buildTriageQueue(tracks, albums), [tracks, albums]);
  // The queue minus disabled checks; the menu still gets the full queue.
  const disabled = useDisabledChecks();
  const watched = useMemo(() => enabledLines(queue, disabled), [queue, disabled]);
  const answered = useMemo(() => acceptedTargets(tracks, albums), [tracks, albums]);
  const accept = useSetCheckAccepted();
  const answer = (target: AcceptTarget, accepted: boolean) =>
    accept.mutate({ scope: target.scope, ids: target.ids, check: target.check, accepted });

  // Artist images: app-side gaps, not metadata, and not in the tally or badge.
  const artists = useMemo(() => groupArtists(albums), [albums]);
  const artistImages = useArtistImages();
  const systemQueue = useMemo(() => buildSystemQueue(artists, artistImages.data), [artists, artistImages.data]);
  const watchedSystem = useMemo(() => enabledLines(systemQueue, disabled), [systemQueue, disabled]);

  const lines = watched.filter((line) => line.count > 0);
  const systemLines = watchedSystem.filter((line) => line.count > 0);

  return (
    <PageContainer>
      <TriageHero
        tally={tracks.length > 0 ? tallyToFix(watched) : null}
        queue={[...queue, ...systemQueue]}
        disabled={disabled}
        trackCount={tracks.length}
        albumCount={albums.length}
        artistCount={artists.length}
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
          {lines.length === 0 && systemLines.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl bg-success-soft px-4 py-5">
              <CircleCheck className="size-5 shrink-0 text-success" />
              <div>
                <p className="text-sm font-medium">{t("allClear")}</p>
                <p className="mt-0.5 text-xs text-muted">{t("allClearHint")}</p>
              </div>
            </div>
          ) : (
            lines.map((line, position) => (
              <QueueLine
                key={line.key}
                line={line}
                isPending={accept.isPending}
                onAccept={(target) => answer(target, true)}
                style={{ "--row-stagger": `${position * 0.04}s` } as CSSProperties}
              />
            ))
          )}

          {/* Separate heading: these aren't metadata defects. */}
          {systemLines.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              <div className="flex items-baseline gap-2">
                <h2 className="text-[0.6875rem] font-semibold tracking-wider text-muted uppercase">
                  {t("system.heading")}
                </h2>
                <p className="text-xs text-muted">{t("system.hint")}</p>
              </div>
              {systemLines.map((line, position) => (
                <QueueLine
                  key={line.key}
                  line={line}
                  isPending={accept.isPending}
                  onAccept={(target) => answer(target, true)}
                  style={{ "--row-stagger": `${(lines.length + position) * 0.04}s` } as CSSProperties}
                />
              ))}
            </div>
          )}

          <AcceptedNotice targets={answered} isPending={accept.isPending} onUndo={(target) => answer(target, false)} />
        </section>
      )}
    </PageContainer>
  );
}
