import { Alert, Spinner } from "@heroui/react";
import { Disc, ListFilter, SearchX } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import {
  ALBUM_SORTS,
  filterAlbums,
  findAlbumLike,
  groupAlbums,
  sortAlbums,
  type Album,
  type AlbumSort,
} from "@/features/library/albums/albums";
import { AlbumGrid } from "@/features/library/albums/AlbumGrid";
import { AlbumInspectModal } from "@/features/library/albums/inspect/AlbumInspectModal";
import { ExplorerBar } from "@/features/library/ExplorerBar";
import { AlbumsHeader } from "@/features/library/albums/AlbumsHeader";
import { applyAlbumTriage, parseAlbumTriage } from "@/features/library/albums/triage";
import { useLibrary } from "@/features/library/hooks";
import { SortSelect } from "@/features/library/SortSelect";
import { TriageChips, type TriageChip } from "@/features/library/TriageChips";
import { EmptyLibrary } from "@/features/library/EmptyLibrary";
import { usePlayQueue } from "@/features/library/usePlayQueue";
import { NoResults } from "@/shared/ui/EmptyState";
import { PageContainer } from "@/shared/ui/PageContainer";

export function AlbumsView() {
  const { t } = useTranslation("library");
  const library = useLibrary();
  const { playOrdered } = usePlayQueue();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<AlbumSort>("artist");
  const [inspectedKey, setInspectedKey] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();

  const triage = useMemo(() => parseAlbumTriage(params), [params]);
  // No `useMemo`: `groupAlbums` caches on the array's identity, which every
  // surface shares — a memo here would only add a second cache.
  const albums = groupAlbums(library.data ?? []);
  const triaged = useMemo(() => applyAlbumTriage(albums, triage), [albums, triage]);
  const visible = useMemo(() => sortAlbums(filterAlbums(triaged, query), sort), [triaged, query, sort]);

  // Derived from the live list, not a snapshot — a re-enrich refetch must update
  // the open panel, not a stale copy. Held across a rename: editing the album or its artist changes the very key
  // this lookup uses, and dropping the panel mid-save is not what "you renamed
  // it" should look like. The record is found again by its tracks.
  const [heldInspect, setHeldInspect] = useState<Album | null>(null);
  const byKey = inspectedKey != null ? (albums.find((album) => album.key === inspectedKey) ?? null) : null;
  const inspected = byKey ?? (inspectedKey != null && heldInspect ? findAlbumLike(albums, heldInspect) : null);
  if (inspected && inspected !== heldInspect) setHeldInspect(inspected);
  if (inspected && inspected.key !== inspectedKey) setInspectedKey(inspected.key);

  // Removing a filter refines the entry we are on, it is not a new place —
  // same reasoning as the genre chips' `replace`.
  const clearParam = (name: string) => {
    const next = new URLSearchParams(params);
    next.delete(name);
    setParams(next, { replace: true });
  };

  const chips: TriageChip[] = [];
  if (triage.missingArtwork)
    chips.push({ key: "missingArtwork", label: t("triage.missingArtwork"), onRemove: () => clearParam("missing") });
  if (triage.tracklistGaps)
    chips.push({ key: "tracklistGaps", label: t("triage.tracklistGaps"), onRemove: () => clearParam("tracklist") });

  return (
    <PageContainer>
      <AlbumsHeader
        albumCount={albums.length}
        trackCount={albums.reduce((sum, album) => sum + album.tracks.length, 0)}
      />

      <ExplorerBar query={query} onQueryChange={setQuery} shown={visible.length} total={albums.length}>
        <SortSelect
          options={ALBUM_SORTS}
          value={sort}
          onChange={setSort}
          labelOf={(option) => t(`albums.sort.${option}`)}
        />
        <TriageChips chips={chips} />
      </ExplorerBar>

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
        <EmptyLibrary icon={Disc} title={t("albums.empty.title")} body={t("albums.empty.body")} />
      )}

      {albums.length > 0 && visible.length === 0 && (
        <NoResults
          icon={query ? SearchX : ListFilter}
          message={query ? t("albums.noResults", { query }) : t("triage.noResults")}
        />
      )}

      {visible.length > 0 && (
        <AlbumGrid
          albums={visible}
          animationKey={`${params.toString()}:${query}:${sort}`}
          onPlay={(album) => playOrdered(album.tracks)}
          onEdit={(album) => setInspectedKey(album.key)}
        />
      )}

      <AlbumInspectModal album={inspected} onClose={() => setInspectedKey(null)} />
    </PageContainer>
  );
}
