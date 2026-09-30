import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";

import { searchWith } from "@/features/library/queryParams";
import { FacetMenu } from "@/features/library/tracks/FacetMenu";

/** Structural, so family subs and category genres both fit. */
interface GenreOption {
  name: string;
  trackCount: number;
}

interface GenreSelectProps {
  options: GenreOption[];
  /** null = the whole subject; from the route. */
  selected: string | null;
}

/** The genre chips as a menu, for the tracks mode. Writes `?genre=` with
 * `replace` like the chips, and doesn't go through the filter state (the
 * param is the page's scope, not a filter). */
export function GenreSelect({ options, selected }: GenreSelectProps) {
  const { t } = useTranslation("library");
  const [params] = useSearchParams();
  const navigate = useNavigate();

  return (
    <FacetMenu
      label={t("filters.genre")}
      allLabel={t("filters.allGenres")}
      options={options.map((option) => ({ value: option.name, trackCount: option.trackCount }))}
      value={selected}
      onChange={(value) => navigate({ search: searchWith(params, "genre", value) }, { replace: true })}
      // Free tag values: nothing to translate.
      labelOf={(value) => value}
    />
  );
}
