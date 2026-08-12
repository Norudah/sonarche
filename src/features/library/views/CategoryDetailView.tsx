import { Alert, Spinner } from "@heroui/react";
import { Disc } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useParams, useSearchParams } from "react-router";

import { paths } from "@/app/routes";
import { groupAlbums, sortAlbums } from "@/features/library/albums/albums";
import { AlbumShelf } from "@/features/library/albums/AlbumShelf";
import { groupArtists, sortArtists } from "@/features/library/artists/artists";
import { ArtistGrid } from "@/features/library/artists/ArtistGrid";
import { albumsInCategory, findCategory, groupCategories } from "@/features/library/categories/categories";
import { CategoryGenreChips } from "@/features/library/categories/CategoryGenreChips";
import { CategoryHero } from "@/features/library/categories/CategoryHero";
import { GenreSelect } from "@/features/library/GenreSelect";
import { useCategoryLabel } from "@/features/library/categories/useCategoryLabel";
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

/** The category is the page and the genre chips own `?genre=`, so what is left
 * to offer is the family — "in Video Games, only the electronic tracks". */
const AXES: readonly TrackAxis[] = ["family"];

/** Inspects a category, or one genre inside it — the genre page's twin, with
 * the `genre` query param deciding the depth so chip flips never remount. */
export function CategoryDetailView() {
  const { t } = useTranslation("library");
  const { category: name = "" } = useParams();
  const [params] = useSearchParams();
  const genreName = params.get("genre") ?? undefined;
  const mode = parseViewMode(params);
  const library = useLibrary();
  const { playOrdered, playShuffled } = usePlayQueue();
  const labelOf = useCategoryLabel();

  const category = useMemo(() => {
    const tracks = library.data ?? [];
    return findCategory(groupCategories(tracks, groupAlbums(tracks)), name);
  }, [library.data, name]);

  const albums = useMemo(
    () => (category ? sortAlbums(albumsInCategory(category, genreName ?? null), "artist") : []),
    [category, genreName],
  );
  const artists = useMemo(() => sortArtists(groupArtists(albums), "name"), [albums]);

  const subjectTracks = useMemo(() => {
    if (!category) return [];
    return scopeTracks(
      albums,
      library.data ?? [],
      (track) => track.category === category.name && (genreName == null || track.genre === genreName),
    );
  }, [category, genreName, albums, library.data]);

  const isTracks = mode === "tracks";
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

  // Retagging can empty a category out from under an open page; `replace` so
  // Back does not walk straight into the dead route again. A vanished genre
  // falls back to its category, which is still a valid answer.
  if (!category) return <Navigate to={paths.libraryCategories} replace />;
  const genre = genreName != null ? category.genres.find((entry) => entry.name === genreName) : null;
  if (genreName != null && !genre) return <Navigate to={paths.libraryCategories} replace />;

  // What the pills launch is what the page is showing, genre chip included —
  // the same contract as the tracks page, whose pair starts the filtered list.
  // The hero's counts deliberately do not follow: they state the category.
  const queue = () => (isTracks ? explorer.visible : subjectTracks);

  return (
    <PageContainer>
      <CategoryHero
        categoryLabel={labelOf(category.name)}
        albumCount={category.albums.length}
        trackCount={category.trackCount}
        artistCount={category.artistCount}
        share={category.share}
        onPlay={() => playOrdered(queue())}
        onShuffle={() => playShuffled(queue())}
        actions={<ViewModeSwitch overviewLabel={t("categories.overviewMode")} tracksLabel={t("views.tracks")} />}
      />

      {/* Same split as the genre page: chips above the shelves, one pill in the
       * bar when the page is a list. */}
      {!isTracks && <CategoryGenreChips genres={category.genres} selected={genre?.name ?? null} />}

      {isTracks ? (
        <>
          <TrackFilterBar
            state={explorer}
            leading={<GenreSelect options={category.genres} selected={genre?.name ?? null} />}
          />
          <TrackResults state={explorer} />
        </>
      ) : albums.length === 0 ? (
        <NoResults icon={Disc} message={t("categories.noAlbums")} />
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight">{t("genres.albums")}</h2>
            <AlbumShelf
              albums={albums}
              pool={groupAlbums(library.data ?? [])}
              animationKey={category.name}
              onPlay={(album) => playOrdered(album.tracks)}
            />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight">{t("genres.artists")}</h2>
            <ArtistGrid
              artists={artists}
              animationKey={category.name}
              onPlay={(artist) => playOrdered(artist.albums.flatMap((album) => album.tracks))}
            />
          </section>
        </>
      )}
    </PageContainer>
  );
}
