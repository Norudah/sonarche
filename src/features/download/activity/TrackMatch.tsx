import { Chip } from "@heroui/react";
import { useTranslation } from "react-i18next";

import type { AlbumTrackJob } from "@/features/download/api";

/** Placeholder dot sized like the chip that replaces it (a dash would read as
 * a flat pipeline glyph). */
function Awaiting() {
  const { t } = useTranslation("download");
  return (
    <span className="flex h-6 items-center" role="note" aria-label={t("queue.awaiting")}>
      <span className="size-1.5 rounded-full bg-muted/40" />
    </span>
  );
}

export function TrackMatch({ track }: { track: AlbumTrackJob }) {
  const { t } = useTranslation("download");

  if (track.duplicateOf != null) {
    return (
      <Chip variant="soft" size="sm" color="default">
        {t("queue.duplicate")}
      </Chip>
    );
  }
  // Never fetched, so the neutral "working" dot would be wrong.
  if (track.status === "unavailable") {
    return (
      <Chip variant="soft" size="sm" color="warning">
        {t("queue.unavailableChip")}
      </Chip>
    );
  }
  if (track.status !== "done") return <Awaiting />;
  if (track.report?.mbMatched) {
    return (
      <Chip variant="soft" size="sm" color="success">
        {track.report.source ?? t("queue.matched")}
      </Chip>
    );
  }
  return (
    <Chip variant="soft" size="sm" color="danger">
      {t("queue.matchNone")}
    </Chip>
  );
}
