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
  /** Before the filters: the view-mode switch on scoped pages. */
  leading?: ReactNode;
  /** See `ExplorerBar`. */
  pinned?: boolean;
}

/** A track list's filter bar: at most four controls (two facet menus, the
 * panel, search). Chips spell out the panel's active filters. */
export function TrackFilterBar({ state, leading, pinned }: TrackFilterBarProps) {
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
  // Amber from here: correction filters from the Metadata page.
  if (triage.missingYear)
    chips.push({
      key: "missingYear",
      label: t("triage.missingYear"),
      tone: "correction",
      onRemove: () => setParam("missing", null),
    });
  if (triage.missingTrackNumber)
    chips.push({
      key: "missingTrackNumber",
      label: t("triage.missingTrackNumber"),
      tone: "correction",
      onRemove: () => setParam("missing", null),
    });
  if (triage.genre === GENRE_MISSING || triage.genre === GENRE_OFF_TREE)
    chips.push({
      key: "genre",
      label: t(triage.genre === GENRE_MISSING ? "triage.genreMissing" : "triage.genreOffTree"),
      tone: "correction",
      onRemove: () => setParam("genre", null),
    });
  // A plain genre name is browsing.
  else if (triage.genre != null)
    chips.push({ key: "genre", label: triage.genre, onRemove: () => setParam("genre", null) });
  if (triage.suspectMatch)
    chips.push({
      key: "suspect",
      label: t("triage.suspectMatch"),
      tone: "correction",
      onRemove: () => setParam("suspect", null),
    });
  if (triage.duplicateRecording)
    chips.push({
      key: "duplicates",
      label: t("triage.duplicateRecording"),
      tone: "correction",
      onRemove: () => setParam("duplicates", null),
    });

  return (
    <ExplorerBar query={query} onQueryChange={setQuery} shown={visible.length} total={scopeSize} pinned={pinned}>
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
