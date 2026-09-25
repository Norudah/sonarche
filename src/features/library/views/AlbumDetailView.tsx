import { Alert, Spinner } from "@heroui/react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useParams } from "react-router";

import { albumPath, paths } from "@/app/routes";
import { findAlbum, findAlbumLike, groupAlbums, type Album } from "@/features/library/albums/albums";
import { AlbumHero } from "@/features/library/albums/AlbumHero";
import { AlbumInspectModal } from "@/features/library/albums/inspect/AlbumInspectModal";
import { AddTracksDialog } from "@/features/library/albums/AddTracksDialog";
import { MoveToAlbumDialog } from "@/features/library/albums/MoveToAlbumDialog";
import { AlbumStickyHeader } from "@/features/library/albums/AlbumStickyHeader";
import { AlbumTrackList } from "@/features/library/albums/AlbumTrackList";
import { useHeroPassed } from "@/features/library/albums/useHeroPassed";
import { DeleteAlbumDialog, useAlbumDeleteGuard, type AlbumDeletion } from "@/features/library/DeleteAlbumDialog";
import type { LibraryTrack } from "@/features/library/api";
import { useLibrary } from "@/features/library/hooks";
import { AddToPlaylistDialog } from "@/features/library/playlists/AddToPlaylistDialog";
import { TrackFilterBar } from "@/features/library/tracks/TrackFilterBar";
import { useTrackFilter } from "@/features/library/tracks/useTrackFilter";
import { usePlayQueue } from "@/features/library/usePlayQueue";
import { PageContainer } from "@/shared/ui/PageContainer";

/** Stable empty array, so memos don't churn. */
const NO_TRACKS: LibraryTrack[] = [];

export function AlbumDetailView() {
  const { t } = useTranslation("library");
  const { artist = "", title = "" } = useParams();
  const library = useLibrary();
  const { playOrdered, playShuffled } = usePlayQueue();
  const mayDelete = useAlbumDeleteGuard();
  const [deleting, setDeleting] = useState<AlbumDeletion | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [addingToPlaylist, setAddingToPlaylist] = useState(false);
  const [movingAlbum, setMovingAlbum] = useState(false);
  const [addingTracks, setAddingTracks] = useState(false);
  /** The last resolved record; see the rename handling below. */
  const [held, setHeld] = useState<Album | null>(null);
  const { ref: heroRef, passed: heroPassed } = useHeroPassed<HTMLElement>();

  const albums = groupAlbums(library.data ?? []);
  const album = useMemo(() => findAlbum(albums, artist, title), [albums, artist, title]);
  // Every axis is a refinement on a single record.
  const explorer = useTrackFilter(album?.tracks ?? NO_TRACKS);

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

  // A rename changed the route's identity: find the record by its tracks and
  // follow it (`replace`).
  if (!album && held) {
    const renamed = findAlbumLike(albums, held);
    if (renamed) return <Navigate to={albumPath(renamed.artist, renamed.title)} replace />;
  }

  // The album is gone (e.g. its last track was deleted): back to the shelf.
  if (!album) return <Navigate to={paths.libraryAlbums} replace />;

  return (
    <PageContainer
      sticky={<AlbumStickyHeader album={album} isVisible={heroPassed} onPlay={() => playOrdered(explorer.visible)} />}
    >
      <AlbumHero
        ref={heroRef}
        album={album}
        // Plays the visible list, filters included.
        onPlay={() => playOrdered(explorer.visible)}
        onShuffle={() => playShuffled(explorer.visible)}
        onEdit={() => setInspecting(true)}
        onDelete={() => {
          if (!mayDelete(album.albumIds)) return;
          setDeleting({ title: album.title, trackIds: album.tracks.map((track) => track.id) });
        }}
        onAddToPlaylist={() => setAddingToPlaylist(true)}
        onMoveToAlbum={() => setMovingAlbum(true)}
        onAddTracks={() => setAddingTracks(true)}
      />
      {/* Unpinned: the album's sticky header takes this spot. */}
      <TrackFilterBar state={explorer} pinned={false} />
      <AlbumTrackList album={album} state={explorer} />
      <DeleteAlbumDialog album={deleting} onClose={() => setDeleting(null)} />
      <AlbumInspectModal album={inspecting ? album : null} onClose={() => setInspecting(false)} />
      <AddToPlaylistDialog tracks={addingToPlaylist ? album.tracks : null} onClose={() => setAddingToPlaylist(false)} />
      <MoveToAlbumDialog tracks={movingAlbum ? album.tracks : null} onClose={() => setMovingAlbum(false)} />
      <AddTracksDialog album={addingTracks ? album : null} onClose={() => setAddingTracks(false)} />
    </PageContainer>
  );
}
