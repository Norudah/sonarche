import { Popover } from "@heroui/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ListMusic } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { formatDuration } from "@/shared/lib/format";
import { Equalizer } from "@/shared/player/Equalizer";
import { usePlayer, usePlayerQueue } from "@/shared/player/PlayerContext";
import { playOrder } from "@/shared/player/queue";
import type { PlayableTrack } from "@/shared/player/types";

/** Uniform row height in px — one title line over one subtitle line. The
 * virtualizer trusts it, so a wrong value makes the scrollbar lie. */
const ROW_HEIGHT = 48;

/** Same visual language as the bar's other icon triggers. A plain class rather
 * than a HeroUI Button because Popover.Trigger renders the pressable itself. */
const TRIGGER =
  "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted outline-none transition-colors hover:bg-default/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40 aria-expanded:bg-default/70 aria-expanded:text-foreground";

interface QueueRowProps {
  track: PlayableTrack;
  isCurrent: boolean;
  isPlaying: boolean;
  onJump: () => void;
}

function QueueRow({ track, isCurrent, isPlaying, onJump }: QueueRowProps) {
  return (
    <button
      type="button"
      onClick={onJump}
      className={
        "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 " +
        (isCurrent ? "bg-accent/10" : "hover:bg-default/40")
      }
      style={{ height: ROW_HEIGHT }}
    >
      <div className="min-w-0 flex-1">
        <p className={"truncate text-sm font-medium " + (isCurrent ? "text-accent" : "text-foreground")}>
          {track.title}
        </p>
        {track.subtitle && <p className="truncate text-xs text-muted">{track.subtitle}</p>}
      </div>
      {isCurrent && isPlaying ? (
        <Equalizer className="shrink-0 text-accent" />
      ) : (
        track.duration != null && (
          <span className="shrink-0 text-xs tabular-nums text-muted">{formatDuration(track.duration)}</span>
        )
      )}
    </button>
  );
}

/**
 * The queue in its effective play order — the shuffled order when shuffle is
 * on, because showing the pre-shuffle list would promise an order that never
 * plays. Starts at the playing track: what's gone is history, not queue.
 */
function QueueList() {
  const { queue, jumpTo } = usePlayerQueue();
  const { isPlaying } = usePlayer();
  const scrollRef = useRef<HTMLDivElement>(null);

  const ordered = playOrder(queue);
  const rows = ordered.slice(queue.position);

  // Always windowed, no small-list branch: this list has no entrance cascade
  // to preserve, and a queue can be the whole library.
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  return (
    <div ref={scrollRef} className="max-h-96 overflow-y-auto px-2 pb-2">
      <div style={{ height: virtualizer.getTotalSize() }} className="relative">
        {virtualizer.getVirtualItems().map((slice) => {
          const position = queue.position + slice.index;
          return (
            <div key={position} className="absolute inset-x-0" style={{ top: slice.start, height: ROW_HEIGHT }}>
              <QueueRow
                track={rows[slice.index]}
                isCurrent={slice.index === 0}
                isPlaying={isPlaying}
                onJump={() => jumpTo(position)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function QueuePanel() {
  const { t } = useTranslation("player");
  const { queue } = usePlayerQueue();
  const remaining = queue.position >= 0 ? queue.order.length - queue.position : 0;

  return (
    <Popover.Root>
      <Popover.Trigger aria-label={t("queue")} className={TRIGGER}>
        <ListMusic className="size-4" />
      </Popover.Trigger>
      <Popover.Content placement="top end" className="w-80 p-0">
        <Popover.Dialog aria-label={t("queue")} className="p-0">
          <div className="flex items-baseline justify-between px-4 pb-2 pt-3">
            <p className="text-sm font-semibold">{t("queue")}</p>
            {remaining > 0 && <p className="text-xs text-muted">{t("queueCount", { count: remaining })}</p>}
          </div>
          {remaining > 0 ? <QueueList /> : <p className="px-4 pb-4 text-sm text-muted">{t("queueEmpty")}</p>}
        </Popover.Dialog>
      </Popover.Content>
    </Popover.Root>
  );
}
