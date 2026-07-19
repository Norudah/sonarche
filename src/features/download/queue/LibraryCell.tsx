import { Chip } from "@heroui/react";
import { useTranslation } from "react-i18next";

import type { DownloadJob } from "@/features/download/api";
import { EmptyCell } from "@/features/download/queue/EmptyCell";
import { albumPresence, type LibraryPresence } from "@/features/download/queue/library";

const PRESENCE_COLOR = {
  full: "success",
  partial: "warning",
  none: "default",
} as const;

const PRESENCE_KEY = {
  full: "queue.inLibrary",
  partial: "queue.partiallyInLibrary",
  none: "queue.removedFromLibrary",
} as const;

function PresenceChip({ presence }: { presence: LibraryPresence }) {
  const { t } = useTranslation("download");
  return (
    <Chip variant="soft" size="sm" color={PRESENCE_COLOR[presence]}>
      {t(PRESENCE_KEY[presence])}
    </Chip>
  );
}

interface JobLibraryCellProps {
  job: DownloadJob;
  isInLibrary: (itemId: number) => boolean;
  /** The library list has not loaded yet: say nothing rather than "removed". */
  isLibraryLoaded: boolean;
}

export function JobLibraryCell({ job, isInLibrary, isLibraryLoaded }: JobLibraryCellProps) {
  if (!isLibraryLoaded || job.status !== "done") return <EmptyCell />;
  if (job.kind === "album" && job.tracks.length > 0) {
    const presence = albumPresence(job, isInLibrary);
    return presence ? <PresenceChip presence={presence} /> : <EmptyCell />;
  }
  const itemId = job.report?.itemId;
  if (itemId == null) return <EmptyCell />;
  return <PresenceChip presence={isInLibrary(itemId) ? "full" : "none"} />;
}

/** One expanded album track: it owns a single item, so only present/removed. */
export function TrackLibraryCell({
  itemId,
  isDuplicate,
  isDone,
  isInLibrary,
  isLibraryLoaded,
}: {
  itemId: number | null;
  isDuplicate: boolean;
  isDone: boolean;
  isInLibrary: (itemId: number) => boolean;
  isLibraryLoaded: boolean;
}) {
  // A dropped duplicate's item no longer exists: the "removed" chip would be
  // misleading.
  if (!isLibraryLoaded || !isDone || isDuplicate || itemId == null) return <EmptyCell />;
  return <PresenceChip presence={isInLibrary(itemId) ? "full" : "none"} />;
}
