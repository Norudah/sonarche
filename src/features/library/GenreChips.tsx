/**
 * The genres of whatever the hero is about, under its meta line.
 *
 * They sat in the album's action row until the re-match result needed a place
 * to land: a chip beside four buttons wrapped the whole row the moment any text
 * appeared after it, and the band jumped as you clicked. They are not actions —
 * describing the record is the meta line's job, so they belong on it.
 */
export function GenreChips({ genres }: { genres: string[] }) {
  if (genres.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {genres.map((genre) => (
        <span
          key={genre}
          className="rounded-full border border-separator bg-surface/70 px-2.5 py-1 text-[0.6875rem] text-foreground"
        >
          {genre}
        </span>
      ))}
    </div>
  );
}
