import type { Album } from "@/features/library/albums/albums";
import type { LibraryTrack } from "@/features/library/api";

/**
 * Canonical category values, exactly as they are stored in the grouping tag.
 *
 * English on purpose: the tag travels with the file and must read the same in
 * any other library, like the genre names do. The UI translates these known
 * values for display (see `useCategoryLabel`); a free value outside the
 * taxonomy is shown as typed. A starter set, curated as the need appears —
 * the same doctrine as the genre tree.
 *
 * "Music" leads because it is the ordinary case: a band's record is music, not
 * the score of something else, and the axis only becomes interesting once a
 * library holds both. The rest name the medium the music was written for, and
 * "Cartoon" sits apart from "Anime" the way the shelves themselves do.
 */
export const CATEGORY_TAXONOMY = ["Music", "Video Games", "Film", "Series", "Anime", "Cartoon", "Musical"] as const;

export interface CategoryGenre {
  name: string;
  trackCount: number;
}

/**
 * One category as a browsable object. The whole point of the axis is cutting
 * across genres — an OST shelf holds synthwave next to orchestral — so the
 * card surfaces the genres it crosses instead of a second category level.
 */
export interface Category {
  /** The stored tag value. Identity, display fallback, and route segment. */
  name: string;
  /** Tracks carrying the category. */
  trackCount: number;
  /** Albums where at least one track carries it — an album mid-edit must not
   * vanish from the shelf because only half its tracks are tagged yet. */
  albums: Album[];
  /** Distinct album artists across `albums`. */
  artistCount: number;
  /** Share of the whole library, 0…1 — same scale as `Family.share`. */
  share: number;
  /** Genres found among the category's tracks, most frequent first. */
  genres: CategoryGenre[];
}

/**
 * The Categories index in one pass over the tracks plus one over the albums.
 *
 * No sentinel buckets, unlike the genres page: a track without a category is
 * the normal case, not a problem to fix, so absence gets neither a card nor a
 * banner. Cards are ordered by size — that ordering is the page.
 */
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

/** The category's albums carrying a given genre — what a genre chip narrows
 * the shelf to. Same contract as `albumsWithGenre` on the family page: the
 * chip filters, it does not re-run membership. */
export function albumsInCategory(category: Category, genre: string | null): Album[] {
  if (genre == null) return category.albums;
  return category.albums.filter((album) =>
    album.tracks.some((track) => track.category === category.name && track.genre === genre),
  );
}
