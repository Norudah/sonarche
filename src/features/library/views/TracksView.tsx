import { Alert, Spinner } from "@heroui/react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { paths } from "@/app/routes";
import { useLibrary } from "@/features/library/hooks";
import { totalPlaytime } from "@/features/library/tracks/filter";
import { TrackFilterBar } from "@/features/library/tracks/TrackFilterBar";
import { TrackResults } from "@/features/library/tracks/TrackResults";
import { TracksHeader } from "@/features/library/tracks/TracksHeader";
import { useTrackFilter } from "@/features/library/tracks/useTrackFilter";
import { usePlayQueue } from "@/features/library/usePlayQueue";
import { PageContainer } from "@/shared/ui/PageContainer";

export function TracksView() {
  const { t } = useTranslation("library");
  const library = useLibrary();
  const { playOrdered, playShuffled } = usePlayQueue();

  const tracks = useMemo(() => library.data ?? [], [library.data]);
  const playtime = useMemo(() => totalPlaytime(tracks), [tracks]);
  // No `axes` argument: the library-wide explorer owns every one of them.
  const explorer = useTrackFilter(tracks);

  return (
    <PageContainer>
      <TracksHeader
        count={tracks.length}
        playtime={playtime}
        onPlayAll={() => playOrdered(explorer.visible)}
        onShuffleAll={() => playShuffled(explorer.visible)}
      />

      <TrackFilterBar state={explorer} />

      {library.isPending && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {library.isError && (
        <Alert status="danger">
          <Alert.Content>
            <Alert.Title>{t("loadFailed")}</Alert.Title>
            <Alert.Description>{String(library.error)}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {library.data && (
        <TrackResults
          state={explorer}
          empty={
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-4xl">♪</p>
              <p className="text-muted">{t("empty")}</p>
              <Link to={paths.download} className="text-accent underline-offset-4 hover:underline">
                {t("goToDownload")}
              </Link>
            </div>
          }
        />
      )}
    </PageContainer>
  );
}
