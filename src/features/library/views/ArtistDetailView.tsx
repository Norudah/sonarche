import { Alert, Spinner } from "@heroui/react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useParams, useSearchParams } from "react-router";

import { paths } from "@/app/routes";
import { groupAlbums } from "@/features/library/albums/albums";
import { AlbumGrid } from "@/features/library/albums/AlbumGrid";
import { useHeroPassed } from "@/features/library/albums/useHeroPassed";
import { appearancesOf, findArtist, groupArtists } from "@/features/library/artists/artists";
import { ArtistAppearances } from "@/features/library/artists/ArtistAppearances";
import { ArtistHero } from "@/features/library/artists/ArtistHero";
import { ArtistStickyHeader } from "@/features/library/artists/ArtistStickyHeader";
import { useLibrary } from "@/features/library/hooks";
import { TrackFilterBar } from "@/features/library/tracks/TrackFilterBar";
import { TrackResults } from "@/features/library/tracks/TrackResults";
import { useTrackFilter, type TrackAxis } from "@/features/library/tracks/useTrackFilter";
import { usePlayQueue } from "@/features/library/usePlayQueue";
import { parseViewMode } from "@/features/library/viewMode";
import { ViewModeSwitch } from "@/features/library/ViewModeSwitch";
import { PageContainer } from "@/shared/ui/PageContainer";

/** Both axes are offered, and both hide themselves when the discography holds
 * only one value — which is the usual case for the family and the unusual one
 * for the category, since an artist writing for film has two. */
const AXES: readonly TrackAxis[] = ["family", "category"];

export function ArtistDetailView() {
  const { t } = useTranslation("library");
  const { name = "" } = useParams();
  const mode = parseViewMode(useSearchParams()[0]);
  const library = useLibrary();
  const { playOrdered, playShuffled } = usePlayQueue();
  const { ref: heroRef, passed: heroPassed } = useHeroPassed<HTMLElement>();

  const artist = useMemo(() => findArtist(groupArtists(groupAlbums(library.data ?? [])), name), [library.data, name]);
  const appearances = useMemo(() => appearancesOf(library.data ?? [], name), [library.data, name]);

  /**
   * The discography by era, then the guest spots.
   *
   * The appearances are in: a mode called "Morceaux" that quietly left out a
   * featuring would be lying by omission, and they are the one thing this page
   * shows that no other view does. The rows say which is which — see
   * `guestOwner` on the table.
   */
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

  // Same reasoning as the album page: deleting the artist's last track refetches
  // the library and this page outlives its own subject. `replace` so Back does
  // not walk straight into the dead route again.
  if (!artist) return <Navigate to={paths.libraryArtists} replace />;

  // The discography as one queue: `albums` is already chronological, so this
  // plays the artist by era, album by album. In the tracks mode the visible list
  // is what plays instead — filters and search included.
  const queue = () => (mode === "tracks" ? explorer.visible : artist.albums.flatMap((album) => album.tracks));
  const playAll = () => playOrdered(queue());
  const shuffleAll = () => playShuffled(queue());

  return (
    <PageContainer
      // No sticky subject bar in the tracks mode: it and the filter bar both pin
      // to the top of the scrollport, and the filters are what a long list needs
      // within reach. The switch back is in the hero, one scroll up.
      sticky={
        mode === "overview" ? <ArtistStickyHeader artist={artist} isVisible={heroPassed} onPlay={playAll} /> : undefined
      }
    >
      <ArtistHero
        ref={heroRef}
        artist={artist}
        onPlay={playAll}
        onShuffle={shuffleAll}
        actions={<ViewModeSwitch overviewLabel={t("artists.overviewMode")} tracksLabel={t("views.tracks")} />}
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
            <AlbumGrid
              albums={artist.albums}
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
