import { Alert, Spinner } from "@heroui/react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useParams } from "react-router";

import { paths } from "@/app/routes";
import { groupAlbums, sortAlbums } from "@/features/library/albums/albums";
import { AlbumGrid } from "@/features/library/albums/AlbumGrid";
import { groupArtists, sortArtists } from "@/features/library/artists/artists";
import { ArtistGrid } from "@/features/library/artists/ArtistGrid";
import { albumsWithGenre, findFamily, groupFamilies } from "@/features/library/genres/genres";
import { GenreHero } from "@/features/library/genres/GenreHero";
import { SubGenreChips } from "@/features/library/genres/SubGenreChips";
import { useFamilyLabel } from "@/features/library/genres/useFamilyLabel";
import { useLibrary } from "@/features/library/hooks";
import { usePlayTrack } from "@/features/library/usePlayTrack";
import { PageContainer } from "@/shared/ui/PageContainer";

export function GenreDetailView() {
  const { t } = useTranslation("library");
  const { family: key = "" } = useParams();
  const library = useLibrary();
  const playTrack = usePlayTrack();
  const labelOf = useFamilyLabel();
  const [sub, setSub] = useState<string | null>(null);

  const family = useMemo(() => {
    const tracks = library.data ?? [];
    return findFamily(groupFamilies(tracks, groupAlbums(tracks)), key);
  }, [library.data, key]);

  // The chip narrows the albums; the artists follow from whatever is left, so
  // filtering to "Grunge" also drops the artists who have none.
  const albums = useMemo(
    () => (family ? sortAlbums(albumsWithGenre(family, sub), "artist") : []),
    [family, sub],
  );
  const artists = useMemo(() => sortArtists(groupArtists(albums), "name"), [albums]);

  if (library.isPending) {
    return (
      <PageContainer>
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      </PageContainer>
    );
  }

  if (library.isError) {
    return (
      <PageContainer>
        <Alert status="danger">
          <Alert.Content>
            <Alert.Title>{t("loadFailed")}</Alert.Title>
            <Alert.Description>{String(library.error)}</Alert.Description>
          </Alert.Content>
        </Alert>
      </PageContainer>
    );
  }

  // Same reasoning as the album and artist pages: a recompute can empty a
  // family out from under an open page. `replace` so Back does not walk
  // straight into the dead route again.
  if (!family) return <Navigate to={paths.libraryGenres} replace />;

  return (
    <PageContainer>
      <GenreHero family={family} label={labelOf(family.key)} />

      <SubGenreChips subs={family.subs} selected={sub} onSelect={setSub} />

      {/* A family can hold tracks and no album at all — every one of them is a
       * minority on a record filed elsewhere. Saying so beats an empty shelf. */}
      {albums.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">{t("genres.noAlbums")}</p>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight">{t("genres.albums")}</h2>
            <AlbumGrid
              albums={albums}
              animationKey={`${family.key}:${sub ?? ""}`}
              onPlay={(album) => playTrack(album.tracks[0])}
            />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight">{t("genres.artists")}</h2>
            <ArtistGrid
              artists={artists}
              animationKey={`${family.key}:${sub ?? ""}`}
              onPlay={(artist) => playTrack(artist.albums[0].tracks[0])}
            />
          </section>
        </>
      )}
    </PageContainer>
  );
}
