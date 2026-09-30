import { Dropdown } from "@heroui/react";
import { Ellipsis, FilePen, Library, Link, Pause, Play, RotateCcw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { albumPath, artistPath } from "@/app/routes";
import type { LibraryTrack } from "@/features/library/api";
import { usePlayer } from "@/shared/player/PlayerContext";

/* Reserves room for two controls (play + menu) so table rows don't shift;
 * `dense` drops it outside tables. */
const ACTIONS_ROW = "flex items-center justify-end gap-1";
const ACTIONS_COLUMN = `${ACTIONS_ROW} min-w-[4.5rem]`;

/* Same round icon button as the album tracklist. */
const ACTION =
  "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted outline-none transition-colors hover:bg-default/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40";

function CopySourceItem({ url }: { url: string }) {
  const { t } = useTranslation("download");
  return (
    <Dropdown.Item id="copy-url" onAction={() => void navigator.clipboard.writeText(url)}>
      <Link className="size-4" />
      {t("queue.copyUrl")}
    </Dropdown.Item>
  );
}

/** Re-runs the failed step, failed tracks, or a stopped run. */
function RetryItem({ onRetry, isRetrying }: { onRetry: () => void; isRetrying?: boolean }) {
  const { t } = useTranslation("download");
  return (
    <Dropdown.Item id="retry" isDisabled={isRetrying} onAction={onRetry}>
      <RotateCcw className="size-4" />
      {t("queue.retry")}
    </Dropdown.Item>
  );
}

interface RowActionsProps {
  track: LibraryTrack | undefined;
  sourceUrl: string;
  onEdit: (track: LibraryTrack) => void;
  onDelete: (track: LibraryTrack) => void;
  onRetry?: () => void;
  isRetrying?: boolean;
  /** Drops the reserved width, for use outside a table. */
  dense?: boolean;
}

export function RowActions({ track, sourceUrl, onEdit, onDelete, onRetry, isRetrying, dense }: RowActionsProps) {
  const { t } = useTranslation("download");
  const { t: tPlayer } = useTranslation("player");
  const { current, isPlaying, play } = usePlayer();
  const isCurrent = track != null && current?.id === track.id;

  return (
    <div className={dense ? ACTIONS_ROW : ACTIONS_COLUMN}>
      {track && (
        <button
          type="button"
          className={ACTION}
          aria-label={isCurrent && isPlaying ? tPlayer("pause") : tPlayer("play")}
          onClick={() =>
            // A queue of one: a download row isn't a browsing context.
            play([
              {
                id: track.id,
                path: track.path,
                title: track.title,
                subtitle: track.artist,
                artUrl: track.artUrl,
                artPath: track.artPath,
                duration: track.length,
                albumUrl: track.album.trim()
                  ? albumPath(track.albumArtist.trim() || track.artist.trim(), track.album)
                  : null,
                artistUrl: track.artist.trim() ? artistPath(track.artist) : null,
              },
            ])
          }
        >
          {isCurrent && isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
      )}
      {/* Outside the `track` guard: failed rows still need their source URL and retry. */}
      <Dropdown.Root>
        <Dropdown.Trigger aria-label={t("queue.moreActions")} className={ACTION}>
          <Ellipsis className="size-4" />
        </Dropdown.Trigger>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu>
            {track && (
              <Dropdown.Item id="inspect" onAction={() => onEdit(track)}>
                <FilePen className="size-4" />
                {t("queue.edit")}
              </Dropdown.Item>
            )}
            {onRetry && <RetryItem onRetry={onRetry} isRetrying={isRetrying} />}
            <CopySourceItem url={sourceUrl} />
            {track && (
              <Dropdown.Item id="delete" variant="danger" onAction={() => onDelete(track)}>
                <Trash2 className="size-4" />
                {t("queue.delete")}
              </Dropdown.Item>
            )}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
    </div>
  );
}

interface AlbumRowActionsProps {
  /** Empty until tracks are imported. */
  trackIds: number[];
  sourceUrl: string;
  libraryHref?: string | null;
  onDelete: () => void;
  onRetry?: () => void;
  isRetrying?: boolean;
  /** Drops the reserved width, for use outside a table. */
  dense?: boolean;
}

/** Batch-level actions for an album row. */
export function AlbumRowActions({
  trackIds,
  sourceUrl,
  libraryHref,
  onDelete,
  onRetry,
  isRetrying,
  dense,
}: AlbumRowActionsProps) {
  const { t } = useTranslation("download");
  const { t: tLibrary } = useTranslation("library");
  const navigate = useNavigate();

  return (
    <div className={dense ? ACTIONS_ROW : ACTIONS_COLUMN}>
      <Dropdown.Root>
        <Dropdown.Trigger aria-label={t("queue.moreActions")} className={ACTION}>
          <Ellipsis className="size-4" />
        </Dropdown.Trigger>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu>
            {libraryHref && (
              <Dropdown.Item id="open-in-library" onAction={() => navigate(libraryHref)}>
                <Library className="size-4" />
                {t("queue.openInLibrary")}
              </Dropdown.Item>
            )}
            {onRetry && <RetryItem onRetry={onRetry} isRetrying={isRetrying} />}
            <CopySourceItem url={sourceUrl} />
            <Dropdown.Item id="delete-album" variant="danger" isDisabled={trackIds.length === 0} onAction={onDelete}>
              <Trash2 className="size-4" />
              {tLibrary("deleteAlbum.action")}
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
    </div>
  );
}
