import { useState } from "react";

import { findAlbumLike, type Album } from "@/features/library/albums/albums";
import { AlbumGrid } from "@/features/library/albums/AlbumGrid";
import { AlbumInspectModal } from "@/features/library/albums/inspect/AlbumInspectModal";

interface AlbumShelfProps {
  albums: Album[];
  /** Same contract as `AlbumGrid`: what this result set is a result *of*. */
  animationKey?: string;
  onPlay: (album: Album) => void;
  /**
   * Every album in the library, for the drawer to look its record up in.
   * Defaults to the displayed set; a shelf that shows a *subset* (the albums
   * page filters and sorts, an artist page holds one discography) should pass
   * the whole list, so an edit that moves the record out of the shelf does not
   * slam the panel shut mid-save.
   */
  pool?: Album[];
}

/**
 * A shelf of covers you can play *and* open.
 *
 * The pencil used to live on the albums page alone, because that page was the
 * only one hosting the metadata modal — so the same cover offered an edit on
 * one screen and not on the next, which reads as a bug rather than as a rule.
 * Hosting the modal here means every shelf in the app carries it: the albums
 * page, an artist's discography, a genre, a category.
 *
 * One modal per shelf and not one per card: a wall of two hundred covers must
 * not mount two hundred dialogs to let one of them be edited — the same
 * reasoning that put the image modal in `ArtistGrid`.
 */
export function AlbumShelf({ albums, animationKey, onPlay, pool = albums }: AlbumShelfProps) {
  const [inspectedKey, setInspectedKey] = useState<string | null>(null);
  // Derived from the live list, not a snapshot — a re-enrich refetch must update
  // the open panel, not a stale copy. Held across a rename: editing the album or
  // its artist changes the very key this lookup uses, and dropping the panel
  // mid-save is not what "you renamed it" should look like. The record is found
  // again by its tracks.
  const [held, setHeld] = useState<Album | null>(null);
  const byKey = inspectedKey != null ? (pool.find((album) => album.key === inspectedKey) ?? null) : null;
  const inspected = byKey ?? (inspectedKey != null && held ? findAlbumLike(pool, held) : null);
  if (inspected && inspected !== held) setHeld(inspected);
  if (inspected && inspected.key !== inspectedKey) setInspectedKey(inspected.key);

  return (
    <>
      <AlbumGrid
        albums={albums}
        animationKey={animationKey}
        onPlay={onPlay}
        onEdit={(album) => setInspectedKey(album.key)}
      />
      <AlbumInspectModal album={inspected} onClose={() => setInspectedKey(null)} />
    </>
  );
}
