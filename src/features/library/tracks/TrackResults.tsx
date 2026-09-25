import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { TrackTable } from "@/features/library/tracks/TrackTable";
import type { TrackFilterState } from "@/features/library/tracks/useTrackFilter";
import { fade } from "@/shared/motion/tokens";

interface TrackResultsProps {
  state: TrackFilterState;
  /** Shown when the scope is empty; worded per surface. */
  empty?: ReactNode;
  /** The page subject's album artist; other rows are marked as guest spots. */
  guestOwner?: string;
}

/** The table, or its empty or no-results replacement. */
export function TrackResults({ state, empty, guestOwner }: TrackResultsProps) {
  const { t } = useTranslation("library");
  const { visible, scopeSize, query, sort, toggleSort, animationKey } = state;

  if (scopeSize === 0) return empty ?? null;

  if (visible.length === 0) {
    return (
      // Fades in: search is live.
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={fade}
        className="py-16 text-center text-sm text-muted"
      >
        {query ? t("search.noResults", { query }) : t("triage.noResults")}
      </motion.p>
    );
  }

  return (
    <TrackTable tracks={visible} animationKey={animationKey} sort={sort} onSort={toggleSort} guestOwner={guestOwner} />
  );
}
