import { Alert, Spinner } from "@heroui/react";
import { Check, FolderInput, Layers, SearchX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { groupAlbums } from "@/features/library/albums/albums";
import { ghostFamilies } from "@/features/library/genres/arrange";
import { FamilyList } from "@/features/library/genres/FamilyList";
import {
  countGenres,
  FAMILY_NONE,
  FAMILY_SORTS,
  filterFamilies,
  groupFamilies,
  sortFamilies,
  type FamilySort,
} from "@/features/library/genres/genres";
import { GenresHeader } from "@/features/library/genres/GenresHeader";
import { toneOf } from "@/features/library/genres/tone";
import { useChipDrag } from "@/features/library/genres/useChipDrag";
import { useClassifyGenre, useGenreOverrides } from "@/features/library/genres/useClassifyGenre";
import { EmptyLibrary } from "@/features/library/EmptyLibrary";
import { ExplorerBar } from "@/features/library/ExplorerBar";
import { useFamilyLabel } from "@/features/library/genres/useFamilyLabel";
import { useLibrary } from "@/features/library/hooks";
import { SortSelect } from "@/features/library/SortSelect";
import { NoResults } from "@/shared/ui/EmptyState";
import { PageContainer } from "@/shared/ui/PageContainer";

/** The bar-height button both bar variants wear — the barPill idiom without
 * the pill, matching the app's rectangular management buttons. */
const BAR_BUTTON =
  "flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-separator bg-surface/70 px-3.5 " +
  "text-[0.8125rem] font-medium text-foreground outline-none transition-colors hover:bg-surface " +
  "focus-visible:ring-2 focus-visible:ring-accent/40";

/**
 * An index of family cards, not a distribution: the page's job is getting to
 * an album or artist through a genre, and the numbers moved out with the
 * Metadata dashboard. One list, one depth — the search field reaches the
 * specific genres because `filterFamilies` matches a card on the genres it
 * contains, which is what replaced the families/genres toggle.
 *
 * The page has a second posture, arrange mode: chips stop being doors and
 * become draggable objects, every family — including the empty ones, as ghost
 * cards — becomes a landing zone, and a drop is the same placement verb the
 * genre hero's "File under…" menu performs. The mode is a posture of this
 * page, not a route: it holds no state worth a URL, and leaving is Esc,
 * "Done", or navigating anywhere.
 */
export function GenresView() {
  const { t } = useTranslation("library");
  const library = useLibrary();
  const labelOf = useFamilyLabel();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<FamilySort>("size");
  const [arranging, setArranging] = useState(false);

  const overrides = useGenreOverrides();
  const classify = useClassifyGenre();
  const { drag, ghostRef, chipProps } = useChipDrag((genre, family) =>
    classify.run(genre, family, overrides.data?.get(genre.toLowerCase()) ?? null),
  );

  // The grouping is the whole pass over the library and does not depend on the
  // query, so a keystroke may not rerun it.
  const families = useMemo(() => {
    const tracks = library.data ?? [];
    return groupFamilies(tracks, groupAlbums(tracks));
  }, [library.data]);

  // The unclassified pile gets no card: that would dress a gap up as a shelf.
  // It gets no banner under the grid either — an amber bar shouting across the
  // page turned browsing into a chore, and the Metadata queue is where fixing
  // belongs. It survives as one figure in the header's count line.
  //
  // Arrange mode ignores the query on purpose: a drop target hidden by a
  // stale search is a gesture that dies mid-air.
  const visibleFamilies = useMemo(
    () =>
      sortFamilies(
        filterFamilies(families, arranging ? "" : query).filter((family) => family.key !== FAMILY_NONE),
        sort,
        labelOf,
      ),
    [families, query, sort, labelOf, arranging],
  );

  const unclassified = families.find((family) => family.key === FAMILY_NONE)?.trackCount ?? 0;

  // Esc leaves the mode — sync with a real keyboard, hence an effect. Bound
  // only while arranging, so the page costs nothing the rest of the time.
  useEffect(() => {
    if (!arranging) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setArranging(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [arranging]);

  return (
    <PageContainer>
      <GenresHeader familyCount={families.length} genreCount={countGenres(families)} unclassifiedCount={unclassified} />

      {arranging ? (
        /* The ExplorerBar's slot, worn by the mode: search and sort step back
         * (a filter that hides a drop target kills the gesture), the bar says
         * what the hand can do now, and one button leads back out. */
        <div
          className={
            "sticky top-0 z-10 -mx-8 -my-1 flex flex-wrap items-center gap-3 bg-background px-8 py-3 " +
            "after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-2 " +
            "after:bg-gradient-to-b after:from-background after:to-transparent"
          }
        >
          <p className="text-[0.8125rem] text-muted">{t("genres.arrange.hint")}</p>
          <button type="button" onClick={() => setArranging(false)} className={`${BAR_BUTTON} ml-auto`}>
            <Check className="size-4 text-muted" />
            {t("genres.arrange.done")}
          </button>
        </div>
      ) : (
        <ExplorerBar
          query={query}
          onQueryChange={setQuery}
          shown={visibleFamilies.length}
          total={families.filter((family) => family.key !== FAMILY_NONE).length}
        >
          <SortSelect
            options={FAMILY_SORTS}
            value={sort}
            onChange={setSort}
            labelOf={(option) => t(`genres.sort.${option}`)}
          />
          {families.length > 0 && (
            <button type="button" onClick={() => setArranging(true)} className={BAR_BUTTON}>
              <FolderInput className="size-4 text-muted" />
              {t("genres.arrange.enter")}
            </button>
          )}
        </ExplorerBar>
      )}

      {library.isPending && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {library.isError && (
        <Alert status="danger">
          <Alert.Content>
            <Alert.Title>{t("loadFailed")}</Alert.Title>
            <Alert.Description>{String(library.error)}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {library.data && families.length === 0 && (
        <EmptyLibrary icon={Layers} title={t("genres.empty.title")} body={t("genres.empty.body")} />
      )}

      {families.length > 0 && visibleFamilies.length === 0 && (
        <NoResults icon={SearchX} message={t("genres.noResults", { query })} />
      )}

      {visibleFamilies.length > 0 && (
        <FamilyList
          families={visibleFamilies}
          animationKey={arranging ? "arrange" : `${query}:${sort}`}
          labelOf={labelOf}
          arrange={
            arranging
              ? {
                  chipProps,
                  over: drag?.over ?? null,
                  dragging: drag?.genre ?? null,
                  ghostKeys: ghostFamilies(families),
                }
              : undefined
          }
        />
      )}

      {/* The chip in flight. Fixed at the origin and driven by transform —
       * state only carries the position across re-renders, the pointermove
       * writes land straight on the element (see useChipDrag). Above the
       * sticky bars, and transparent to the hit test by construction. */}
      {drag && (
        <div
          ref={ghostRef}
          aria-hidden
          className="pointer-events-none fixed top-0 left-0 z-50"
          style={{ transform: `translate(${drag.x}px, ${drag.y}px)` }}
        >
          <span
            className="inline-block -translate-x-1/2 -translate-y-[130%] rotate-2 rounded-full px-2.5 py-1 text-[0.75rem] text-foreground shadow-lg"
            style={{
              background: `color-mix(in oklab, ${toneOf(drag.over ?? drag.from)} 30%, var(--color-surface))`,
            }}
          >
            {drag.genre}
          </span>
        </div>
      )}
    </PageContainer>
  );
}
