import type { CSSProperties } from "react";

import type { Family } from "@/features/library/genres/genres";
import { FAMILY_OTHER } from "@/features/library/genres/genres";
import { FamilyCard, GhostFamilyCard, type ArrangeProps } from "@/features/library/genres/FamilyCard";

interface FamilyListProps {
  /** Real families plus `Other`; `None` is only a count in the header. */
  families: Family[];
  /** See `AlbumGrid`. */
  animationKey?: string;
  labelOf: (key: string) => string;
  /** Arrange mode, plus the empty families to show as drop targets. */
  arrange?: ArrangeProps & { ghostKeys: string[] };
}

/** Not virtualised: a closed list of families. Ghosts go after the real
 * families and before `Other`. */
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
