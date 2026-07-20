import type { CSSProperties } from "react";

import type { Family } from "@/features/library/genres/genres";
import { FamilyRow } from "@/features/library/genres/FamilyRow";
import { toneOf } from "@/features/library/genres/tone";

interface FamilyListProps {
  families: Family[];
  /** Same contract as `AlbumGrid`: what this result set is a result *of*.
   * A change re-keys the list and replays the cascade. */
  animationKey?: string;
  /** Built from the unfiltered library, so neither a colour nor a bar length
   * moves when the user types. */
  tones: Map<string, string>;
  peakShare: number;
  labelOf: (key: string) => string;
}

/**
 * Not virtualised, and it never will need to be: the browse families are a
 * closed list of thirteen in the sidecar's genre tree, plus the two sentinels.
 * This is the one shelf in the app whose length does not depend on the library.
 */
export function FamilyList({ families, animationKey = "", tones, peakShare, labelOf }: FamilyListProps) {
  return (
    <div key={animationKey} className="flex flex-col">
      {families.map((family, position) => (
        <FamilyRow
          key={family.key}
          family={family}
          tone={toneOf(tones, family.key)}
          peakShare={peakShare}
          label={labelOf(family.key)}
          style={{ "--row-stagger": `${position * 0.03}s` } as CSSProperties}
        />
      ))}
    </div>
  );
}
