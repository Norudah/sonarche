import { Alert, Spinner } from "@heroui/react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useParams } from "react-router";

import { paths } from "@/app/routes";
import { findAlbum, groupAlbums } from "@/features/library/albums/albums";
import { AlbumActions } from "@/features/library/albums/AlbumActions";
import { AlbumHero } from "@/features/library/albums/AlbumHero";
import { AlbumTrackList } from "@/features/library/albums/AlbumTrackList";
import { DeleteAlbumDialog, type AlbumDeletion } from "@/features/library/DeleteAlbumDialog";
import { useLibrary } from "@/features/library/hooks";
import { usePlayTrack } from "@/features/library/usePlayTrack";
import { PageContainer } from "@/shared/ui/PageContainer";

export function AlbumDetailView() {
  const { t } = useTranslation("library");
  const { artist = "", title = "" } = useParams();
  const library = useLibrary();
  const playTrack = usePlayTrack();
  const [deleting, setDeleting] = useState<AlbumDeletion | null>(null);

  const album = useMemo(
    () => findAlbum(groupAlbums(library.data ?? []), artist, title),
    [library.data, artist, title],
  );

  if (library.isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (library.isError) {
    return (
      <Alert status="danger">
        <Alert.Content>
          <Alert.Title>{t("loadFailed")}</Alert.Title>
          <Alert.Description>{String(library.error)}</Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }

  // Not only a bad key: deleting the album's last track refetches the library
  // and this page outlives its own subject. Bouncing back to the shelf beats
  // stranding the user on an "album not found" screen they just caused.
  // `replace` so Back does not walk straight into the dead route again.
  if (!album) return <Navigate to={paths.libraryAlbums} replace />;

  return (
    <PageContainer>
      <AlbumHero album={album} />
      <AlbumActions
        album={album}
        onPlay={() => playTrack(album.tracks[0])}
        onDelete={() =>
          setDeleting({ title: album.title, trackIds: album.tracks.map((track) => track.id) })
        }
      />
      <AlbumTrackList album={album} />
      <DeleteAlbumDialog album={deleting} onClose={() => setDeleting(null)} />
    </PageContainer>
  );
}
