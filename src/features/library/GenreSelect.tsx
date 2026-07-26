import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";

import { searchWith } from "@/features/library/queryParams";
import { FacetMenu } from "@/features/library/tracks/FacetMenu";

/** What both chip rows already carry: a genre name and how many tracks it holds
 * inside the page's subject. Structural, so a family's subs and a category's
 * genres both satisfy it without either module knowing about this one. */
interface GenreOption {
  name: string;
  trackCount: number;
}

interface GenreSelectProps {
  options: GenreOption[];
  /** null = the whole subject. Comes from the route, not local state. */
  selected: string | null;
}

/**
 * The chip row's other form, for the tracks mode: the same choice as a menu.
 *
 * Chips are right above a shelf, where they read as the shelf's own tabs and
 * their counts are worth the width. In the tracks mode they were a second full
 * row of controls stacked on the filter bar, for a page that already spent most
 * of a screen on chrome before showing a track — so here the choice collapses
 * into one pill that sits in the bar with the other axes.
 *
 * It writes the same `?genre=` the chips do, and `replace` for the same reason:
 * refining which genre you are looking at is one visit to this subject, not six
 * places you went. It deliberately does *not* go through the filter state — on
 * these pages the param is the page's own scope, and reading it a second time
 * as a filter would narrow an already narrowed list and make the bar's count
 * describe the answer rather than the question.
 */
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
      // Genre names are stored free values from the tags, not a taxonomy we own,
      // so there is nothing to translate them into.
      labelOf={(value) => value}
    />
  );
}
