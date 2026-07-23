import { Alert, Spinner } from "@heroui/react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useParams } from "react-router";

import { paths } from "@/app/routes";
import { groupAlbums } from "@/features/library/albums/albums";
import { AlbumGrid } from "@/features/library/albums/AlbumGrid";
import { useHeroPassed } from "@/features/library/albums/useHeroPassed";
import { appearancesOf, findArtist, groupArtists } from "@/features/library/artists/artists";
import { ArtistAppearances } from "@/features/library/artists/ArtistAppearances";
import { ArtistHero } from "@/features/library/artists/ArtistHero";
import { ArtistStickyHeader } from "@/features/library/artists/ArtistStickyHeader";
import { useLibrary } from "@/features/library/hooks";
import { usePlayQueue } from "@/features/library/usePlayQueue";
import { PageContainer } from "@/shared/ui/PageContainer";

export function ArtistDetailView() {
  const { t } = useTranslation("library");
  const { name = "" } = useParams();
  const library = useLibrary();
  const { playOrdered, playShuffled } = usePlayQueue();
  const { ref: heroRef, passed: heroPassed } = useHeroPassed<HTMLElement>();

  const artist = useMemo(() => findArtist(groupArtists(groupAlbums(library.data ?? [])), name), [library.data, name]);
  const appearances = useMemo(() => appearancesOf(library.data ?? [], name), [library.data, name]);

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
  // plays the artist by era, album by album.
  const discography = () => artist.albums.flatMap((album) => album.tracks);
  const playAll = () => playOrdered(discography());
  const shuffleAll = () => playShuffled(discography());

  return (
    <PageContainer sticky={<ArtistStickyHeader artist={artist} isVisible={heroPassed} onPlay={playAll} />}>
      <ArtistHero ref={heroRef} artist={artist} onPlay={playAll} onShuffle={shuffleAll} />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{t("artists.discography")}</h2>
        <AlbumGrid
          albums={artist.albums}
          animationKey={artist.name}
          fromArtist
          onPlay={(album) => playOrdered(album.tracks)}
        />
      </section>

      <ArtistAppearances tracks={appearances} name={artist.name} />
    </PageContainer>
  );
}
