import { useState } from "react";

import { findAlbumLike, type Album } from "@/features/library/albums/albums";
import { AlbumGrid } from "@/features/library/albums/AlbumGrid";
import { AlbumRows } from "@/features/library/albums/AlbumRows";
import { AlbumInspectModal } from "@/features/library/albums/inspect/AlbumInspectModal";
import type { ShelfLayout } from "@/features/library/shelfLayout";

interface AlbumShelfProps {
  albums: Album[];
  /** See `AlbumGrid`. */
  animationKey?: string;
  /** Only the albums page offers rows. */
  layout?: ShelfLayout;
  onPlay: (album: Album) => void;
  /** The whole library for the drawer's lookup, so an edit that moves the record
   * out of a filtered shelf doesn't close the panel mid-save. */
  pool?: Album[];
}

/** A playable, editable shelf. Hosts one metadata modal for all its cards. */
export function AlbumShelf({ albums, animationKey, layout = "grid", onPlay, pool = albums }: AlbumShelfProps) {
  const [inspectedKey, setInspectedKey] = useState<string | null>(null);
  // Derived from the live list so refetches update the panel. Kept across a
  // rename, which changes the lookup key; the record is found again by its tracks.
  const [held, setHeld] = useState<Album | null>(null);
  const byKey = inspectedKey != null ? (pool.find((album) => album.key === inspectedKey) ?? null) : null;
  const inspected = byKey ?? (inspectedKey != null && held ? findAlbumLike(pool, held) : null);
  if (inspected && inspected !== held) setHeld(inspected);
  if (inspected && inspected.key !== inspectedKey) setInspectedKey(inspected.key);

  return (
    <>
      {layout === "list" ? (
        <AlbumRows
          albums={albums}
          animationKey={animationKey}
          onPlay={onPlay}
          onEdit={(album) => setInspectedKey(album.key)}
        />
      ) : (
        <AlbumGrid
          albums={albums}
          animationKey={animationKey}
          onPlay={onPlay}
          onEdit={(album) => setInspectedKey(album.key)}
        />
      )}
      <AlbumInspectModal album={inspected} onClose={() => setInspectedKey(null)} />
    </>
  );
}
