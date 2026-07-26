import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useCategoryLabel } from "@/features/library/categories/useCategoryLabel";
import { useFamilyLabel } from "@/features/library/genres/useFamilyLabel";
import { FacetMenu } from "@/features/library/tracks/FacetMenu";
import { FilterPanel } from "@/features/library/tracks/FilterPanel";
import { SearchField } from "@/features/library/tracks/SearchField";
import { GENRE_MISSING, GENRE_OFF_TREE } from "@/features/library/tracks/triage";
import type { TrackFilterState } from "@/features/library/tracks/useTrackFilter";
import { TriageChips, type TriageChip } from "@/features/library/TriageChips";

interface TrackFilterBarProps {
  state: TrackFilterState;
  /** Rendered first, before the filters — the view-mode switch on a scoped page.
   * A slot and not a prop because what goes there is a whole control. */
  leading?: ReactNode;
}

/**
 * The explorer's work bar: what to show, in what order, and what to look for.
 *
 * One row, kept to four controls however many axes exist. Two of them are pill
 * menus, because families and categories are short enumerable sets; everything
 * else lives in the panel. That ceiling is the point — the giants that offer
 * more (iTunes' column browser, foobar's facets, Roon's Focus) all move the
 * facets to a surface of their own rather than growing the header, and three
 * combo boxes in a title row is where that starts going wrong.
 *
 * Sticky, and in the flow rather than in `PageContainer`'s overlay slot: it has
 * to scroll with the page until it reaches the top, and the negative margins
 * give it the full bleed the slot exists to provide. `z-10` keeps it under the
 * detail pages' own sticky bars (`z-20`), which are never on screen at the same
 * time as this one.
 *
 * An active filter states itself in its own pill, so those two axes get no chip.
 * The chips are for the panel's filters, which are otherwise invisible with the
 * panel closed.
 */
export function TrackFilterBar({ state, leading }: TrackFilterBarProps) {
  const { t } = useTranslation("library");
  const familyLabelOf = useFamilyLabel();
  const categoryLabelOf = useCategoryLabel();
  const { triage, facets, axes, visible, scopeSize, query, setQuery, setParam } = state;

  const chips: TriageChip[] = [];
  if (triage.decade != null)
    chips.push({
      key: "decade",
      label: t("filters.decadeValue", { decade: triage.decade }),
      tone: "browse",
      onRemove: () => setParam("decade", null),
    });
  if (triage.missingYear)
    chips.push({ key: "missingYear", label: t("triage.missingYear"), onRemove: () => setParam("missing", null) });
  if (triage.genre === GENRE_MISSING || triage.genre === GENRE_OFF_TREE)
    chips.push({
      key: "genre",
      label: t(triage.genre === GENRE_MISSING ? "triage.genreMissing" : "triage.genreOffTree"),
      onRemove: () => setParam("genre", null),
    });
  // A plain genre name keeps the browsing tone: it is a place someone navigated
  // to, not something to correct.
  else if (triage.genre != null)
    chips.push({ key: "genre", label: triage.genre, tone: "browse", onRemove: () => setParam("genre", null) });
  if (triage.suspectMatch)
    chips.push({ key: "suspect", label: t("triage.suspectMatch"), onRemove: () => setParam("suspect", null) });
  if (triage.duplicateRecording)
    chips.push({
      key: "duplicates",
      label: t("triage.duplicateRecording"),
      onRemove: () => setParam("duplicates", null),
    });

  return (
    <div
      className={
        "sticky top-0 z-10 -mx-8 -my-1 flex flex-wrap items-center gap-2 bg-background px-8 py-3 " +
        // A short fade below the bar rather than a rule: pinned, the rows have to
        // read as sliding *under* it, and a hairline would draw a permanent line
        // across the page even at the top where there is nothing to separate.
        // Over the page background the gradient is invisible until something
        // scrolls into it.
        "after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-2 after:bg-gradient-to-b after:from-background after:to-transparent"
      }
    >
      {leading}

      {axes.includes("family") && (
        <FacetMenu
          label={t("filters.family")}
          allLabel={t("filters.allFamilies")}
          options={facets.families}
          value={triage.family}
          onChange={(value) => setParam("family", value)}
          labelOf={familyLabelOf}
        />
      )}

      {axes.includes("category") && (
        <FacetMenu
          label={t("filters.category")}
          allLabel={t("filters.allCategories")}
          options={facets.categories}
          value={triage.category}
          onChange={(value) => setParam("category", value)}
          labelOf={categoryLabelOf}
        />
      )}

      <FilterPanel state={state} />

      <TriageChips chips={chips} />

      {/* Only when it says something the header does not: with nothing filtered
       * the count is the scope's own, which the title block already carries. */}
      {visible.length !== scopeSize && (
        <span className="text-[0.8125rem] text-muted tabular-nums">
          {t("filters.subset", { shown: visible.length, total: scopeSize })}
        </span>
      )}

      <div className="ml-auto">
        <SearchField value={query} onChange={setQuery} />
      </div>
    </div>
  );
}
