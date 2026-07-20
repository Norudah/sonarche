import type { CSSProperties } from "react";

import type { Family } from "@/features/library/genres/genres";
import { FamilyRow } from "@/features/library/genres/FamilyRow";
import { rampSizeOf } from "@/features/library/genres/tone";

interface FamilyListProps {
  families: Family[];
  /** Same contract as `AlbumGrid`: what this result set is a result *of*.
   * A change re-keys the list and replays the cascade. */
  animationKey?: string;
  labelOf: (key: string) => string;
}

/**
 * Not virtualised, and it never will need to be: the browse families are a
 * closed list of thirteen in the sidecar's genre tree, plus the two sentinels.
 * This is the one shelf in the app whose length does not depend on the library.
 */
export function FamilyList({ families, animationKey = "", labelOf }: FamilyListProps) {
  const rampSize = rampSizeOf(families);
  const peakShare = Math.max(...families.map((family) => family.share), 0);

  return (
    <div key={animationKey} className="flex flex-col">
      {families.map((family, position) => (
        <FamilyRow
          key={family.key}
          family={family}
          rank={position}
          rampSize={rampSize}
          peakShare={peakShare}
          label={labelOf(family.key)}
          style={{ "--row-stagger": `${position * 0.03}s` } as CSSProperties}
        />
      ))}
    </div>
  );
}
