import { Chip } from "@heroui/react";
import { useTranslation } from "react-i18next";

import type { AlbumTrackJob } from "@/features/download/api";

/**
 * What identified one track of an unfolded album, or why nothing did.
 *
 * The dot stands in for a stage that has nothing to report yet. An em-dash was
 * the obvious choice and the wrong one: the row's pipeline glyphs sit right
 * beside it, and a dash read as one of them having gone flat. The fixed height
 * matches the chip that replaces it, so a row does not resize as it lands.
 */
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
  // Nothing was ever identified because nothing was ever fetched — and the
  // neutral dot would read as "still working" on a row that is finished.
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
