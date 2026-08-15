import { Alert, Spinner } from "@heroui/react";
import { ListFilter, Mic2, SearchX } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { groupAlbums } from "@/features/library/albums/albums";
import {
  ARTIST_SORTS,
  filterArtists,
  groupArtists,
  sortArtists,
  type ArtistSort,
} from "@/features/library/artists/artists";
import { ArtistShelf } from "@/features/library/artists/ArtistShelf";
import { ArtistsHeader } from "@/features/library/artists/ArtistsHeader";
import { EmptyLibrary } from "@/features/library/EmptyLibrary";
import { ExplorerBar } from "@/features/library/ExplorerBar";
import { ShelfLayoutSwitch } from "@/features/library/ShelfLayoutSwitch";
import { useShelfLayout } from "@/features/library/shelfLayout";
import { SortSelect } from "@/features/library/SortSelect";
import { useArtistImages, useLibrary } from "@/features/library/hooks";
import { TriageChips, type TriageChip } from "@/features/library/TriageChips";
import { usePlayQueue } from "@/features/library/usePlayQueue";
import { NoResults } from "@/shared/ui/EmptyState";
import { PageContainer } from "@/shared/ui/PageContainer";

export function ArtistsView() {
  const { t } = useTranslation("library");
  const library = useLibrary();
  const { playOrdered } = usePlayQueue();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ArtistSort>("name");
  const [params, setParams] = useSearchParams();
  const [layout, setLayout] = useShelfLayout("artists");

  // The metadata page's door: only the artists still wearing the generated
  // motif. No filter while the image map is loading — a half-loaded map would
  // read as "everyone is missing one".
  const missingImage = params.get("missing") === "image";
  const artistImages = useArtistImages();

  // Two memos rather than one: the album grouping is the expensive half and it
  // does not depend on the query or the sort, so it must not rerun on a keystroke.
  const artists = useMemo(() => groupArtists(groupAlbums(library.data ?? [])), [library.data]);
  const triaged = useMemo(
    () =>
      missingImage && artistImages.data != null
        ? artists.filter((artist) => !artistImages.data.has(artist.name))
        : artists,
    [artists, missingImage, artistImages.data],
  );
  const visible = useMemo(() => sortArtists(filterArtists(triaged, query), sort), [triaged, query, sort]);

  const chips: TriageChip[] = [];
  if (missingImage)
    chips.push({
      key: "artistImageMissing",
      label: t("triage.artistImageMissing"),
      tone: "correction",
      onRemove: () => {
        // Removing a filter refines the entry we are on, it is not a new place.
        const next = new URLSearchParams(params);
        next.delete("missing");
        setParams(next, { replace: true });
      },
    });

  return (
    <PageContainer>
      <ArtistsHeader
        artistCount={artists.length}
        albumCount={artists.reduce((sum, artist) => sum + artist.albums.length, 0)}
        actions={<ShelfLayoutSwitch layout={layout} onChange={setLayout} />}
      />

      <ExplorerBar query={query} onQueryChange={setQuery} shown={visible.length} total={artists.length}>
        <SortSelect
          options={ARTIST_SORTS}
          value={sort}
          onChange={setSort}
          labelOf={(option) => t(`artists.sort.${option}`)}
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

      {library.data && artists.length === 0 && (
        <EmptyLibrary icon={Mic2} title={t("artists.empty.title")} body={t("artists.empty.body")} />
      )}

      {artists.length > 0 && visible.length === 0 && (
        <NoResults
          icon={query ? SearchX : ListFilter}
          message={query ? t("artists.noResults", { query }) : t("triage.noResults")}
        />
      )}

      {visible.length > 0 && (
        <ArtistShelf
          artists={visible}
          layout={layout}
          animationKey={`${params.toString()}:${query}:${sort}`}
          // The first track of the earliest album: an artist's "play" has to
          // start *somewhere*, and the discography's opening is the only choice
          // that is not arbitrary. Shuffle belongs to a queue we do not have yet.
          onPlay={(artist) => playOrdered(artist.albums.flatMap((album) => album.tracks))}
        />
      )}
    </PageContainer>
  );
}
