import { Alert, Spinner } from "@heroui/react";
import { ListMusic } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useParams } from "react-router";

import { paths } from "@/app/routes";
import { useHeroPassed } from "@/features/library/albums/useHeroPassed";
import { useLibrary } from "@/features/library/hooks";
import { DeletePlaylistDialog, type PlaylistDeletion } from "@/features/library/playlists/DeletePlaylistDialog";
import { PlaylistHero } from "@/features/library/playlists/PlaylistHero";
import { PlaylistImageModal } from "@/features/library/playlists/PlaylistImageModal";
import { PlaylistMarkerDialog } from "@/features/library/playlists/PlaylistMarkerDialog";
import { PlaylistNameDialog } from "@/features/library/playlists/PlaylistNameDialog";
import { PlaylistStickyHeader } from "@/features/library/playlists/PlaylistStickyHeader";
import { PlaylistTrackList } from "@/features/library/playlists/PlaylistTrackList";
import { usePlaylists, useRenamePlaylist } from "@/features/library/playlists/hooks";
import { playlistCovers, resolvePlaylistTracks, tracksById } from "@/features/library/playlists/playlists";
import { usePlayQueue } from "@/features/library/usePlayQueue";
import { EmptyState } from "@/shared/ui/EmptyState";
import { PageContainer } from "@/shared/ui/PageContainer";

export function PlaylistDetailView() {
  const { t } = useTranslation("library");
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const playlists = usePlaylists();
  const library = useLibrary();
  const { playOrdered, playShuffled } = usePlayQueue();
  const rename = useRenamePlaylist();
  const [renaming, setRenaming] = useState(false);
  const [editingImage, setEditingImage] = useState(false);
  const [editingMarker, setEditingMarker] = useState(false);
  const [deleting, setDeleting] = useState<PlaylistDeletion | null>(null);
  const { ref: heroRef, passed: heroPassed } = useHeroPassed<HTMLElement>();

  const playlistId = Number(id);
  const playlist = (playlists.data ?? []).find((row) => row.id === playlistId) ?? null;

  if (playlists.isPending || library.isPending) {
    return (
      <PageContainer>
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      </PageContainer>
    );
  }

  const error = playlists.error ?? library.error;
  if (error != null) {
    return (
      <PageContainer>
        <Alert status="danger">
          <Alert.Content>
            <Alert.Title>{t("loadFailed")}</Alert.Title>
            <Alert.Description>{String(error)}</Alert.Description>
          </Alert.Content>
        </Alert>
      </PageContainer>
    );
  }

  // Deleted (from this very page, or another window) or a dead id: back to the
  // shelf rather than a "not found" screen the user cannot act on.
  if (!playlist) return <Navigate to={paths.libraryPlaylists} replace />;

  const isFavorites = playlist.kind === "favorites";
  const displayName = isFavorites ? t("playlists.favorites") : playlist.name;
  const tracks = resolvePlaylistTracks(playlist.itemIds, tracksById(library.data ?? []));

  return (
    <PageContainer
      sticky={
        <PlaylistStickyHeader
          name={displayName}
          trackCount={tracks.length}
          covers={playlistCovers(tracks)}
          customUrl={playlist.coverUrl}
          favorites={isFavorites}
          isVisible={heroPassed}
          onPlay={() => playOrdered(tracks)}
        />
      }
    >
      <PlaylistHero
        ref={heroRef}
        playlist={playlist}
        displayName={displayName}
        tracks={tracks}
        onPlay={() => playOrdered(tracks)}
        onShuffle={() => playShuffled(tracks)}
        onEditImage={() => setEditingImage(true)}
        onEditMarker={() => setEditingMarker(true)}
        onRename={() => setRenaming(true)}
        onDelete={() => setDeleting({ id: playlist.id, name: playlist.name, trackCount: tracks.length })}
      />

      {tracks.length === 0 ? (
        <EmptyState
          icon={ListMusic}
          title={isFavorites ? t("playlists.emptyFavorites.title") : t("playlists.emptyDetail.title")}
          body={isFavorites ? t("playlists.emptyFavorites.body") : t("playlists.emptyDetail.body")}
        />
      ) : (
        <PlaylistTrackList playlistId={playlist.id} tracks={tracks} />
      )}

      <PlaylistNameDialog
        isOpen={renaming}
        onClose={() => setRenaming(false)}
        title={t("playlists.renameAction")}
        confirmLabel={t("playlists.renameConfirm")}
        initialName={playlist.name}
        existing={playlists.data ?? []}
        reservedNames={[t("playlists.favorites")]}
        excludingId={playlist.id}
        isPending={rename.isPending}
        onSubmit={(name) => rename.mutate({ id: playlist.id, name }, { onSuccess: () => setRenaming(false) })}
      />
      <PlaylistImageModal
        playlist={playlist}
        displayName={displayName}
        tracks={tracks}
        isOpen={editingImage}
        onClose={() => setEditingImage(false)}
      />
      <PlaylistMarkerDialog
        playlist={playlist}
        displayName={displayName}
        isOpen={editingMarker}
        onClose={() => setEditingMarker(false)}
        // Hands the user over to the image modal rather than leaving the
        // thumbnail option as a dead cell with an explanation.
        onAddImage={() => {
          setEditingMarker(false);
          setEditingImage(true);
        }}
      />
      <DeletePlaylistDialog
        playlist={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => navigate(paths.libraryPlaylists, { replace: true })}
      />
    </PageContainer>
  );
}
