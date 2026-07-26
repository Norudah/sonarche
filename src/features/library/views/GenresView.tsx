import { Alert, Spinner } from "@heroui/react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { paths } from "@/app/routes";
import { groupAlbums } from "@/features/library/albums/albums";
import { FamilyList } from "@/features/library/genres/FamilyList";
import { countGenres, FAMILY_NONE, filterFamilies, groupFamilies } from "@/features/library/genres/genres";
import { GenresHeader } from "@/features/library/genres/GenresHeader";
import { ExplorerBar } from "@/features/library/ExplorerBar";
import { useFamilyLabel } from "@/features/library/genres/useFamilyLabel";
import { useLibrary } from "@/features/library/hooks";
import { fade } from "@/shared/motion/tokens";
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
    () => filterFamilies(families, query).filter((family) => family.key !== FAMILY_NONE),
    [families, query],
  );

  const unclassified = families.find((family) => family.key === FAMILY_NONE)?.trackCount ?? 0;

  return (
    <PageContainer>
      <GenresHeader familyCount={families.length} genreCount={countGenres(families)} unclassifiedCount={unclassified} />

      {/* Nothing on the left: this shelf has no sort — the cards are ordered by
          size and that ordering is the page. The bar exists all the same, so
          search sits where it sits on every other explorer. */}
      <ExplorerBar
        query={query}
        onQueryChange={setQuery}
        shown={visibleFamilies.length}
        total={families.filter((family) => family.key !== FAMILY_NONE).length}
      />

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
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-4xl">♪</p>
          <p className="text-muted">{t("empty")}</p>
          <Link to={paths.download} className="text-accent underline-offset-4 hover:underline">
            {t("goToDownload")}
          </Link>
        </div>
      )}

      {families.length > 0 && visibleFamilies.length === 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={fade}
          className="py-16 text-center text-sm text-muted"
        >
          {t("genres.noResults", { query })}
        </motion.p>
      )}

      {visibleFamilies.length > 0 && <FamilyList families={visibleFamilies} animationKey={query} labelOf={labelOf} />}
    </PageContainer>
  );
}
