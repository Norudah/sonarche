import { useTranslation } from "react-i18next";

import type { LibraryTrack } from "@/features/library/api";
import { TrackTable } from "@/features/library/tracks/TrackTable";

/**
 * Tracks credited to this artist on someone else's record — the one thing this
 * page shows that neither the album shelf nor the track table surfaces, since
 * both file a guest spot under whoever owns the album.
 *
 * `TrackTable` rather than the album tracklist: these come from scattered
 * albums, so the Album column is the whole point of the section.
 */
export function ArtistAppearances({ tracks, name }: { tracks: LibraryTrack[]; name: string }) {
  const { t } = useTranslation("library");

  if (tracks.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{t("artists.appearances")}</h2>
        <p className="mt-0.5 text-[0.8125rem] text-muted">
          {t("artists.appearancesHint", { name })}
        </p>
      </div>
      <TrackTable tracks={tracks} animationKey={name} />
    </section>
  );
}
