import { Button } from "@heroui/react";
import { ChevronRight, Disc3, Music } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import type { AlbumTrackJob, DownloadJob } from "@/features/download/api";
import { survivingTracks } from "@/features/download/queue/pipeline";
import { formatDuration } from "@/shared/lib/format";
import { springs } from "@/shared/motion/tokens";

/** The YouTube thumbnail is 16:9 and stands in until the real cover art lands
 * with the enrich step; `object-cover` crops it to the square the row wants. */
function Artwork({ src, isAlbum }: { src: string | null; isAlbum: boolean }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        // The history grows without a cap (see the jobs DB), so this row is
        // one of arbitrarily many.
        loading="lazy"
        decoding="async"
        className="size-10 shrink-0 rounded-lg bg-surface-secondary object-cover"
      />
    );
  }
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-secondary">
      {isAlbum ? <Disc3 className="size-4 text-muted" /> : <Music className="size-4 text-muted" />}
    </div>
  );
}

interface JobMediaCellProps {
  job: DownloadJob;
  /** Cover art from the library, once the enrich step produced one. Takes over
   * from the YouTube thumbnail the row started with. */
  coverUrl: string | null;
  /** The record this row produced, once it is in the library — the whole point
   * of a finished download is landing on it. Null while there is nothing to
   * open yet. */
  href: string | null;
  isExpanded: boolean;
  onToggle: () => void;
}

export function JobMediaCell({ job, coverUrl, href, isExpanded, onToggle }: JobMediaCellProps) {
  const { t } = useTranslation("download");
  const isAlbum = job.kind === "album";
  const losses = survivingTracks(job);
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
            {/* One chevron that turns, rather than two that swap: the rotation
                is what tells the user the row opened. */}
            <motion.span
              initial={false}
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={springs.snappy}
              className="flex"
            >
              <ChevronRight className="size-4" />
            </motion.span>
          </Button>
        )}
      </div>
      {href ? (
        <Link to={href} aria-label={t("queue.openInLibrary")} className="shrink-0 rounded-lg outline-none">
          <Artwork src={coverUrl ?? job.thumbnail} isAlbum={isAlbum} />
        </Link>
      ) : (
        <Artwork src={coverUrl ?? job.thumbnail} isAlbum={isAlbum} />
      )}
      <div className="min-w-0">
        {/* The title is the door to what the row produced: a finished download
            otherwise left the user hunting for it in the library by hand. */}
        <p className="max-w-52 truncate text-sm font-semibold">
          {href ? (
            <Link
              to={href}
              className="rounded-sm underline-offset-2 outline-none hover:text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              {job.title ?? job.url}
            </Link>
          ) : (
            (job.title ?? job.url)
          )}
        </p>
        <p className="max-w-52 truncate text-xs text-muted">{subtitle.join(" · ")}</p>
        {/* A partly-successful album keeps its tally in `error` while staying
            `done` — amber, because the batch did land; red is for a job that
            produced nothing. */}
        {job.error &&
          (job.status === "failed" ? (
            <p className="max-w-52 truncate text-xs text-danger" title={job.error}>
              {t("queue.failedWith", { error: job.error })}
            </p>
          ) : (
            losses && (
              <p className="max-w-52 truncate text-xs text-warning">
                {t("queue.partialTracks", { failed: losses.total - losses.kept, total: losses.total })}
              </p>
            )
          ))}
      </div>
    </div>
  );
}

/** Expanded album track: the position number takes the artwork's place. */
export function TrackMediaCell({ track }: { track: AlbumTrackJob }) {
  const { t } = useTranslation("download");
  return (
    <div className="flex items-center gap-3 pl-7">
      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted">#{track.index}</span>
      <div className="min-w-0">
        <p className="max-w-52 truncate text-sm">{track.title ?? track.url}</p>
        {track.status === "failed" && track.error ? (
          <p className="max-w-52 truncate text-xs text-danger" title={track.error}>
            {t("queue.failedWith", { error: track.error })}
          </p>
        ) : (
          track.duration != null && <p className="text-xs text-muted">{formatDuration(track.duration)}</p>
        )}
      </div>
    </div>
  );
}
