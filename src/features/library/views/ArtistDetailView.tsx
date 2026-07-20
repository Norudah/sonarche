import { Alert, Spinner } from "@heroui/react";
import { Play } from "lucide-react";
import { motion } from "motion/react";
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
import { usePlayTrack } from "@/features/library/usePlayTrack";
import { springs } from "@/shared/motion/tokens";
import { PageContainer } from "@/shared/ui/PageContainer";

export function ArtistDetailView() {
  const { t } = useTranslation("library");
  const { name = "" } = useParams();
  const library = useLibrary();
  const playTrack = usePlayTrack();
  const { ref: heroRef, passed: heroPassed } = useHeroPassed<HTMLElement>();

  const artist = useMemo(
    () => findArtist(groupArtists(groupAlbums(library.data ?? [])), name),
    [library.data, name],
  );
  const appearances = useMemo(
    () => appearancesOf(library.data ?? [], name),
    [library.data, name],
  );

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

  const playFirst = () => playTrack(artist.albums[0].tracks[0]);

  return (
    <PageContainer
      sticky={
        <ArtistStickyHeader artist={artist} isVisible={heroPassed} onPlay={playFirst} />
      }
    >
      <ArtistHero ref={heroRef} artist={artist} />

      {/* No delete action, unlike the album page. "Delete this artist" would
       * wipe an unbounded number of albums behind one click, and nothing about
       * the page makes that scope visible before it happens. */}
      <div className="flex items-center gap-3">
        <motion.button
          type="button"
          onClick={playFirst}
          aria-label={t("playAll")}
          whileTap={{ scale: 0.94 }}
          whileHover={{ scale: 1.05 }}
          transition={springs.snappy}
          className="flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg shadow-accent/30 outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <Play className="size-5 fill-current" />
        </motion.button>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{t("artists.discography")}</h2>
        <AlbumGrid
          albums={artist.albums}
          animationKey={artist.name}
          fromArtist
          onPlay={(album) => playTrack(album.tracks[0])}
        />
      </section>

      <ArtistAppearances tracks={appearances} name={artist.name} />
    </PageContainer>
  );
}
