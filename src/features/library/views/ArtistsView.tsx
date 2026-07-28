import { Alert, Spinner } from "@heroui/react";
import { Mic2, SearchX } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { groupAlbums } from "@/features/library/albums/albums";
import {
  ARTIST_SORTS,
  filterArtists,
  groupArtists,
  sortArtists,
  type ArtistSort,
} from "@/features/library/artists/artists";
import { ArtistGrid } from "@/features/library/artists/ArtistGrid";
import { ArtistsHeader } from "@/features/library/artists/ArtistsHeader";
import { EmptyLibrary } from "@/features/library/EmptyLibrary";
import { ExplorerBar } from "@/features/library/ExplorerBar";
import { SortSelect } from "@/features/library/SortSelect";
import { useLibrary } from "@/features/library/hooks";
import { usePlayQueue } from "@/features/library/usePlayQueue";
import { NoResults } from "@/shared/ui/EmptyState";
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
      />

      <ExplorerBar query={query} onQueryChange={setQuery} shown={visible.length} total={artists.length}>
        <SortSelect
          options={ARTIST_SORTS}
          value={sort}
          onChange={setSort}
          labelOf={(option) => t(`artists.sort.${option}`)}
        />
      </ExplorerBar>

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
        <EmptyLibrary icon={Mic2} title={t("artists.empty.title")} body={t("artists.empty.body")} />
      )}

      {artists.length > 0 && visible.length === 0 && (
        <NoResults icon={SearchX} message={t("artists.noResults", { query })} />
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
