import { Alert, Spinner } from "@heroui/react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";

import { paths } from "@/app/routes";
import { groupAlbums } from "@/features/library/albums/albums";
import { DistributionBar } from "@/features/library/genres/DistributionBar";
import { FamilyList } from "@/features/library/genres/FamilyList";
import {
  countGenres,
  FAMILY_NONE,
  filterFamilies,
  filterGenres,
  groupFamilies,
  listGenres,
} from "@/features/library/genres/genres";
import { GenreList } from "@/features/library/genres/GenreList";
import { GenresHeader } from "@/features/library/genres/GenresHeader";
import { GENRE_SCOPES, type GenreScope } from "@/features/library/genres/ScopeToggle";
import { familyTones } from "@/features/library/genres/tone";
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

  // In the URL rather than in component state: coming back up from a genre
  // remounts this page, and a scope held in `useState` would silently drop the
  // user back on Families after they had been browsing genres. `replace` so
  // flipping the toggle does not stack history entries of its own.
  const [params, setParams] = useSearchParams();
  const requested = params.get("scope");
  const scope: GenreScope = GENRE_SCOPES.includes(requested as GenreScope)
    ? (requested as GenreScope)
    : "families";
  const setScope = (next: GenreScope) => setParams({ scope: next }, { replace: true });

  // The grouping is the whole pass over the library and depends on neither the
  // query nor the scope, so neither a keystroke nor a toggle may rerun it.
  const { families, genres, tones, peaks } = useMemo(() => {
    const tracks = library.data ?? [];
    const families = groupFamilies(tracks, groupAlbums(tracks));
    const genres = listGenres(families, tracks.length);
    return {
      families,
      genres,
      // Both built from the unfiltered library: a colour that changes when the
      // user types is not an identity, and a bar that rescales mid-search makes
      // two consecutive keystrokes uncomparable.
      tones: familyTones(families),
      peaks: {
        families: Math.max(...families.map((family) => family.share), 0),
        genres: Math.max(...genres.map((genre) => genre.share), 0),
      },
    };
  }, [library.data]);

  const visibleFamilies = useMemo(() => filterFamilies(families, query), [families, query]);
  const visibleGenres = useMemo(() => filterGenres(genres, query), [genres, query]);

  const unclassified = families.find((family) => family.key === FAMILY_NONE)?.trackCount ?? 0;
  const isEmpty = scope === "families" ? visibleFamilies.length === 0 : visibleGenres.length === 0;

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
        scope={scope}
        onScopeChange={setScope}
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

      {/* Always the families, and always the whole library — never the genres
       * and never the search result. It is the page's one statement about the
       * collection, so it must not change meaning under a toggle, and a
       * filtered distribution summing to 100 % across three rows would be a lie
       * about proportions. */}
      {families.length > 0 && (
        <DistributionBar families={families} tones={tones} labelOf={labelOf} />
      )}

      {families.length > 0 && isEmpty && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={fade}
          className="py-16 text-center text-sm text-muted"
        >
          {t("genres.noResults", { query })}
        </motion.p>
      )}

      {scope === "families" && visibleFamilies.length > 0 && (
        <FamilyList
          families={visibleFamilies}
          animationKey={query}
          tones={tones}
          peakShare={peaks.families}
          labelOf={labelOf}
        />
      )}

      {scope === "genres" && visibleGenres.length > 0 && (
        <GenreList
          genres={visibleGenres}
          animationKey={query}
          tones={tones}
          peakShare={peaks.genres}
          labelOf={labelOf}
        />
      )}
    </PageContainer>
  );
}
