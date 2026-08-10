import { Alert, Spinner } from "@heroui/react";
import { ListMusic } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useParams } from "react-router";

import { paths } from "@/app/routes";
import { useHeroPassed } from "@/features/library/albums/useHeroPassed";
import { useLibrary } from "@/features/library/hooks";
import { DeletePlaylistDialog, type PlaylistDeletion } from "@/features/library/playlists/DeletePlaylistDialog";
import { PlaylistEditDialog } from "@/features/library/playlists/PlaylistEditDialog";
import { PlaylistHero } from "@/features/library/playlists/PlaylistHero";
import { PlaylistStickyHeader } from "@/features/library/playlists/PlaylistStickyHeader";
import { PlaylistTrackList } from "@/features/library/playlists/PlaylistTrackList";
import { usePlaylists } from "@/features/library/playlists/hooks";
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
  const [editing, setEditing] = useState(false);
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
        onEdit={() => setEditing(true)}
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

      <PlaylistEditDialog
        playlist={playlist}
        tracks={tracks}
        existing={playlists.data ?? []}
        reservedNames={[t("playlists.favorites")]}
        isOpen={editing}
        onClose={() => setEditing(false)}
      />
      <DeletePlaylistDialog
        playlist={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => navigate(paths.libraryPlaylists, { replace: true })}
      />
    </PageContainer>
  );
}
