import type { Album } from "@/features/library/albums/albums";
import type { LibraryTrack } from "@/features/library/api";
import { normalize } from "@/shared/lib/text";

/** A genre that resolves to no browse family — the sidecar's `genre_tree`
 * only promotes 13 roots, everything else (african, asian, world…) lands here. */
export const FAMILY_OTHER = "__other__";
/** No genre at all. The only actionable family: it points at Metadata. */
export const FAMILY_NONE = "__none__";

export interface SubGenre {
  name: string;
  trackCount: number;
}

export interface Family {
  /** Browse family as computed by the sidecar, or one of the two sentinels.
   * Also the identity and the route segment. */
  key: string;
  /** Every track whose own genre resolves to this family. */
  trackCount: number;
  /** Albums whose *majority* of tracks belong here — see `majorityFamilyOf`.
   * Chronology is not meaningful across artists, so the album order is
   * whatever `groupAlbums` produced; the view sorts. */
  albums: Album[];
  /** Distinct album artists across `albums`. */
  artistCount: number;
  /** Share of the whole library, 0…1. The bar's only input. */
  share: number;
  /** Specific genres found under this family, most frequent first. Empty for
   * `FAMILY_NONE`, which is defined by the absence of one. */
  subs: SubGenre[];
}

/** The two sentinels always sink, however big they get: a large pile of
 * unclassified tracks is a problem to fix, not the headline of the page. */
function rankOf(key: string): number {
  if (key === FAMILY_OTHER) return 1;
  if (key === FAMILY_NONE) return 2;
  return 0;
}

export function familyKeyOf(track: LibraryTrack): string {
  if (track.genreBucket) return track.genreBucket;
  return track.genre ? FAMILY_OTHER : FAMILY_NONE;
}

interface Tally {
  trackCount: number;
  subs: Map<string, number>;
}

/**
 * The family that owns an album, by plurality of its tracks.
 *
 * An album genuinely split across two families has to land in exactly one, or
 * the same record would show up twice on two different pages with no way to
 * tell which is "the" one. Ties break on the bigger family, then on the key —
 * never on iteration order, which would let an album jump between pages
 * between two renders of the same library.
 */
function majorityFamilyOf(album: Album, tallies: Map<string, Tally>): string {
  const counts = new Map<string, number>();
  for (const track of album.tracks) {
    const key = familyKeyOf(track);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let best: string | null = null;
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (best == null || count > bestCount) {
      best = key;
      bestCount = count;
      continue;
    }
    if (count < bestCount) continue;
    const bigger = (tallies.get(key)?.trackCount ?? 0) - (tallies.get(best)?.trackCount ?? 0);
    if (bigger > 0 || (bigger === 0 && key.localeCompare(best) < 0)) best = key;
  }
  return best ?? FAMILY_NONE;
}

/**
 * The whole page in one pass over the tracks plus one over the albums.
 *
 * `trackCount` and `albums.length` are counted on two different units and do
 * not derive from each other: a track is filed under its own genre, an album
 * under its plurality. A family can hold tracks and no album (they are all
 * minorities on records that belong elsewhere) — that is correct, not a bug.
 */
export function groupFamilies(tracks: LibraryTrack[], albums: Album[]): Family[] {
  const tallies = new Map<string, Tally>();

  for (const track of tracks) {
    const key = familyKeyOf(track);
    let tally = tallies.get(key);
    if (!tally) {
      tally = { trackCount: 0, subs: new Map() };
      tallies.set(key, tally);
    }
    tally.trackCount += 1;
    if (track.genre) tally.subs.set(track.genre, (tally.subs.get(track.genre) ?? 0) + 1);
  }

  const byFamily = new Map<string, Album[]>();
  for (const album of albums) {
    const key = majorityFamilyOf(album, tallies);
    const existing = byFamily.get(key);
    if (existing) existing.push(album);
    else byFamily.set(key, [album]);
  }

  const total = tracks.length;

  return Array.from(tallies.entries())
    .map(([key, tally]) => {
      const familyAlbums = byFamily.get(key) ?? [];
      return {
        key,
        trackCount: tally.trackCount,
        albums: familyAlbums,
        artistCount: new Set(familyAlbums.map((album) => album.artist)).size,
        share: total === 0 ? 0 : tally.trackCount / total,
        subs: Array.from(tally.subs.entries())
          .map(([name, trackCount]) => ({ name, trackCount }))
          .sort((a, b) => b.trackCount - a.trackCount || a.name.localeCompare(b.name)),
      };
    })
    .sort(
      (a, b) =>
        rankOf(a.key) - rankOf(b.key) ||
        b.trackCount - a.trackCount ||
        a.key.localeCompare(b.key),
    );
}

/** Distinct specific genres across the whole library — the header's second
 * figure. Counted here rather than summed from `subs` so that a genre filed
 * under two families is not counted twice. */
export function countGenres(families: Family[]): number {
  const names = new Set<string>();
  for (const family of families) {
    for (const sub of family.subs) names.add(sub.name);
  }
  return names.size;
}

/** Same contract as `filterArtists`: every term must match somewhere, so
 * "rock daft" finds the family through one of its records. */
export function filterFamilies(families: Family[], query: string): Family[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return families;

  return families.filter((family) => {
    const haystack = normalize(
      [
        family.key,
        ...family.subs.map((sub) => sub.name),
        ...family.albums.map((album) => `${album.title} ${album.artist}`),
      ].join(" "),
    );
    return terms.every((term) => haystack.includes(term));
  });
}

export function findFamily(families: Family[], key: string): Family | null {
  return families.find((family) => family.key === key) ?? null;
}

/** Albums of a family carrying a given specific genre — what a sub-genre chip
 * filters down to. An album qualifies as soon as one of its tracks matches:
 * the chip narrows the shelf, it does not re-run the plurality rule. */
export function albumsWithGenre(family: Family, genre: string | null): Album[] {
  if (genre == null) return family.albums;
  return family.albums.filter((album) => album.tracks.some((track) => track.genre === genre));
}
