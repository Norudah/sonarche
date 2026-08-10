import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useCategoryLabel } from "@/features/library/categories/useCategoryLabel";
import { ExplorerBar } from "@/features/library/ExplorerBar";
import { useFamilyLabel } from "@/features/library/genres/useFamilyLabel";
import { FacetMenu } from "@/features/library/tracks/FacetMenu";
import { FilterPanel } from "@/features/library/tracks/FilterPanel";
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
 * What the shared `ExplorerBar` holds on a track list: the browsing axes, the
 * panel, and the chips for whatever the panel is hiding.
 *
 * Kept to four controls however many axes exist. Two of them are pill menus,
 * because families and categories are short enumerable sets; everything else
 * lives in the panel. That ceiling is the point — the giants that offer more
 * (iTunes' column browser, foobar's facets, Roon's Focus) all move the facets to
 * a surface of their own rather than growing the header, and three combo boxes
 * in a title row is where that starts going wrong.
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
      onRemove: () => setParam("decade", null),
    });
  if (triage.missingYear)
    chips.push({ key: "missingYear", label: t("triage.missingYear"), onRemove: () => setParam("missing", null) });
  if (triage.missingTrackNumber)
    chips.push({
      key: "missingTrackNumber",
      label: t("triage.missingTrackNumber"),
      onRemove: () => setParam("missing", null),
    });
  if (triage.genre === GENRE_MISSING || triage.genre === GENRE_OFF_TREE)
    chips.push({
      key: "genre",
      label: t(triage.genre === GENRE_MISSING ? "triage.genreMissing" : "triage.genreOffTree"),
      onRemove: () => setParam("genre", null),
    });
  else if (triage.genre != null)
    chips.push({ key: "genre", label: triage.genre, onRemove: () => setParam("genre", null) });
  // The one chip that warns: everything else narrows a list, this one says the
  // app may have filed these tracks under the wrong recording.
  if (triage.suspectMatch)
    chips.push({
      key: "suspect",
      label: t("triage.suspectMatch"),
      tone: "review",
      onRemove: () => setParam("suspect", null),
    });
  if (triage.duplicateRecording)
    chips.push({
      key: "duplicates",
      label: t("triage.duplicateRecording"),
      onRemove: () => setParam("duplicates", null),
    });

  return (
    <ExplorerBar query={query} onQueryChange={setQuery} shown={visible.length} total={scopeSize}>
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
    </ExplorerBar>
  );
}
