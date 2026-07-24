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
  albumsInCategory,
  categoryTracks,
  findCategory,
  groupCategories,
} from "@/features/library/categories/categories";
import { CategoryGenreChips } from "@/features/library/categories/CategoryGenreChips";
import { CategoryHero } from "@/features/library/categories/CategoryHero";
import { useCategoryLabel } from "@/features/library/categories/useCategoryLabel";
import { useLibrary } from "@/features/library/hooks";
import { usePlayQueue } from "@/features/library/usePlayQueue";
import { PageContainer } from "@/shared/ui/PageContainer";

/** Inspects a category, or one genre inside it — the genre page's twin, with
 * the `genre` query param deciding the depth so chip flips never remount. */
export function CategoryDetailView() {
  const { t } = useTranslation("library");
  const { category: name = "" } = useParams();
  const genreName = useSearchParams()[0].get("genre") ?? undefined;
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

  const trackCount = genre ? genre.trackCount : category.trackCount;
  // The refined depth keeps the share honest: the genre's own slice of the
  // library, derived from the category's (both count the same tracks).
  const share = category.trackCount === 0 ? 0 : category.share * (trackCount / category.trackCount);
  const queue = () => categoryTracks(category, albums, genreName ?? null);

  return (
    <PageContainer>
      <CategoryHero
        category={category.name}
        categoryLabel={labelOf(category.name)}
        genre={genre?.name ?? null}
        albumCount={albums.length}
        trackCount={trackCount}
        artistCount={artists.length}
        share={share}
        onPlay={() => playOrdered(queue())}
        onShuffle={() => playShuffled(queue())}
      />

      <CategoryGenreChips category={category.name} genres={category.genres} selected={genre?.name ?? null} />

      {albums.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">{t("categories.noAlbums")}</p>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight">{t("genres.albums")}</h2>
            <AlbumGrid albums={albums} animationKey={category.name} onPlay={(album) => playOrdered(album.tracks)} />
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
