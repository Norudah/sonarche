import type { Album } from "@/features/library/albums/albums";
import type { LibraryTrack } from "@/features/library/api";

/** Canonical values as stored in the grouping tag. English, like genre names,
 * so tags read the same everywhere; translated for display
 * (`useCategoryLabel`). Free values show as typed. */
export const CATEGORY_TAXONOMY = ["Music", "Video Games", "Film", "Series", "Anime", "Cartoon", "Musical"] as const;

export interface CategoryGenre {
  name: string;
  trackCount: number;
}

/** A category cuts across genres, so its card lists the genres it spans. */
export interface Category {
  /** Stored value: identity, fallback label and route segment. */
  name: string;
  trackCount: number;
  /** Albums where any track carries it, so half-tagged albums don't vanish. */
  albums: Album[];
  artistCount: number;
  /** 0…1, like `Family.share`. */
  share: number;
  /** Most frequent first. */
  genres: CategoryGenre[];
}

/** The Categories index. No sentinel for "no category": that's the normal case. */
export function groupCategories(tracks: LibraryTrack[], albums: Album[]): Category[] {
  const tallies = new Map<string, { trackCount: number; genres: Map<string, number> }>();
  for (const track of tracks) {
    if (!track.category) continue;
    let tally = tallies.get(track.category);
    if (!tally) {
      tally = { trackCount: 0, genres: new Map() };
      tallies.set(track.category, tally);
    }
    tally.trackCount += 1;
    if (track.genre) tally.genres.set(track.genre, (tally.genres.get(track.genre) ?? 0) + 1);
  }

  const total = tracks.length;

  return Array.from(tallies.entries())
    .map(([name, tally]) => {
      const members = albums.filter((album) => album.tracks.some((track) => track.category === name));
      return {
        name,
        trackCount: tally.trackCount,
        albums: members,
        artistCount: new Set(members.map((album) => album.artist)).size,
        share: total === 0 ? 0 : tally.trackCount / total,
        genres: Array.from(tally.genres.entries())
          .map(([genre, trackCount]) => ({ name: genre, trackCount }))
          .sort((a, b) => b.trackCount - a.trackCount || a.name.localeCompare(b.name)),
      };
    })
    .sort((a, b) => b.trackCount - a.trackCount || a.name.localeCompare(b.name));
}

export function findCategory(categories: Category[], name: string): Category | null {
  return categories.find((category) => category.name === name) ?? null;
}

/** Albums carrying a genre within the category (like `albumsWithGenre`). */
export function albumsInCategory(category: Category, genre: string | null): Album[] {
  if (genre == null) return category.albums;
  return category.albums.filter((album) =>
    album.tracks.some((track) => track.category === category.name && track.genre === genre),
  );
}
