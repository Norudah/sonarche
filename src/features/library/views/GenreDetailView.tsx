import { Alert, Spinner } from "@heroui/react";
import { Disc } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useParams, useSearchParams } from "react-router";

import { genrePath, paths } from "@/app/routes";
import { groupAlbums, sortAlbums } from "@/features/library/albums/albums";
import { AlbumShelf } from "@/features/library/albums/AlbumShelf";
import { groupArtists, sortArtists } from "@/features/library/artists/artists";
import { ArtistShelf } from "@/features/library/artists/ArtistShelf";
import {
  albumsWithGenre,
  familyKeyOf,
  findFamily,
  findGenre,
  groupFamilies,
  isFamilyRootGenre,
  listGenres,
} from "@/features/library/genres/genres";
import { ClassifyGenreMenu } from "@/features/library/genres/ClassifyGenreMenu";
import { GenreHero } from "@/features/library/genres/GenreHero";
import { useClassifyGenre, useGenreOverrides } from "@/features/library/genres/useClassifyGenre";
import { GenreSelect } from "@/features/library/GenreSelect";
import { SubGenreChips } from "@/features/library/genres/SubGenreChips";
import { useFamilyLabel } from "@/features/library/genres/useFamilyLabel";
import { useLibrary } from "@/features/library/hooks";
import { scopeTracks } from "@/features/library/tracks/scope";
import { TrackFilterBar } from "@/features/library/tracks/TrackFilterBar";
import { TrackResults } from "@/features/library/tracks/TrackResults";
import { useTrackFilter, type TrackAxis } from "@/features/library/tracks/useTrackFilter";
import { usePlayQueue } from "@/features/library/usePlayQueue";
import { parseViewMode } from "@/features/library/viewMode";
import { ViewModeSwitch } from "@/features/library/ViewModeSwitch";
import { NoResults } from "@/shared/ui/EmptyState";
import { PageContainer } from "@/shared/ui/PageContainer";

/** Family and genre are the page's own, so only the category is offered.
 * Module-level for a stable identity. */
const AXES: readonly TrackAxis[] = ["category"];

/** A family, or a genre within it via `?genre=` (no remount on chip flips). */
export function GenreDetailView() {
  const { t } = useTranslation("library");
  const { family: key = "" } = useParams();
  const [params] = useSearchParams();
  const genreName = params.get("genre") ?? undefined;
  const mode = parseViewMode(params);
  const library = useLibrary();
  const { playOrdered, playShuffled } = usePlayQueue();
  const labelOf = useFamilyLabel();
  const overrides = useGenreOverrides();
  const classify = useClassifyGenre();

  const { families, family, genre } = useMemo(() => {
    const tracks = library.data ?? [];
    const families = groupFamilies(tracks, groupAlbums(tracks));
    return {
      families,
      family: findFamily(families, key),
      genre: genreName == null ? null : findGenre(listGenres(families, tracks.length), key, genreName),
    };
  }, [library.data, key, genreName]);

  // Artists follow from the filtered albums.
  const albums = useMemo(
    () => (family ? sortAlbums(albumsWithGenre(family, genreName ?? null), "artist") : []),
    [family, genreName],
  );
  const artists = useMemo(() => sortArtists(groupArtists(albums), "name"), [albums]);

  const isTracks = mode === "tracks";
  const subjectTracks = useMemo(() => {
    if (!family) return [];
    return scopeTracks(albums, library.data ?? [], (track) =>
      genreName != null ? track.genre === genreName : familyKeyOf(track) === family.key,
    );
  }, [family, genreName, albums, library.data]);

  const explorer = useTrackFilter(subjectTracks, AXES);

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

  // Reclassified: follow the genre to its new family (`replace`), before the
  // family guard since the move may have emptied this one.
  if (genreName != null && !genre) {
    const movedTo = families.find((candidate) => candidate.subs.some((sub) => sub.name === genreName));
    if (movedTo) return <Navigate to={genrePath(movedTo.key, genreName)} replace />;
    return <Navigate to={paths.libraryGenres} replace />;
  }
  // The family is gone: back to the index.
  if (!family) return <Navigate to={paths.libraryGenres} replace />;

  const subject = genre ?? family;
  // Plays what the page shows.
  const queue = () => (isTracks ? explorer.visible : subjectTracks);

  // Genre depth only, and never for a family root.
  const override = genre != null ? (overrides.data?.get(genre.name.toLowerCase()) ?? null) : null;
  const classifyMenu =
    genre != null && !isFamilyRootGenre(genre.name) ? (
      <ClassifyGenreMenu
        currentKey={family.key}
        override={override}
        onClassify={(target) => classify.run(genre.name, target, override)}
        isPending={classify.isPending}
      />
    ) : undefined;

  return (
    <PageContainer>
      <GenreHero
        family={family.key}
        familyLabel={labelOf(family.key)}
        genre={genre?.name ?? null}
        albumCount={subject.albums.length}
        trackCount={subject.trackCount}
        artistCount={subject.artistCount}
        share={subject.share}
        onPlay={() => playOrdered(queue())}
        onShuffle={() => playShuffled(queue())}
        actions={<ViewModeSwitch overviewLabel={t("genres.overviewMode")} tracksLabel={t("views.tracks")} />}
        classify={classifyMenu}
      />

      {/* Chips above shelves; a pill in the bar in tracks mode. */}
      {!isTracks && <SubGenreChips subs={family.subs} selected={genre?.name ?? null} />}

      {isTracks ? (
        <>
          <TrackFilterBar
            state={explorer}
            leading={<GenreSelect options={family.subs} selected={genre?.name ?? null} />}
          />
          <TrackResults state={explorer} />
        </>
      ) : albums.length === 0 ? (
        /* Every track may be a minority on albums filed elsewhere; tracks are one switch away. */
        <NoResults icon={Disc} message={t("genres.noAlbums")} />
      ) : (
        <>
          {/* Keyed on the family, not the genre, so a chip flip only moves differing cards. */}
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight">{t("genres.albums")}</h2>
            <AlbumShelf
              albums={albums}
              pool={groupAlbums(library.data ?? [])}
              animationKey={family.key}
              onPlay={(album) => playOrdered(album.tracks)}
            />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight">{t("genres.artists")}</h2>
            <ArtistShelf
              artists={artists}
              animationKey={family.key}
              onPlay={(artist) => playOrdered(artist.albums.flatMap((album) => album.tracks))}
            />
          </section>
        </>
      )}
    </PageContainer>
  );
}
