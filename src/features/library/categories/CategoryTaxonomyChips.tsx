import { useTranslation } from "react-i18next";

import { CATEGORY_TAXONOMY } from "@/features/library/categories/categories";
import { useCategoryLabel } from "@/features/library/categories/useCategoryLabel";

/**
 * The taxonomy as one-tap suggestions under an editable category field.
 *
 * This is what keeps the stored values canonical across UI languages: the chip
 * shows "Jeux vidéo" but writes "Video Games", so a French user never has to
 * know (or type) the English tag value. Free text through the input itself
 * stays possible — the taxonomy is a starter set, not a fence.
 */
export function CategoryTaxonomyChips({
  value,
  soundtrack,
  onSelect,
}: {
  /** The draft's current (canonical) category value. */
  value: string;
  /** MusicBrainz typed the release a soundtrack: nudge when no category yet. */
  soundtrack: boolean;
  onSelect: (canonical: string) => void;
}) {
  const { t } = useTranslation("library");
  const labelOf = useCategoryLabel();

  return (
    <div className="flex flex-col gap-1.5">
      {soundtrack && value.trim() === "" && <p className="text-[0.75rem] text-muted">{t("metadata.soundtrackHint")}</p>}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORY_TAXONOMY.map((canonical) => {
          const isActive = value === canonical;
          return (
            <button
              key={canonical}
              type="button"
              onClick={() => onSelect(isActive ? "" : canonical)}
              className={
                "cursor-pointer rounded-full px-2.5 py-1 text-[0.75rem] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 " +
                (isActive
                  ? "bg-accent text-accent-foreground"
                  : "bg-surface-secondary text-muted hover:bg-surface-tertiary hover:text-foreground")
              }
            >
              {labelOf(canonical)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
