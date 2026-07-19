import { Alert, Spinner } from "@heroui/react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { paths } from "@/app/routes";
import {
  filterAlbums,
  groupAlbums,
  sortAlbums,
  type AlbumSort,
} from "@/features/library/albums/albums";
import { AlbumGrid } from "@/features/library/albums/AlbumGrid";
import { AlbumsHeader } from "@/features/library/albums/AlbumsHeader";
import { useLibrary } from "@/features/library/hooks";
import { usePlayTrack } from "@/features/library/usePlayTrack";
import { fade } from "@/shared/motion/tokens";
import { PageContainer } from "@/shared/ui/PageContainer";

export function AlbumsView() {
  const { t } = useTranslation("library");
  const library = useLibrary();
  const playTrack = usePlayTrack();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<AlbumSort>("recent");

  const albums = useMemo(() => groupAlbums(library.data ?? []), [library.data]);
  const visible = useMemo(
    () => sortAlbums(filterAlbums(albums, query), sort),
    [albums, query, sort],
  );

  return (
    <PageContainer>
      <AlbumsHeader
        albumCount={albums.length}
        trackCount={albums.reduce((sum, album) => sum + album.tracks.length, 0)}
        query={query}
        onQueryChange={setQuery}
        sort={sort}
        onSortChange={setSort}
      />

      {library.isPending && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {library.isError && (
        <Alert status="danger">
          <Alert.Content>
            <Alert.Title>{t("loadFailed")}</Alert.Title>
            <Alert.Description>{String(library.error)}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {library.data && albums.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-4xl">♪</p>
          <p className="text-muted">{t("albums.empty")}</p>
          <Link to={paths.download} className="text-accent underline-offset-4 hover:underline">
            {t("goToDownload")}
          </Link>
        </div>
      )}

      {albums.length > 0 && visible.length === 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={fade}
          className="py-16 text-center text-sm text-muted"
        >
          {t("albums.noResults", { query })}
        </motion.p>
      )}

      {visible.length > 0 && (
        <AlbumGrid
          albums={visible}
          animationKey={`${query}:${sort}`}
          onPlay={(album) => playTrack(album.tracks[0])}
        />
      )}
    </PageContainer>
  );
}
