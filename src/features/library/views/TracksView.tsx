import { Music } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { EmptyLibrary } from "@/features/library/EmptyLibrary";
import { useLibrary } from "@/features/library/hooks";
import { totalPlaytime } from "@/features/library/tracks/filter";
import { TrackFilterBar } from "@/features/library/tracks/TrackFilterBar";
import { TrackResults } from "@/features/library/tracks/TrackResults";
import { TracksHeader } from "@/features/library/tracks/TracksHeader";
import { useTrackFilter } from "@/features/library/tracks/useTrackFilter";
import { usePlayQueue } from "@/features/library/usePlayQueue";
import { LoadError, LoadingSpinner } from "@/features/library/views/LoadStates";
import { PageContainer } from "@/shared/ui/PageContainer";

export function TracksView() {
  const { t } = useTranslation("library");
  const library = useLibrary();
  const { playOrdered, playShuffled } = usePlayQueue();

  const tracks = useMemo(() => library.data ?? [], [library.data]);
  const playtime = useMemo(() => totalPlaytime(tracks), [tracks]);
  // The library-wide explorer owns every axis.
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

      {library.isPending && <LoadingSpinner />}

      {library.isError && <LoadError error={library.error} />}

      {library.data && (
        <TrackResults
          state={explorer}
          empty={<EmptyLibrary icon={Music} title={t("empty.title")} body={t("empty.body")} />}
        />
      )}
    </PageContainer>
  );
}
