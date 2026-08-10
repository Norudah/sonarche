import { Alert, Spinner } from "@heroui/react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useParams } from "react-router";

import { albumPath, paths } from "@/app/routes";
import { findAlbum, findAlbumLike, groupAlbums, type Album } from "@/features/library/albums/albums";
import { AlbumHero } from "@/features/library/albums/AlbumHero";
import { AlbumInspectModal } from "@/features/library/albums/inspect/AlbumInspectModal";
import { AlbumStickyHeader } from "@/features/library/albums/AlbumStickyHeader";
import { AlbumTrackList } from "@/features/library/albums/AlbumTrackList";
import { useHeroPassed } from "@/features/library/albums/useHeroPassed";
import { DeleteAlbumDialog, type AlbumDeletion } from "@/features/library/DeleteAlbumDialog";
import { useLibrary } from "@/features/library/hooks";
import { AddToPlaylistDialog } from "@/features/library/playlists/AddToPlaylistDialog";
import { usePlayQueue } from "@/features/library/usePlayQueue";
import { PageContainer } from "@/shared/ui/PageContainer";

export function AlbumDetailView() {
  const { t } = useTranslation("library");
  const { artist = "", title = "" } = useParams();
  const library = useLibrary();
  const { playOrdered, playShuffled } = usePlayQueue();
  const [deleting, setDeleting] = useState<AlbumDeletion | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [addingToPlaylist, setAddingToPlaylist] = useState(false);
  /** The last record this route resolved to — see the rename note below. */
  const [held, setHeld] = useState<Album | null>(null);
  const { ref: heroRef, passed: heroPassed } = useHeroPassed<HTMLElement>();

  const albums = groupAlbums(library.data ?? []);
  const album = useMemo(() => findAlbum(albums, artist, title), [albums, artist, title]);

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

  if (album && album !== held) setHeld(album);

  // Renaming a record from the panel moves the very identity this route is built
  // from, so the URL stops matching anything. The record is still there — find it
  // by its tracks and send the route after it, rather than reading the mismatch
  // as a deletion. `replace` so Back does not walk into the dead name.
  if (!album && held) {
    const renamed = findAlbumLike(albums, held);
    if (renamed) return <Navigate to={albumPath(renamed.artist, renamed.title)} replace />;
  }

  // Nothing left under this route and nothing that used to be: deleting the
  // album's last track refetches the library and this page outlives its own
  // subject. Bouncing back to the shelf beats stranding the user on an "album
  // not found" screen they just caused.
  if (!album) return <Navigate to={paths.libraryAlbums} replace />;

  return (
    <PageContainer
      sticky={<AlbumStickyHeader album={album} isVisible={heroPassed} onPlay={() => playOrdered(album.tracks)} />}
    >
      <AlbumHero
        ref={heroRef}
        album={album}
        onPlay={() => playOrdered(album.tracks)}
        onShuffle={() => playShuffled(album.tracks)}
        onEdit={() => setInspecting(true)}
        onDelete={() => setDeleting({ title: album.title, trackIds: album.tracks.map((track) => track.id) })}
        onAddToPlaylist={() => setAddingToPlaylist(true)}
      />
      <AlbumTrackList album={album} />
      <DeleteAlbumDialog album={deleting} onClose={() => setDeleting(null)} />
      <AlbumInspectModal album={inspecting ? album : null} onClose={() => setInspecting(false)} />
      <AddToPlaylistDialog tracks={addingToPlaylist ? album.tracks : null} onClose={() => setAddingToPlaylist(false)} />
    </PageContainer>
  );
}
