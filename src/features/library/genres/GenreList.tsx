import type { CSSProperties } from "react";

import type { Genre } from "@/features/library/genres/genres";
import { GenreRow } from "@/features/library/genres/GenreRow";
import { toneOf } from "@/features/library/genres/tone";

interface GenreListProps {
  genres: Genre[];
  animationKey?: string;
  tones: Map<string, string>;
  peakShare: number;
  labelOf: (key: string) => string;
}

/**
 * Unbounded, unlike the family list — the genre tree's whitelist runs to a few
 * hundred nodes and a library only ever holds the ones it uses. Still not
 * virtualised: the ceiling here is genres actually present, which is at most
 * one per track and in practice an order of magnitude below the album shelf
 * this app already renders unvirtualised. Revisit alongside it, not before.
 */
export function GenreList({
  genres,
  animationKey = "",
  tones,
  peakShare,
  labelOf,
}: GenreListProps) {
  return (
    <div key={animationKey} className="flex flex-col">
      {genres.map((genre, position) => (
        <GenreRow
          key={`${genre.family}:${genre.name}`}
          genre={genre}
          tone={toneOf(tones, genre.family)}
          peakShare={peakShare}
          familyLabel={labelOf(genre.family)}
          // Capped like the grids': the rows below the fold are not worth
          // making the user wait for.
          style={{ "--row-stagger": `${Math.min(position, 10) * 0.03}s` } as CSSProperties}
        />
      ))}
    </div>
  );
}
