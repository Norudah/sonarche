import { useTranslation } from "react-i18next";

import { CATEGORY_TAXONOMY } from "@/features/library/categories/categories";
import { useCategoryLabel } from "@/features/library/categories/useCategoryLabel";

/** Taxonomy chips under the category field: they show translated labels but
 * write canonical English values. Free text stays possible. */
export function CategoryTaxonomyChips({
  value,
  soundtrack,
  onSelect,
}: {
  /** Canonical value. */
  value: string;
  /** Nudge when MusicBrainz says soundtrack and there's no category yet. */
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
