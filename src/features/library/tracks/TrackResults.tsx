import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { TrackTable } from "@/features/library/tracks/TrackTable";
import type { TrackFilterState } from "@/features/library/tracks/useTrackFilter";
import { fade } from "@/shared/motion/tokens";

interface TrackResultsProps {
  state: TrackFilterState;
  /** Shown when the scope holds nothing at all — an empty library, an artist
   * whose tracks were just deleted. Each surface words that differently, so it
   * comes in as a slot rather than being guessed here. */
  empty?: ReactNode;
  /** Album artist of the page's subject, when there is one. Rows filed under
   * anyone else are then marked as guest spots. */
  guestOwner?: string;
}

/** The table and the two things that can stand in for it. Shared by the explorer
 * and every scoped page so a filtered-to-nothing list reads the same everywhere. */
export function TrackResults({ state, empty, guestOwner }: TrackResultsProps) {
  const { t } = useTranslation("library");
  const { visible, scopeSize, query, sort, toggleSort, animationKey } = state;

  if (scopeSize === 0) return empty ?? null;

  if (visible.length === 0) {
    return (
      // Fades in rather than replacing the table in one frame — the search is
      // live, so this state appears mid-keystroke.
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
