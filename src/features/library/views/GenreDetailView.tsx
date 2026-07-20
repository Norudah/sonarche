import { Alert, Spinner } from "@heroui/react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useParams, useSearchParams } from "react-router";

import { paths } from "@/app/routes";
import { groupAlbums, sortAlbums } from "@/features/library/albums/albums";
import { AlbumGrid } from "@/features/library/albums/AlbumGrid";
import { groupArtists, sortArtists } from "@/features/library/artists/artists";
import { ArtistGrid } from "@/features/library/artists/ArtistGrid";
import {
  albumsWithGenre,
  findFamily,
  findGenre,
  groupFamilies,
  listGenres,
} from "@/features/library/genres/genres";
import { GenreHero } from "@/features/library/genres/GenreHero";
import { SubGenreChips } from "@/features/library/genres/SubGenreChips";
import { useFamilyLabel } from "@/features/library/genres/useFamilyLabel";
import { useLibrary } from "@/features/library/hooks";
import { usePlayTrack } from "@/features/library/usePlayTrack";
import { PageContainer } from "@/shared/ui/PageContainer";

/** Inspects a family, or a genre inside it — the `genre` query param is what
 * decides, so the selection survives navigating away and back without the page
 * remounting each time it changes. */
export function GenreDetailView() {
  const { t } = useTranslation("library");
  const { family: key = "" } = useParams();
  const genreName = useSearchParams()[0].get("genre") ?? undefined;
  const library = useLibrary();
  const playTrack = usePlayTrack();
  const labelOf = useFamilyLabel();

  const { family, genre } = useMemo(() => {
    const tracks = library.data ?? [];
    const families = groupFamilies(tracks, groupAlbums(tracks));
    return {
      family: findFamily(families, key),
      genre:
        genreName == null ? null : findGenre(listGenres(families, tracks.length), key, genreName),
    };
  }, [library.data, key, genreName]);

  // The genre narrows the albums; the artists follow from whatever is left, so
  // inspecting "Grunge" also drops the artists who have none.
  const albums = useMemo(
    () => (family ? sortAlbums(albumsWithGenre(family, genreName ?? null), "artist") : []),
    [family, genreName],
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
  // A genre that no longer exists falls back to its family rather than all the
  // way out — the family is still a valid answer to what the user asked for.
  if (genreName != null && !genre) return <Navigate to={paths.libraryGenres} replace />;

  const subject = genre ?? family;

  return (
    <PageContainer>
      <GenreHero
        family={family.key}
        familyLabel={labelOf(family.key)}
        genre={genre?.name ?? null}
        albums={family.albums}
        albumCount={subject.albums.length}
        trackCount={subject.trackCount}
        artistCount={subject.artistCount}
        share={subject.share}
      />

      <SubGenreChips family={family.key} subs={family.subs} selected={genre?.name ?? null} />

      {/* A family can hold tracks and no album at all — every one of them is a
       * minority on a record filed elsewhere. Saying so beats an empty shelf. */}
      {/* Keyed on the family, not on the genre. Re-keying on the genre threw
       * away every card and rebuilt the shelf on what is only a filter change,
       * which is what made the page jump. Album and artist keys are stable, so
       * flipping a chip now removes and adds the cards that actually differ and
       * leaves the rest where they are. */}
      {albums.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">{t("genres.noAlbums")}</p>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight">{t("genres.albums")}</h2>
            <AlbumGrid
              albums={albums}
              animationKey={family.key}
              onPlay={(album) => playTrack(album.tracks[0])}
            />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight">{t("genres.artists")}</h2>
            <ArtistGrid
              artists={artists}
              animationKey={family.key}
              onPlay={(artist) => playTrack(artist.albums[0].tracks[0])}
            />
          </section>
        </>
      )}
    </PageContainer>
  );
}
