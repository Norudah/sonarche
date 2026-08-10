import { Dropdown } from "@heroui/react";
import { Ellipsis, FilePen, Library, Link, Pause, Play, RotateCcw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { albumPath, artistPath } from "@/app/routes";
import type { LibraryTrack } from "@/features/library/api";
import { usePlayer } from "@/shared/player/PlayerContext";

/* Track rows carry up to two controls (play + menu). Reserving that width on
 * both keeps the column from resizing — and every row from shifting sideways —
 * when an album is expanded. That reservation is a table concern: outside one
 * (the activity feed's cards) it is dead space, hence `dense`. */
const ACTIONS_ROW = "flex items-center justify-end gap-1";
const ACTIONS_COLUMN = `${ACTIONS_ROW} min-w-[4.5rem]`;

/* The exact icon-button of the album tracklist: round, muted, filling on hover.
 * The queue used square `rounded-lg` triggers, which read as a different app's
 * table next to the round controls everywhere else. */
const ACTION =
  "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted outline-none transition-colors hover:bg-default/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40";

/** The video this row came from, so it can be pasted back into the input. */
function CopySourceItem({ url }: { url: string }) {
  const { t } = useTranslation("download");
  return (
    <Dropdown.Item id="copy-url" onAction={() => void navigator.clipboard.writeText(url)}>
      <Link className="size-4" />
      {t("queue.copyUrl")}
    </Dropdown.Item>
  );
}

/** Re-run what the job still has to offer: its failed step, its failed tracks,
 * or the rest of a run the user stopped. In the menu rather than inline — it is
 * an occasional recourse, and an inline button on some rows pushed every other
 * row's controls out of line. */
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
  /** The library item this row produced, once it exists. */
  track: LibraryTrack | undefined;
  /** The video the row was downloaded from. */
  sourceUrl: string;
  onEdit: (track: LibraryTrack) => void;
  onDelete: (track: LibraryTrack) => void;
  /** Offered in the menu when the job still has something to re-run. */
  onRetry?: () => void;
  isRetrying?: boolean;
  /** Drop the reserved column width — right outside a table. */
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
            // A queue of one, on purpose: a download row is a lone item, not
            // a browsing context to keep playing through.
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
      {/* Outside the `track` guard: a row that never reached the library — a
       * failed download, a dropped duplicate — is precisely the one whose
       * source URL the user wants back, and whose retry lives here too. */}
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
              <Dropdown.Item id="delete" onAction={() => onDelete(track)}>
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
  /** Library items the album produced; empty until its tracks are imported. */
  trackIds: number[];
  /** The playlist the album was downloaded from. */
  sourceUrl: string;
  /** Where the record lives in the library, once any of it landed. */
  libraryHref?: string | null;
  onDelete: () => void;
  onRetry?: () => void;
  isRetrying?: boolean;
  /** Drop the reserved column width — right outside a table. */
  dense?: boolean;
}

/** An album row has no single library item behind it, so its menu offers the
 * actions that apply to the whole batch: the record's page, the retry, the
 * sweep. */
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
            <Dropdown.Item id="delete-album" isDisabled={trackIds.length === 0} onAction={onDelete}>
              <Trash2 className="size-4" />
              {tLibrary("deleteAlbum.action")}
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
    </div>
  );
}
