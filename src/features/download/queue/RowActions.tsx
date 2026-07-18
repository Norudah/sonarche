import { Button, Dropdown } from "@heroui/react";
import { Ellipsis, FileText, Pause, Play, RotateCcw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { LibraryTrack } from "@/features/library/api";
import { usePlayer } from "@/shared/player/PlayerContext";

interface RowActionsProps {
  /** The library item this row produced, once it exists. */
  track: LibraryTrack | undefined;
  onInspect: (track: LibraryTrack) => void;
  onDelete: (track: LibraryTrack) => void;
  /** Retry is offered inline (not buried in the menu) on a failed row. */
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function RowActions({ track, onInspect, onDelete, onRetry, isRetrying }: RowActionsProps) {
  const { t } = useTranslation("download");
  const { t: tPlayer } = useTranslation("player");
  const { current, isPlaying, play } = usePlayer();
  const isCurrent = track != null && current?.id === track.id;

  return (
    <div className="flex items-center justify-end gap-1">
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
          <Dropdown.Root>
            <Dropdown.Trigger
              aria-label={t("queue.moreActions")}
              className="flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-default/60 hover:text-foreground"
            >
              <Ellipsis className="size-4" />
            </Dropdown.Trigger>
            <Dropdown.Popover placement="bottom end">
              <Dropdown.Menu>
                <Dropdown.Item id="delete" onAction={() => onDelete(track)}>
                  <Trash2 className="size-4" />
                  {t("queue.delete")}
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown.Root>
        </>
      )}
    </div>
  );
}
