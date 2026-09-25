import { useTranslation } from "react-i18next";

import type { AlbumTrackJob } from "@/features/download/api";
import { TrackStepMarker } from "@/features/download/activity/StepMarkers";
import { TrackMatch } from "@/features/download/activity/TrackMatch";
import { PIPELINE_STEPS, trackPipeline } from "@/features/download/queue/pipeline";
import { RowActions } from "@/features/download/queue/RowActions";
import type { LibraryTrack } from "@/features/library/api";
import { formatDuration } from "@/shared/lib/format";

/** Shared by header and rows so columns align. Fixed widths only: `auto` would
 * size each row independently. The last column fits `RowActions`'s largest set. */
export const TRACK_GRID = "grid grid-cols-[1.75rem_1fr_4.5rem_7rem_3rem_4.5rem] items-center gap-3";

interface JobTrackRowProps {
  track: AlbumTrackJob;
  libraryTrack: LibraryTrack | undefined;
  /** This track's enrich event has landed. */
  isEnriched: boolean;
  onEdit: (track: LibraryTrack) => void;
  onDelete: (track: LibraryTrack) => void;
}

/** One playlist entry in an unfolded album card. */
export function JobTrackRow({ track, libraryTrack, isEnriched, onEdit, onDelete }: JobTrackRowProps) {
  const { t } = useTranslation("download");
  const states = trackPipeline(track, isEnriched);
  const isDropped = track.duplicateOf != null;
  const isGone = track.status === "unavailable";

  return (
    <div
      className={`${TRACK_GRID} rounded-lg px-2 py-1.5 transition-colors hover:bg-default/50 ${isDropped || isGone ? "opacity-60" : ""}`}
    >
      <span className="text-right text-xs tabular-nums text-muted">{track.index}</span>

      <div className="min-w-0">
        <p className={`truncate text-[0.8125rem] ${isGone ? "text-muted line-through" : ""}`}>
          {track.title ?? track.url}
        </p>
        {/* One plain sentence instead of yt-dlp's error text. */}
        {isGone ? (
          <p className="truncate text-[0.6875rem] text-muted">{t("queue.trackUnavailable")}</p>
        ) : (
          track.status === "failed" &&
          track.error && (
            <p className="truncate text-[0.6875rem] text-danger" title={track.error}>
              {track.error}
            </p>
          )
        )}
      </div>

      <span className="flex items-center justify-start gap-2">
        {states.map((state, index) => (
          <TrackStepMarker
            key={PIPELINE_STEPS[index]}
            state={state}
            label={`${t(`queue.pipeline.${PIPELINE_STEPS[index]}.idle`)} — ${t(`queue.stepState.${state}`)}`}
          />
        ))}
      </span>

      <TrackMatch track={track} />

      <span className="text-right text-xs tabular-nums text-muted">
        {track.duration != null ? formatDuration(track.duration) : ""}
      </span>

      <RowActions track={libraryTrack} sourceUrl={track.url} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}
