import { Alert, Spinner } from "@heroui/react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";

import { paths } from "@/app/routes";
import { useLibrary } from "@/features/library/hooks";
import { filterTracks, totalPlaytime } from "@/features/library/tracks/filter";
import { TracksHeader } from "@/features/library/tracks/TracksHeader";
import { TrackTable } from "@/features/library/tracks/TrackTable";
import { applyTrackTriage, GENRE_MISSING, GENRE_OFF_TREE, parseTrackTriage } from "@/features/library/tracks/triage";
import { TriageChips, type TriageChip } from "@/features/library/TriageChips";
import { usePlayTrack } from "@/features/library/usePlayTrack";
import { fade } from "@/shared/motion/tokens";
import { PageContainer } from "@/shared/ui/PageContainer";

export function TracksView() {
  const { t } = useTranslation("library");
  const library = useLibrary();
  const playTrack = usePlayTrack();
  const [query, setQuery] = useState("");
  const [params, setParams] = useSearchParams();

  const triage = useMemo(() => parseTrackTriage(params), [params]);
  const tracks = useMemo(() => library.data ?? [], [library.data]);
  const triaged = useMemo(() => applyTrackTriage(tracks, triage), [tracks, triage]);
  const visible = useMemo(() => filterTracks(triaged, query), [triaged, query]);
  const playtime = useMemo(() => totalPlaytime(tracks), [tracks]);

  // Removing a filter refines the entry we are on, it is not a new place —
  // same reasoning as the genre chips' `replace`.
  const clearParam = (name: string) => {
    const next = new URLSearchParams(params);
    next.delete(name);
    setParams(next, { replace: true });
  };

  const chips: TriageChip[] = [];
  if (triage.missingYear)
    chips.push({ key: "missingYear", label: t("triage.missingYear"), onRemove: () => clearParam("missing") });
  if (triage.genre != null) {
    const label =
      triage.genre === GENRE_MISSING
        ? t("triage.genreMissing")
        : triage.genre === GENRE_OFF_TREE
          ? t("triage.genreOffTree")
          : triage.genre;
    chips.push({ key: "genre", label, onRemove: () => clearParam("genre") });
  }

  const playAll = () => {
    const first = visible[0];
    if (first) playTrack(first);
  };

  return (
    <PageContainer>
      <TracksHeader
        count={tracks.length}
        playtime={playtime}
        query={query}
        onQueryChange={setQuery}
        onPlayAll={playAll}
      />

      <TriageChips chips={chips} countLabel={t("trackCount", { count: triaged.length })} />

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

      {library.data && tracks.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-4xl">♪</p>
          <p className="text-muted">{t("empty")}</p>
          <Link to={paths.download} className="text-accent underline-offset-4 hover:underline">
            {t("goToDownload")}
          </Link>
        </div>
      )}

      {/* Fades in rather than replacing the table in one frame — the search is
       * live, so this state appears mid-keystroke. */}
      {tracks.length > 0 && visible.length === 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={fade}
          className="py-16 text-center text-sm text-muted"
        >
          {query ? t("search.noResults", { query }) : t("triage.noResults")}
        </motion.p>
      )}

      {visible.length > 0 && <TrackTable tracks={visible} animationKey={`${params.toString()}:${query}`} />}
    </PageContainer>
  );
}
