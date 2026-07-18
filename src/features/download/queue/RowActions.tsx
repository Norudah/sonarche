import { Button, Dropdown } from "@heroui/react";
import { Ellipsis, FileText, Link, Pause, Play, RotateCcw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { LibraryTrack } from "@/features/library/api";
import { usePlayer } from "@/shared/player/PlayerContext";

/* Album rows carry one menu, track rows three controls. Reserving the width of
 * the larger set on both keeps the column from resizing — and every row from
 * shifting sideways — when an album is expanded. */
const ACTIONS_ROW = "flex min-w-[6.5rem] items-center justify-end gap-1";

const TRIGGER =
  "flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-default/60 hover:text-foreground";

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
}

export function RowActions({
  track,
  sourceUrl,
  onInspect,
  onDelete,
  onRetry,
  isRetrying,
}: RowActionsProps) {
  const { t } = useTranslation("download");
  const { t: tPlayer } = useTranslation("player");
  const { current, isPlaying, play } = usePlayer();
  const isCurrent = track != null && current?.id === track.id;

  return (
    <div className={ACTIONS_ROW}>
      {onRetry && (
        <Button variant="secondary" size="sm" isDisabled={isRetrying} onPress={onRetry}>
          <RotateCcw className="size-4" />
          {t("queue.retry")}
        </Button>
      )}
      {track && (
        <>
          <Button
            variant="tertiary"
            size="sm"
            isIconOnly
            aria-label={isCurrent && isPlaying ? tPlayer("pause") : tPlayer("play")}
            onPress={() =>
              play({
                id: track.id,
                src: track.audioUrl,
                title: track.title,
                subtitle: track.artist,
                artUrl: track.artUrl,
                duration: track.length,
              })
            }
          >
            {isCurrent && isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Button>
          <Button
            variant="tertiary"
            size="sm"
            isIconOnly
            aria-label={t("queue.inspect")}
            onPress={() => onInspect(track)}
          >
            <FileText className="size-4" />
          </Button>
        </>
      )}
      {/* Outside the `track` guard: a row that never reached the library — a
       * failed download, a dropped duplicate — is precisely the one whose
       * source URL the user wants back. */}
      <Dropdown.Root>
        <Dropdown.Trigger aria-label={t("queue.moreActions")} className={TRIGGER}>
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
}

/** An album row has no single library item behind it, so it offers the one
 * action that applies to the whole batch rather than the per-track set. */
export function AlbumRowActions({
  trackIds,
  sourceUrl,
  onDelete,
  onRetry,
  isRetrying,
}: AlbumRowActionsProps) {
  const { t } = useTranslation("download");
  const { t: tLibrary } = useTranslation("library");

  return (
    <div className={ACTIONS_ROW}>
      {onRetry && (
        <Button variant="secondary" size="sm" isDisabled={isRetrying} onPress={onRetry}>
          <RotateCcw className="size-4" />
          {t("queue.retry")}
        </Button>
      )}
      <Dropdown.Root>
        <Dropdown.Trigger aria-label={t("queue.moreActions")} className={TRIGGER}>
          <Ellipsis className="size-4" />
        </Dropdown.Trigger>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu>
            <CopySourceItem url={sourceUrl} />
            <Dropdown.Item
              id="delete-album"
              isDisabled={trackIds.length === 0}
              onAction={onDelete}
            >
              <Trash2 className="size-4" />
              {tLibrary("deleteAlbum.action")}
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
    </div>
  );
}
