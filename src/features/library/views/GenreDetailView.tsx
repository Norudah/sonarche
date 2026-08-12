import { Alert, Spinner } from "@heroui/react";
import { Disc } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useParams, useSearchParams } from "react-router";

import { genrePath, paths } from "@/app/routes";
import { groupAlbums, sortAlbums } from "@/features/library/albums/albums";
import { AlbumShelf } from "@/features/library/albums/AlbumShelf";
import { groupArtists, sortArtists } from "@/features/library/artists/artists";
import { ArtistGrid } from "@/features/library/artists/ArtistGrid";
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

/** The page is already a family and, when refined, a genre — so it offers
 * neither. The category is the one axis that still cuts across what is left.
 * Module-level so the array identity is stable across renders. */
const AXES: readonly TrackAxis[] = ["category"];

/** Inspects a family, or a genre inside it — the `genre` query param is what
 * decides, so the selection survives navigating away and back without the page
 * remounting each time it changes. */
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

  // The genre narrows the albums; the artists follow from whatever is left, so
  // inspecting "Grunge" also drops the artists who have none.
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

  // Classifying the genre moved it to another shelf and the refetch just
  // landed: this route stopped matching, but the genre is still there. Find
  // where it files now and send the route after it — the AlbumDetailView
  // rename move. Before the family guard, because the move can also have
  // emptied the family this route names (its only genre left). `replace` so
  // Back does not walk into the dead placement.
  if (genreName != null && !genre) {
    const movedTo = families.find((candidate) => candidate.subs.some((sub) => sub.name === genreName));
    if (movedTo) return <Navigate to={genrePath(movedTo.key, genreName)} replace />;
    return <Navigate to={paths.libraryGenres} replace />;
  }
  // Same reasoning as the album and artist pages: a recompute can empty a
  // family out from under an open page. `replace` so Back does not walk
  // straight into the dead route again.
  if (!family) return <Navigate to={paths.libraryGenres} replace />;

  const subject = genre ?? family;
  // What the hero starts is what the page is showing: the whole subject in the
  // overview, the filtered list in the tracks mode.
  const queue = () => (isTracks ? explorer.visible : subjectTracks);

  // Genre depth only — a family is a shelf, not a thing to refile — and never
  // for a genre that *is* a family root, which the sidecar refuses to move.
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

      {/* The chips belong above a shelf. In the tracks mode the same choice
       * rides the bar as a pill instead — two rows of controls for one param is
       * how a page starts costing more height than it shows. */}
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
        /* A family can hold tracks and no album at all — every one of them is a
         * minority on a record filed elsewhere. Saying so is honest, and the
         * tracks are one switch away rather than pasted in below. */
        <NoResults icon={Disc} message={t("genres.noAlbums")} />
      ) : (
        <>
          {/* Keyed on the family, not on the genre. Re-keying on the genre threw
           * away every card and rebuilt the shelf on what is only a filter
           * change, which is what made the page jump. Album and artist keys are
           * stable, so flipping a chip now removes and adds the cards that
           * actually differ and leaves the rest where they are. */}
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
            <ArtistGrid
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
