import { Alert, Spinner } from "@heroui/react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useParams } from "react-router";

import { paths } from "@/app/routes";
import { findAlbum, groupAlbums } from "@/features/library/albums/albums";
import { AlbumHero } from "@/features/library/albums/AlbumHero";
import { AlbumMetadataDrawer } from "@/features/library/AlbumMetadataDrawer";
import { AlbumStickyHeader } from "@/features/library/albums/AlbumStickyHeader";
import { AlbumTrackList } from "@/features/library/albums/AlbumTrackList";
import { useHeroPassed } from "@/features/library/albums/useHeroPassed";
import { DeleteAlbumDialog, type AlbumDeletion } from "@/features/library/DeleteAlbumDialog";
import { useLibrary } from "@/features/library/hooks";
import { usePlayQueue } from "@/features/library/usePlayQueue";
import { PageContainer } from "@/shared/ui/PageContainer";

export function AlbumDetailView() {
  const { t } = useTranslation("library");
  const { artist = "", title = "" } = useParams();
  const library = useLibrary();
  const playQueue = usePlayQueue();
  const [deleting, setDeleting] = useState<AlbumDeletion | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const { ref: heroRef, passed: heroPassed } = useHeroPassed<HTMLElement>();

  const album = useMemo(() => findAlbum(groupAlbums(library.data ?? []), artist, title), [library.data, artist, title]);

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

  // Not only a bad key: deleting the album's last track refetches the library
  // and this page outlives its own subject. Bouncing back to the shelf beats
  // stranding the user on an "album not found" screen they just caused.
  // `replace` so Back does not walk straight into the dead route again.
  if (!album) return <Navigate to={paths.libraryAlbums} replace />;

  return (
    <PageContainer
      sticky={<AlbumStickyHeader album={album} isVisible={heroPassed} onPlay={() => playQueue(album.tracks, 0)} />}
    >
      <AlbumHero
        ref={heroRef}
        album={album}
        onPlay={() => playQueue(album.tracks, 0)}
        onInspect={() => setInspecting(true)}
        onDelete={() => setDeleting({ title: album.title, trackIds: album.tracks.map((track) => track.id) })}
      />
      <AlbumTrackList album={album} />
      <DeleteAlbumDialog album={deleting} onClose={() => setDeleting(null)} />
      <AlbumMetadataDrawer album={inspecting ? album : null} onClose={() => setInspecting(false)} />
    </PageContainer>
  );
}
