import { Alert, Spinner } from "@heroui/react";
import { ListMusic, Plus } from "lucide-react";
import { useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import { useLibrary } from "@/features/library/hooks";
import { PlaylistCard } from "@/features/library/playlists/PlaylistCard";
import { PlaylistNameDialog } from "@/features/library/playlists/PlaylistNameDialog";
import { useCreatePlaylist, usePlaylists } from "@/features/library/playlists/hooks";
import {
  orderedPlaylists,
  playlistCovers,
  resolvePlaylistTracks,
  tracksById,
} from "@/features/library/playlists/playlists";
import { usePlayQueue } from "@/features/library/usePlayQueue";
import { EmptyState } from "@/shared/ui/EmptyState";
import { PageContainer } from "@/shared/ui/PageContainer";
import { PrimaryButton } from "@/shared/ui/PrimaryButton";

/**
 * The playlists shelf. No search bar and no sort: this shelf holds what the
 * user curated by hand — dozens at the very most, not the thousands the other
 * explorers are built to narrow down.
 */
export function PlaylistsView() {
  const { t } = useTranslation("library");
  const playlists = usePlaylists();
  const library = useLibrary();
  const { playOrdered } = usePlayQueue();
  const create = useCreatePlaylist();
  const [creating, setCreating] = useState(false);

  const byId = tracksById(library.data ?? []);
  const rows = orderedPlaylists(playlists.data ?? []);
  const isPending = playlists.isPending || library.isPending;
  const error = playlists.error ?? library.error;

  const createButton = (
    <PrimaryButton onPress={() => setCreating(true)}>
      <Plus className="size-4" />
      {t("playlists.create")}
    </PrimaryButton>
  );

  return (
    <PageContainer>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t("views.playlists")}</h1>
          <p className="mt-0.5 text-[0.8125rem] text-muted">{t("playlists.count", { count: rows.length })}</p>
        </div>
        {rows.length > 0 && createButton}
      </div>

      {isPending && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {error != null && (
        <Alert status="danger">
          <Alert.Content>
            <Alert.Title>{t("loadFailed")}</Alert.Title>
            <Alert.Description>{String(error)}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {!isPending && error == null && rows.length === 0 && (
        <EmptyState
          icon={ListMusic}
          title={t("playlists.empty.title")}
          body={t("playlists.empty.body")}
          action={createButton}
        />
      )}

      {rows.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-5 gap-y-7">
          {rows.map((playlist, position) => {
            const tracks = resolvePlaylistTracks(playlist.itemIds, byId);
            return (
              <PlaylistCard
                key={playlist.id}
                playlist={playlist}
                displayName={playlist.kind === "favorites" ? t("playlists.favorites") : playlist.name}
                covers={playlistCovers(tracks)}
                trackCount={tracks.length}
                style={{ "--row-stagger": `${Math.min(position, 10) * 0.025}s` } as CSSProperties}
                onPlay={() => playOrdered(tracks)}
              />
            );
          })}
        </div>
      )}

      <PlaylistNameDialog
        isOpen={creating}
        onClose={() => setCreating(false)}
        title={t("playlists.create")}
        confirmLabel={t("playlists.createConfirm")}
        existing={rows}
        reservedNames={[t("playlists.favorites")]}
        isPending={create.isPending}
        onSubmit={(name) => create.mutate(name, { onSuccess: () => setCreating(false) })}
      />
    </PageContainer>
  );
}
