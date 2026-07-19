import { Alert, Spinner } from "@heroui/react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { paths } from "@/app/routes";
import { useLibrary } from "@/features/library/hooks";
import { filterTracks, totalPlaytime } from "@/features/library/tracks/filter";
import { TracksHeader } from "@/features/library/tracks/TracksHeader";
import { TrackTable } from "@/features/library/tracks/TrackTable";
import { fade } from "@/shared/motion/tokens";
import { usePlayer } from "@/shared/player/PlayerContext";
import { PageContainer } from "@/shared/ui/PageContainer";

export function TracksView() {
  const { t } = useTranslation("library");
  const library = useLibrary();
  const { play } = usePlayer();
  const [query, setQuery] = useState("");

  const tracks = library.data ?? [];
  const visible = useMemo(() => filterTracks(tracks, query), [tracks, query]);
  const playtime = useMemo(() => totalPlaytime(tracks), [tracks]);

  const playAll = () => {
    const first = visible[0];
    if (!first) return;
    play({
      id: first.id,
      src: first.audioUrl,
      title: first.title || t("unknownTitle"),
      subtitle: first.artist || t("unknownArtist"),
      artUrl: first.artUrl,
      duration: first.length,
    });
  };

  return (
    <PageContainer>
      <TracksHeader
        count={tracks.length}
        playtime={playtime}
        query={query}
        onQueryChange={setQuery}
        onPlayAll={playAll}
      />

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

      {library.data && tracks.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-4xl">♪</p>
          <p className="text-muted">{t("empty")}</p>
          <Link to={paths.download} className="text-accent underline-offset-4 hover:underline">
            {t("goToDownload")}
          </Link>
        </div>
      )}

      {/* Fades in rather than replacing the table in one frame — the search is
       * live, so this state appears mid-keystroke. */}
      {tracks.length > 0 && visible.length === 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={fade}
          className="py-16 text-center text-sm text-muted"
        >
          {t("search.noResults", { query })}
        </motion.p>
      )}

      {visible.length > 0 && <TrackTable tracks={visible} animationKey={query} />}
    </PageContainer>
  );
}
