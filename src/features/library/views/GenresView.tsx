import { Alert, Spinner } from "@heroui/react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { paths } from "@/app/routes";
import { groupAlbums } from "@/features/library/albums/albums";
import { DistributionBar } from "@/features/library/genres/DistributionBar";
import { FamilyList } from "@/features/library/genres/FamilyList";
import {
  countGenres,
  FAMILY_NONE,
  filterFamilies,
  groupFamilies,
} from "@/features/library/genres/genres";
import { GenresHeader } from "@/features/library/genres/GenresHeader";
import { useFamilyLabel } from "@/features/library/genres/useFamilyLabel";
import { useLibrary, useRecomputeGenres } from "@/features/library/hooks";
import { fade } from "@/shared/motion/tokens";
import { PageContainer } from "@/shared/ui/PageContainer";

export function GenresView() {
  const { t } = useTranslation("library");
  const library = useLibrary();
  const recompute = useRecomputeGenres();
  const labelOf = useFamilyLabel();
  const [query, setQuery] = useState("");

  // Two memos, same reasoning as the artist shelf: the grouping is the whole
  // pass over the library and does not depend on the query, so a keystroke must
  // not rerun it.
  const families = useMemo(
    () => groupFamilies(library.data ?? [], groupAlbums(library.data ?? [])),
    [library.data],
  );
  const visible = useMemo(() => filterFamilies(families, query), [families, query]);

  const unclassified = families.find((family) => family.key === FAMILY_NONE)?.trackCount ?? 0;

  const feedback = recompute.isError
    ? { text: t("genres.recomputeFailed"), tone: "text-danger" }
    : recompute.isSuccess
      ? {
          text: t("genres.recomputeDone", {
            updated: recompute.data.updated,
            total: recompute.data.total,
          }),
          tone: "text-success",
        }
      : null;

  return (
    <PageContainer>
      <GenresHeader
        familyCount={families.length}
        genreCount={countGenres(families)}
        unclassifiedCount={unclassified}
        query={query}
        onQueryChange={setQuery}
        isRecomputing={recompute.isPending}
        onRecompute={() => recompute.mutate()}
        feedback={feedback}
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

      {/* The bar always shows the whole library, never the search result: it is
       * the page's statement about the collection, and a filtered distribution
       * summing to 100 % across three families would be a lie about proportions. */}
      {families.length > 0 && <DistributionBar families={families} labelOf={labelOf} />}

      {families.length > 0 && visible.length === 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={fade}
          className="py-16 text-center text-sm text-muted"
        >
          {t("genres.noResults", { query })}
        </motion.p>
      )}

      {visible.length > 0 && (
        <FamilyList families={visible} animationKey={query} labelOf={labelOf} />
      )}
    </PageContainer>
  );
}
