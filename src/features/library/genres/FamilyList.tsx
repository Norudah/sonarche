import type { CSSProperties } from "react";

import type { Family } from "@/features/library/genres/genres";
import { FAMILY_OTHER } from "@/features/library/genres/genres";
import { FamilyCard, GhostFamilyCard, type ArrangeProps } from "@/features/library/genres/FamilyCard";

interface FamilyListProps {
  /** Real families plus `Other` — never `None`, which is a gap in the tagging
   * rather than a shelf, and is only ever reported as a count in the header. */
  families: Family[];
  /** Same contract as `AlbumGrid`: what this result set is a result *of*.
   * A change re-keys the list and replays the cascade. */
  animationKey?: string;
  labelOf: (key: string) => string;
  /** Arrange mode: the drag plumbing, plus the empty families to conjure as
   * ghost drop targets. */
  arrange?: ArrangeProps & { ghostKeys: string[] };
}

/**
 * Not virtualised, and it never will need to be: the browse families are a
 * closed list of thirteen in the sidecar's genre tree, plus the `Other`
 * sentinel. This is the one shelf in the app whose length does not depend on
 * the library.
 *
 * In arrange mode the ghosts slot in after the real families and before
 * `Other`: they are families-to-be, so they belong with the families — while
 * the sentinel keeps its floor, however the shelf is dressed.
 */
export function FamilyList({ families, animationKey = "", labelOf, arrange }: FamilyListProps) {
  const real = arrange ? families.filter((family) => family.key !== FAMILY_OTHER) : families;
  const other = arrange ? families.filter((family) => family.key === FAMILY_OTHER) : [];
  const ghostKeys = arrange?.ghostKeys ?? [];

  const stagger = (position: number) => ({ "--row-stagger": `${position * 0.03}s` }) as CSSProperties;

  return (
    <div key={animationKey} className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {real.map((family, position) => (
        <FamilyCard
          key={family.key}
          family={family}
          label={labelOf(family.key)}
          style={stagger(position)}
          arrange={arrange}
        />
      ))}
      {ghostKeys.map((key, index) => (
        <GhostFamilyCard
          key={key}
          familyKey={key}
          label={labelOf(key)}
          over={arrange?.over === key}
          style={stagger(real.length + index)}
        />
      ))}
      {other.map((family) => (
        <FamilyCard
          key={family.key}
          family={family}
          label={labelOf(family.key)}
          style={stagger(real.length + ghostKeys.length)}
          arrange={arrange}
        />
      ))}
    </div>
  );
}
