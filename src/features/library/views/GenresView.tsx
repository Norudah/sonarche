import { Alert, Spinner } from "@heroui/react";
import { Layers, SearchX } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { groupAlbums } from "@/features/library/albums/albums";
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
import { EmptyLibrary } from "@/features/library/EmptyLibrary";
import { ExplorerBar } from "@/features/library/ExplorerBar";
import { useFamilyLabel } from "@/features/library/genres/useFamilyLabel";
import { useLibrary } from "@/features/library/hooks";
import { SortSelect } from "@/features/library/SortSelect";
import { NoResults } from "@/shared/ui/EmptyState";
import { PageContainer } from "@/shared/ui/PageContainer";

/**
 * An index of family cards, not a distribution: the page's job is getting to
 * an album or artist through a genre, and the numbers moved out with the
 * Metadata dashboard. One list, one depth — the search field reaches the
 * specific genres because `filterFamilies` matches a card on the genres it
 * contains, which is what replaced the families/genres toggle.
 */
export function GenresView() {
  const { t } = useTranslation("library");
  const library = useLibrary();
  const labelOf = useFamilyLabel();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<FamilySort>("size");

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
  const visibleFamilies = useMemo(
    () =>
      sortFamilies(
        filterFamilies(families, query).filter((family) => family.key !== FAMILY_NONE),
        sort,
        labelOf,
      ),
    [families, query, sort, labelOf],
  );

  const unclassified = families.find((family) => family.key === FAMILY_NONE)?.trackCount ?? 0;

  return (
    <PageContainer>
      <GenresHeader familyCount={families.length} genreCount={countGenres(families)} unclassifiedCount={unclassified} />

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
      </ExplorerBar>

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
        <FamilyList families={visibleFamilies} animationKey={`${query}:${sort}`} labelOf={labelOf} />
      )}
    </PageContainer>
  );
}
