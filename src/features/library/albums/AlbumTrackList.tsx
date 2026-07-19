import { type CSSProperties, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Album } from "@/features/library/albums/albums";
import { AlbumTrackRow } from "@/features/library/albums/AlbumTrackRow";
import type { LibraryTrack } from "@/features/library/api";
import { DeleteTrackDialog } from "@/features/library/DeleteTrackDialog";
import { MetadataDrawer } from "@/features/library/MetadataDrawer";

const COLUMN =
  "px-3 pb-2 text-left text-[0.6875rem] font-semibold uppercase tracking-wider text-muted";

/**
 * Deliberately not `TrackTable`: an album's tracklist drops the Album and Genre
 * columns (both are album-level and already in the header), keeps its own fixed
 * order, and only shows an artist column on a compilation. Bending one table to
 * cover both shapes would have meant a variant prop toggling four columns.
 */
export function AlbumTrackList({ album }: { album: Album }) {
  const { t } = useTranslation("library");
  const [inspectedId, setInspectedId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<LibraryTrack | null>(null);

  // Derived from the live album, so a re-enrich refetch updates the open drawer.
  const inspected =
    inspectedId != null ? (album.tracks.find((track) => track.id === inspectedId) ?? null) : null;

  const showArtist = new Set(album.tracks.map((track) => track.artist)).size > 1;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] table-fixed border-separate border-spacing-y-0.5">
          <thead>
            <tr className="[&>th]:border-b [&>th]:border-separator/60">
              <th className={`${COLUMN} w-14`}>#</th>
              <th className={COLUMN}>{t("columns.title")}</th>
              {showArtist && <th className={`${COLUMN} w-[22%]`}>{t("columns.artist")}</th>}
              <th className={`${COLUMN} w-16 text-right`}>{t("columns.duration")}</th>
              <th className={`${COLUMN} w-16`}>
                <span className="sr-only">{t("columns.actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody key={album.key}>
            {album.tracks.map((track, position) => (
              <AlbumTrackRow
                key={track.id}
                track={track}
                position={position + 1}
                showArtist={showArtist}
                style={{ "--row-stagger": `${Math.min(position, 10) * 0.025}s` } as CSSProperties}
                onInspect={() => setInspectedId(track.id)}
                onDelete={() => setDeleting(track)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <MetadataDrawer
        track={inspected}
        onClose={() => setInspectedId(null)}
        onDelete={setDeleting}
      />
      <DeleteTrackDialog track={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}
