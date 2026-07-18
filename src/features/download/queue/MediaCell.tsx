import { Button } from "@heroui/react";
import { ChevronDown, ChevronRight, Disc3, Music } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { AlbumTrackJob, DownloadJob } from "@/features/download/api";
import { formatDuration } from "@/shared/lib/format";

function Artwork({ src, isAlbum }: { src: string | null; isAlbum: boolean }) {
  if (src) {
    return <img src={src} alt="" className="size-10 shrink-0 rounded-lg object-cover" />;
  }
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-secondary">
      {isAlbum ? <Disc3 className="size-4 text-muted" /> : <Music className="size-4 text-muted" />}
    </div>
  );
}

interface JobMediaCellProps {
  job: DownloadJob;
  isExpanded: boolean;
  onToggle: () => void;
}

export function JobMediaCell({ job, isExpanded, onToggle }: JobMediaCellProps) {
  const { t } = useTranslation("download");
  const isAlbum = job.kind === "album";
  const subtitle = [
    isAlbum ? t("queue.kindAlbum") : t("queue.kindSingle"),
    job.artist ?? t("unknownArtist"),
    isAlbum && job.tracks.length > 0
      ? t("queue.trackCount", { count: job.tracks.length })
      : job.duration != null
        ? formatDuration(job.duration)
        : null,
  ].filter(Boolean);

  return (
    <div className="flex items-center gap-3">
      {/* The chevron slot stays reserved on singles so artwork lines up column-wide. */}
      <div className="w-7 shrink-0">
        {isAlbum && (
          <Button
            variant="ghost"
            size="sm"
            isIconOnly
            aria-expanded={isExpanded}
            aria-label={isExpanded ? t("queue.collapse") : t("queue.expand")}
            onPress={onToggle}
            isDisabled={job.tracks.length === 0}
          >
            {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </Button>
        )}
      </div>
      <Artwork src={job.thumbnail} isAlbum={isAlbum} />
      <div className="min-w-0">
        <p className="max-w-52 truncate text-sm font-semibold">{job.title ?? job.url}</p>
        <p className="max-w-52 truncate text-xs text-muted">{subtitle.join(" · ")}</p>
        {job.status === "failed" && job.error && (
          <p className="max-w-52 truncate text-xs text-danger" title={job.error}>
            {t("queue.failedWith", { error: job.error })}
          </p>
        )}
      </div>
    </div>
  );
}

/** Expanded album track: the position number takes the artwork's place. */
export function TrackMediaCell({ track }: { track: AlbumTrackJob }) {
  const { t } = useTranslation("download");
  return (
    <div className="flex items-center gap-3 pl-7">
      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted">
        #{track.index}
      </span>
      <div className="min-w-0">
        <p className="max-w-52 truncate text-sm">{track.title ?? track.url}</p>
        {track.status === "failed" && track.error ? (
          <p className="max-w-52 truncate text-xs text-danger" title={track.error}>
            {t("queue.failedWith", { error: track.error })}
          </p>
        ) : (
          track.duration != null && (
            <p className="text-xs text-muted">{formatDuration(track.duration)}</p>
          )
        )}
      </div>
    </div>
  );
}
