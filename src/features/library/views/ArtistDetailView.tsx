import { Alert, Spinner } from "@heroui/react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useParams, useSearchParams } from "react-router";

import { paths } from "@/app/routes";
import { groupAlbums } from "@/features/library/albums/albums";
import { AlbumShelf } from "@/features/library/albums/AlbumShelf";
import { useHeroPassed } from "@/features/library/albums/useHeroPassed";
import { appearancesOf, findArtist, groupArtists } from "@/features/library/artists/artists";
import { ArtistAppearances } from "@/features/library/artists/ArtistAppearances";
import { ArtistHero } from "@/features/library/artists/ArtistHero";
import { ArtistImageModal } from "@/features/library/artists/ArtistImageModal";
import { ArtistStickyHeader } from "@/features/library/artists/ArtistStickyHeader";
import { useArtistImages, useLibrary } from "@/features/library/hooks";
import { TrackFilterBar } from "@/features/library/tracks/TrackFilterBar";
import { TrackResults } from "@/features/library/tracks/TrackResults";
import { useTrackFilter, type TrackAxis } from "@/features/library/tracks/useTrackFilter";
import { usePlayQueue } from "@/features/library/usePlayQueue";
import { parseViewMode } from "@/features/library/viewMode";
import { ViewModeSwitch } from "@/features/library/ViewModeSwitch";
import { PageContainer } from "@/shared/ui/PageContainer";

/** Both axes; each hides itself with a single value. */
const AXES: readonly TrackAxis[] = ["family", "category"];

export function ArtistDetailView() {
  const { t } = useTranslation("library");
  const { name = "" } = useParams();
  const mode = parseViewMode(useSearchParams()[0]);
  const library = useLibrary();
  const { playOrdered, playShuffled } = usePlayQueue();
  const { ref: heroRef, passed: heroPassed } = useHeroPassed<HTMLElement>();
  const images = useArtistImages();
  const [isImageOpen, setIsImageOpen] = useState(false);

  const artist = useMemo(() => findArtist(groupArtists(groupAlbums(library.data ?? [])), name), [library.data, name]);
  const appearances = useMemo(() => appearancesOf(library.data ?? [], name), [library.data, name]);

  /** The discography by era, then guest spots (marked via `guestOwner`). */
  const subjectTracks = useMemo(
    () => (artist ? [...artist.albums.flatMap((album) => album.tracks), ...appearances] : []),
    [artist, appearances],
  );

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

  // The artist is gone: back to the shelf.
  if (!artist) return <Navigate to={paths.libraryArtists} replace />;

  // The discography chronologically, or the visible list in tracks mode.
  const queue = () => (mode === "tracks" ? explorer.visible : artist.albums.flatMap((album) => album.tracks));
  const playAll = () => playOrdered(queue());
  const shuffleAll = () => playShuffled(queue());
  const imageUrl = images.data?.get(artist.name) ?? null;

  return (
    <PageContainer
      // No sticky subject bar in tracks mode: the filter bar pins there.
      sticky={
        mode === "overview" ? (
          <ArtistStickyHeader artist={artist} imageUrl={imageUrl} isVisible={heroPassed} onPlay={playAll} />
        ) : undefined
      }
    >
      <ArtistHero
        ref={heroRef}
        artist={artist}
        imageUrl={imageUrl}
        onPlay={playAll}
        onShuffle={shuffleAll}
        onEdit={() => setIsImageOpen(true)}
        actions={<ViewModeSwitch overviewLabel={t("artists.overviewMode")} tracksLabel={t("views.tracks")} />}
      />

      <ArtistImageModal
        artist={artist}
        imageUrl={imageUrl}
        isOpen={isImageOpen}
        onClose={() => setIsImageOpen(false)}
      />

      {mode === "tracks" ? (
        <>
          <TrackFilterBar state={explorer} />
          <TrackResults state={explorer} guestOwner={artist.name} />
        </>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight">{t("artists.discography")}</h2>
            <AlbumShelf
              albums={artist.albums}
              // The whole library, so renaming an album's artist doesn't close the panel.
              pool={groupAlbums(library.data ?? [])}
              animationKey={artist.name}
              onPlay={(album) => playOrdered(album.tracks)}
            />
          </section>

          <ArtistAppearances tracks={appearances} name={artist.name} />
        </>
      )}
    </PageContainer>
  );
}
