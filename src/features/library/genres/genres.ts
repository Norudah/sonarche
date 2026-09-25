import type { Album } from "@/features/library/albums/albums";
import type { LibraryTrack } from "@/features/library/api";
import { createTextFilter } from "@/shared/lib/search";

/** A genre outside the tree's family roots (african, asian, world…). */
export const FAMILY_OTHER = "__other__";
/** No genre at all; points at the Metadata page. */
export const FAMILY_NONE = "__none__";

/** The browse families, by the sidecar's display labels (same set `tone.ts`
 * colours), in the tree's order. */
export const FAMILY_KEYS = [
  "Metal",
  "Rock",
  "Pop",
  "Electronic",
  "Hip-Hop",
  "R&B, Soul & Funk",
  "Jazz",
  "Blues",
  "Folk & Country",
  "Classical",
  "Reggae",
  "Latin",
  "World",
] as const;

/** A genre that is a family root can't be refiled (the sidecar refuses). Both
 * the tree spelling ("hip hop") and the label ("Hip-Hop") count. */
const FAMILY_ROOT_GENRES = new Set([...FAMILY_KEYS.map((key) => key.toLowerCase()), "hip hop", "r&b"]);

export function isFamilyRootGenre(genre: string): boolean {
  return FAMILY_ROOT_GENRES.has(genre.trim().toLowerCase());
}

export interface SubGenre {
  name: string;
  trackCount: number;
}

export interface Family {
  /** Family from the sidecar, or a sentinel; identity and route segment. */
  key: string;
  /** Tracks whose own genre resolves here. */
  trackCount: number;
  /** Albums whose majority of tracks belong here (see `majorityFamilyOf`). */
  albums: Album[];
  artistCount: number;
  /** 0…1 of the library. */
  share: number;
  /** Most frequent first; empty for `FAMILY_NONE`. */
  subs: SubGenre[];
}

/** Sentinels always sort last. */
function rankOf(key: string): number {
  if (key === FAMILY_OTHER) return 1;
  if (key === FAMILY_NONE) return 2;
  return 0;
}

export function familyKeyOf(track: LibraryTrack): string {
  if (track.genreBucket) return track.genreBucket;
  return track.genre ? FAMILY_OTHER : FAMILY_NONE;
}

/** Genre name → family key, for genre routes. */
export function genreFamilyIndex(tracks: LibraryTrack[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const track of tracks) {
    if (track.genre && !index.has(track.genre)) index.set(track.genre, familyKeyOf(track));
  }
  return index;
}

interface Tally {
  trackCount: number;
  subs: Map<string, number>;
}

/** The family owning an album, by plurality, so an album appears on one page
 * only. Ties break on family size, then key. */
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

/** The genres page in two passes. Tracks count by their own genre, albums by
 * plurality, so a family can hold tracks and no album. */
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
    .sort((a, b) => rankOf(a.key) - rankOf(b.key) || b.trackCount - a.trackCount || a.key.localeCompare(b.key));
}

/** A genre identified by (family, name): one tagged inconsistently appears in
 * two families rather than hiding half its tracks. */
export interface Genre {
  name: string;
  /** Also the route's first segment. */
  family: string;
  trackCount: number;
  albums: Album[];
  artistCount: number;
  /** 0…1 of the library, like `Family.share`. */
  share: number;
}

/** Genres from every family, largest first. Albums are scoped within the family. */
export function listGenres(families: Family[], totalTracks: number): Genre[] {
  return families
    .flatMap((family) =>
      family.subs.map((sub) => {
        const albums = albumsWithGenre(family, sub.name);
        return {
          name: sub.name,
          family: family.key,
          trackCount: sub.trackCount,
          albums,
          artistCount: new Set(albums.map((album) => album.artist)).size,
          share: totalTracks === 0 ? 0 : sub.trackCount / totalTracks,
        };
      }),
    )
    .sort((a, b) => b.trackCount - a.trackCount || a.name.localeCompare(b.name));
}

export function findGenre(genres: Genre[], family: string, name: string): Genre | null {
  return genres.find((genre) => genre.family === family && genre.name === name) ?? null;
}

/** Distinct genres; one in two families counts once. */
export function countGenres(families: Family[]): number {
  const names = new Set<string>();
  for (const family of families) {
    for (const sub of family.subs) names.add(sub.name);
  }
  return names.size;
}

/** Matches family and genre names only, not the albums or artists inside. */
export const filterFamilies = createTextFilter<Family>((family) =>
  [family.key, ...family.subs.map((sub) => sub.name)].join(" "),
);

export function findFamily(families: Family[], key: string): Family | null {
  return families.find((family) => family.key === key) ?? null;
}

/** Albums of a family with at least one track in the genre. */
export function albumsWithGenre(family: Family, genre: string | null): Album[] {
  if (genre == null) return family.albums;
  return family.albums.filter((album) => album.tracks.some((track) => track.genre === genre));
}
