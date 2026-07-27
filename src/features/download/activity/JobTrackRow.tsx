import { useTranslation } from "react-i18next";

import type { AlbumTrackJob } from "@/features/download/api";
import { TrackStepMarker } from "@/features/download/activity/StepMarkers";
import { TrackMatch } from "@/features/download/activity/TrackMatch";
import { PIPELINE_STEPS, trackPipeline } from "@/features/download/queue/pipeline";
import { RowActions } from "@/features/download/queue/RowActions";
import type { LibraryTrack } from "@/features/library/api";
import { formatDuration } from "@/shared/lib/format";

/**
 * Shared by the header and the rows so the columns line up without a table.
 *
 * Every track column is a fixed width, `auto` nowhere: a grid sizes each row
 * independently, so an `auto` column would be as wide as that row's own content
 * and the header would sit over nothing in particular. The actions column keeps
 * the width `RowActions` reserves for its largest set, which is also why the
 * rows here do not pass `dense`.
 */
export const TRACK_GRID = "grid grid-cols-[1.75rem_1fr_4.5rem_7rem_3rem_6.5rem] items-center gap-3";

interface JobTrackRowProps {
  track: AlbumTrackJob;
  /** The library item this entry produced, once it exists. */
  libraryTrack: LibraryTrack | undefined;
  /** This track's enrich event has landed, for the job currently identifying. */
  isEnriched: boolean;
  onInspect: (track: LibraryTrack) => void;
  onDelete: (track: LibraryTrack) => void;
}

/**
 * One playlist entry inside an unfolded album card.
 *
 * Same three outcomes the history table shows per track, in the bare-glyph
 * treatment it uses for child rows — but laid out on a grid rather than in a
 * table, because a card cannot host a `<table>` without inheriting its column
 * widths from the rest of the feed.
 */
export function JobTrackRow({ track, libraryTrack, isEnriched, onInspect, onDelete }: JobTrackRowProps) {
  const { t } = useTranslation("download");
  const states = trackPipeline(track, isEnriched);
  const isDropped = track.duplicateOf != null;

  return (
    <div
      className={`${TRACK_GRID} rounded-lg px-2 py-1.5 transition-colors hover:bg-default/50 ${isDropped ? "opacity-60" : ""}`}
    >
      <span className="text-right text-xs tabular-nums text-muted">{track.index}</span>

      <div className="min-w-0">
        <p className="truncate text-[0.8125rem]">{track.title ?? track.url}</p>
        {track.status === "failed" && track.error && (
          <p className="truncate text-[0.6875rem] text-danger" title={track.error}>
            {track.error}
          </p>
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

      <RowActions track={libraryTrack} sourceUrl={track.url} onInspect={onInspect} onDelete={onDelete} />
    </div>
  );
}
