import { Alert, Spinner } from "@heroui/react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { paths } from "@/app/routes";
import { groupAlbums } from "@/features/library/albums/albums";
import { filterArtists, groupArtists, sortArtists, type ArtistSort } from "@/features/library/artists/artists";
import { ArtistGrid } from "@/features/library/artists/ArtistGrid";
import { ArtistsHeader } from "@/features/library/artists/ArtistsHeader";
import { useLibrary } from "@/features/library/hooks";
import { usePlayQueue } from "@/features/library/usePlayQueue";
import { fade } from "@/shared/motion/tokens";
import { PageContainer } from "@/shared/ui/PageContainer";

export function ArtistsView() {
  const { t } = useTranslation("library");
  const library = useLibrary();
  const { playOrdered } = usePlayQueue();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ArtistSort>("name");

  // Two memos rather than one: the album grouping is the expensive half and it
  // does not depend on the query or the sort, so it must not rerun on a keystroke.
  const artists = useMemo(() => groupArtists(groupAlbums(library.data ?? [])), [library.data]);
  const visible = useMemo(() => sortArtists(filterArtists(artists, query), sort), [artists, query, sort]);

  return (
    <PageContainer>
      <ArtistsHeader
        artistCount={artists.length}
        albumCount={artists.reduce((sum, artist) => sum + artist.albums.length, 0)}
        query={query}
        onQueryChange={setQuery}
        sort={sort}
        onSortChange={setSort}
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

      {library.data && artists.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-4xl">♪</p>
          <p className="text-muted">{t("artists.empty")}</p>
          <Link to={paths.download} className="text-accent underline-offset-4 hover:underline">
            {t("goToDownload")}
          </Link>
        </div>
      )}

      {artists.length > 0 && visible.length === 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={fade}
          className="py-16 text-center text-sm text-muted"
        >
          {t("artists.noResults", { query })}
        </motion.p>
      )}

      {visible.length > 0 && (
        <ArtistGrid
          artists={visible}
          animationKey={`${query}:${sort}`}
          // The first track of the earliest album: an artist's "play" has to
          // start *somewhere*, and the discography's opening is the only choice
          // that is not arbitrary. Shuffle belongs to a queue we do not have yet.
          onPlay={(artist) => playOrdered(artist.albums.flatMap((album) => album.tracks))}
        />
      )}
    </PageContainer>
  );
}
