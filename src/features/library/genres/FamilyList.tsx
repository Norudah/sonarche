import type { CSSProperties } from "react";

import type { Family } from "@/features/library/genres/genres";
import { FamilyCard } from "@/features/library/genres/FamilyCard";

interface FamilyListProps {
  /** Real families plus `Other` — never `None`, which is a gap in the tagging
   * rather than a shelf, and is only ever reported as a count in the header. */
  families: Family[];
  /** Same contract as `AlbumGrid`: what this result set is a result *of*.
   * A change re-keys the list and replays the cascade. */
  animationKey?: string;
  labelOf: (key: string) => string;
}

/**
 * Not virtualised, and it never will need to be: the browse families are a
 * closed list of thirteen in the sidecar's genre tree, plus the `Other`
 * sentinel. This is the one shelf in the app whose length does not depend on
 * the library.
 */
export function FamilyList({ families, animationKey = "", labelOf }: FamilyListProps) {
  return (
    <div key={animationKey} className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {families.map((family, position) => (
        <FamilyCard
          key={family.key}
          family={family}
          label={labelOf(family.key)}
          style={{ "--row-stagger": `${position * 0.03}s` } as CSSProperties}
        />
      ))}
    </div>
  );
}
