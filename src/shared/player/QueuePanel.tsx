import { Popover } from "@heroui/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ListMusic } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { formatDuration } from "@/shared/lib/format";
import { BAR_TRIGGER, PANEL_SECTION } from "@/shared/player/barTrigger";
import { Equalizer } from "@/shared/player/Equalizer";
import { usePlayer, usePlayerQueue } from "@/shared/player/PlayerContext";
import { playOrder } from "@/shared/player/queue";
import type { PlayableTrack } from "@/shared/player/types";
import { TrackThumb } from "@/shared/ui/TrackThumb";

/** Uniform slot height in px — a 48px row plus its 4px breathing room. The
 * virtualizer trusts it, so a wrong value makes the scrollbar lie. */
const ROW_HEIGHT = 52;

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
        "flex h-12 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 " +
        (isCurrent ? "bg-accent/10" : "hover:bg-default/40")
      }
    >
      {/* The cover is what makes a long queue scannable: titles alone all read
          the same at this size. */}
      <TrackThumb artUrl={track.artUrl} size="size-9" radius="rounded-md" />
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
 * plays. Starts at the playing track: what's gone is history, not queue. The
 * playing track sits pinned under its own label; only "up next" scrolls.
 */
function QueueList() {
  const { t } = useTranslation("player");
  const { queue, jumpTo } = usePlayerQueue();
  const { isPlaying } = usePlayer();
  const scrollRef = useRef<HTMLDivElement>(null);

  const ordered = playOrder(queue);
  const upcoming = ordered.slice(queue.position + 1);

  // Always windowed, no small-list branch: this list has no entrance cascade
  // to preserve, and a queue can be the whole library.
  const virtualizer = useVirtualizer({
    count: upcoming.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  return (
    <div className="flex flex-col gap-1.5 px-2.5 pt-3 pb-2.5">
      <p className={PANEL_SECTION}>{t("nowPlaying")}</p>
      <QueueRow track={ordered[queue.position]} isCurrent isPlaying={isPlaying} onJump={() => {}} />

      {upcoming.length > 0 && (
        <>
          <p className={`${PANEL_SECTION} pt-2.5`}>{t("upNext")}</p>
          <div ref={scrollRef} className="max-h-80 overflow-y-auto">
            <div style={{ height: virtualizer.getTotalSize() }} className="relative">
              {virtualizer.getVirtualItems().map((slice) => {
                const position = queue.position + 1 + slice.index;
                return (
                  <div
                    key={position}
                    className="absolute inset-x-0 flex items-center"
                    style={{ top: slice.start, height: ROW_HEIGHT }}
                  >
                    <QueueRow
                      track={upcoming[slice.index]}
                      isCurrent={false}
                      isPlaying={false}
                      onJump={() => jumpTo(position)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function QueuePanel() {
  const { t } = useTranslation("player");
  const { queue } = usePlayerQueue();
  const remaining = queue.position >= 0 ? queue.order.length - queue.position : 0;

  return (
    <Popover.Root>
      <Popover.Trigger aria-label={t("queue")} className={BAR_TRIGGER}>
        <ListMusic className="size-4" />
      </Popover.Trigger>
      <Popover.Content placement="top end" className="w-96 p-0">
        <Popover.Dialog aria-label={t("queue")} className="p-0">
          {/* The header is its own room: title and count on one baseline, a
           * separator underneath — the list below scrolls, this line never. */}
          <div className="flex items-baseline justify-between border-b border-separator px-5 pt-4 pb-3">
            <p className="text-sm font-semibold">{t("queue")}</p>
            {remaining > 0 && (
              <p className="text-xs tabular-nums text-muted">{t("queueCount", { count: remaining })}</p>
            )}
          </div>
          {remaining > 0 ? <QueueList /> : <p className="px-5 py-5 text-sm text-muted">{t("queueEmpty")}</p>}
        </Popover.Dialog>
      </Popover.Content>
    </Popover.Root>
  );
}
