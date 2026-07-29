import { Button, Dropdown } from "@heroui/react";
import { Ellipsis, FileText, Link, Pause, Play, RotateCcw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { albumPath, artistPath } from "@/app/routes";
import type { LibraryTrack } from "@/features/library/api";
import { usePlayer } from "@/shared/player/PlayerContext";

/* Album rows carry one menu, track rows three controls. Reserving the width of
 * the larger set on both keeps the column from resizing — and every row from
 * shifting sideways — when an album is expanded. That reservation is a table
 * concern: outside one (the activity feed's cards) it is dead space, hence
 * `dense`. */
const ACTIONS_ROW = "flex items-center justify-end gap-1";
const ACTIONS_COLUMN = `${ACTIONS_ROW} min-w-[6.5rem]`;

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

interface RowActionsProps {
  /** The library item this row produced, once it exists. */
  track: LibraryTrack | undefined;
  /** The video the row was downloaded from. */
  sourceUrl: string;
  onInspect: (track: LibraryTrack) => void;
  onDelete: (track: LibraryTrack) => void;
  /** Retry is offered inline (not buried in the menu) on a failed row. */
  onRetry?: () => void;
  isRetrying?: boolean;
  /** Drop the reserved column width — right outside a table. */
  dense?: boolean;
}

export function RowActions({ track, sourceUrl, onInspect, onDelete, onRetry, isRetrying, dense }: RowActionsProps) {
  const { t } = useTranslation("download");
  const { t: tPlayer } = useTranslation("player");
  const { current, isPlaying, play } = usePlayer();
  const isCurrent = track != null && current?.id === track.id;

  return (
    <div className={dense ? ACTIONS_ROW : ACTIONS_COLUMN}>
      {onRetry && (
        <Button variant="secondary" size="sm" isDisabled={isRetrying} onPress={onRetry}>
          <RotateCcw className="size-4" />
          {t("queue.retry")}
        </Button>
      )}
      {track && (
        <>
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
          <button type="button" className={ACTION} aria-label={t("queue.inspect")} onClick={() => onInspect(track)}>
            <FileText className="size-4" />
          </button>
        </>
      )}
      {/* Outside the `track` guard: a row that never reached the library — a
       * failed download, a dropped duplicate — is precisely the one whose
       * source URL the user wants back. */}
      <Dropdown.Root>
        <Dropdown.Trigger aria-label={t("queue.moreActions")} className={ACTION}>
          <Ellipsis className="size-4" />
        </Dropdown.Trigger>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu>
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
  onDelete: () => void;
  onRetry?: () => void;
  isRetrying?: boolean;
  /** Drop the reserved column width — right outside a table. */
  dense?: boolean;
}

/** An album row has no single library item behind it, so it offers the one
 * action that applies to the whole batch rather than the per-track set. */
export function AlbumRowActions({ trackIds, sourceUrl, onDelete, onRetry, isRetrying, dense }: AlbumRowActionsProps) {
  const { t } = useTranslation("download");
  const { t: tLibrary } = useTranslation("library");

  return (
    <div className={dense ? ACTIONS_ROW : ACTIONS_COLUMN}>
      {onRetry && (
        <Button variant="secondary" size="sm" isDisabled={isRetrying} onPress={onRetry}>
          <RotateCcw className="size-4" />
          {t("queue.retry")}
        </Button>
      )}
      <Dropdown.Root>
        <Dropdown.Trigger aria-label={t("queue.moreActions")} className={ACTION}>
          <Ellipsis className="size-4" />
        </Dropdown.Trigger>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu>
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
