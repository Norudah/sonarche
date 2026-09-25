import { Button, Popover, Spinner } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Hand, Loader2, Magnet, MicVocal, RotateCcw } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { layoutIds, springs } from "@/shared/motion/tokens";
import { BAR_TRIGGER } from "@/shared/player/barTrigger";
import { activeLineIndex, fetchLyrics, type Lyrics, type LyricLine } from "@/shared/player/lyrics";
import { usePlayer, usePlayerProgress } from "@/shared/player/PlayerContext";
import type { PlayableTrack } from "@/shared/player/types";
import { ActionHelp } from "@/shared/ui/FieldHelp";
import { PrimaryButton } from "@/shared/ui/PrimaryButton";
import { TrackThumb } from "@/shared/ui/TrackThumb";

const lyricsKey = (id: number) => ["lyrics", id] as const;

const BODY = "max-h-[19rem] overflow-y-auto";

/** Pause in following the playhead after the reader scrolls by hand. */
const FOLLOW_PAUSE_MS = 6000;

/** Timed lines following the playhead. Split out because it re-renders with
 * `usePlayerProgress`; the current line is marked like the queue's playing row. */
function TimedLyrics({ lines, follow }: { lines: LyricLine[]; follow: boolean }) {
  const { t } = useTranslation("player");
  const { currentTime } = usePlayerProgress();
  const { seek } = usePlayer();
  const listRef = useRef<HTMLUListElement>(null);
  const activeRef = useRef<HTMLLIElement>(null);
  const followFrom = useRef(0);

  const active = activeLineIndex(lines, currentTime);

  // `scrollTo` on the list: `scrollIntoView` would also scroll the page behind
  // the popover. `follow` is a dependency so re-enabling it jumps to the line.
  useEffect(() => {
    const list = listRef.current;
    const line = activeRef.current;
    if (!follow || !list || !line || Date.now() < followFrom.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    list.scrollTo({
      top: line.offsetTop - list.clientHeight / 2 + line.clientHeight / 2,
      behavior: reduced ? "auto" : "smooth",
    });
  }, [active, follow]);

  // Wheel and touch rather than `scroll`, which our own smooth scroll fires too.
  const yieldToReader = () => {
    followFrom.current = Date.now() + FOLLOW_PAUSE_MS;
  };

  return (
    <ul
      ref={listRef}
      onWheel={yieldToReader}
      onTouchMove={yieldToReader}
      className={`${BODY} relative flex flex-col gap-0.5 px-2.5 py-3`}
    >
      {lines.map((line, index) => (
        <li key={index} ref={index === active ? activeRef : undefined}>
          {/* Pressing a line seeks there. */}
          <button
            type="button"
            onClick={() => seek(line.time)}
            aria-label={t("lyrics.jumpTo")}
            className={
              "w-full cursor-pointer rounded-lg px-3 py-1 text-left text-sm leading-snug outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 " +
              (index === active ? "bg-accent/10 font-medium text-accent" : "text-muted hover:bg-default/40")
            }
          >
            {line.text || <span className="text-muted/50">♪</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

function LyricsOffer({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  /** Absent when there is nothing left to try (e.g. instrumental). */
  action?: { label: string; isPending: boolean; onPress: () => void };
}) {
  return (
    <div className="flex flex-col items-start gap-3 px-5 py-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
          <MicVocal className="size-[1.125rem] text-accent" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          {hint && <p className="mt-0.5 text-xs leading-relaxed text-muted">{hint}</p>}
        </div>
      </div>
      {action && (
        <PrimaryButton onPress={action.onPress} isPending={action.isPending}>
          {action.label}
        </PrimaryButton>
      )}
    </div>
  );
}

const SEGMENT =
  "relative flex cursor-pointer items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40";

/** Follow the playhead or scroll manually: two named segments, as in
 * `ViewModeSwitch`, so the current mode is unambiguous. */
function FollowSwitch({ on, toggle }: { on: boolean; toggle: () => void }) {
  const { t } = useTranslation("player");

  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-default/60 p-0.5">
      {([true, false] as const).map((mode) => (
        <button
          key={String(mode)}
          type="button"
          onClick={() => mode !== on && toggle()}
          aria-pressed={mode === on}
          className={SEGMENT + (mode === on ? " text-accent" : " text-muted hover:text-foreground")}
        >
          {mode === on && (
            <motion.span
              layoutId={layoutIds.lyricsFollow}
              transition={springs.snappy}
              className="absolute inset-0 rounded-full bg-surface shadow-xs"
            />
          )}
          {/* Positioned so the label paints above the absolute pill. */}
          <span className="relative flex items-center gap-1">
            {mode ? <Magnet className="size-3 shrink-0" /> : <Hand className="size-3 shrink-0" />}
            {t(mode ? "lyrics.followAuto" : "lyrics.followManual")}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Source, follow switch and retry. The source explains why a plain page
 * doesn't scroll, and when retrying may help. */
function LyricsFooter({
  lyrics,
  isPending,
  onAgain,
  follow,
}: {
  lyrics: Lyrics;
  isPending: boolean;
  onAgain: () => void;
  /** Absent for plain lyrics, which have no timing to follow. */
  follow?: { on: boolean; toggle: () => void };
}) {
  const { t } = useTranslation("player");
  // The services' own spelling; the wire value is an identifier.
  const source =
    lyrics.source === "lrclib" ? "LRCLIB" : lyrics.source === "lyrics.ovh" ? "lyrics.ovh" : t("lyrics.fromStored");

  return (
    <div className="flex items-center justify-between gap-3 border-t border-separator px-5 py-2">
      <p className="truncate text-[0.6875rem] text-muted">
        {source} · {t(lyrics.lines.length > 0 ? "lyrics.timed" : "lyrics.untimed")}
      </p>
      <div className="flex shrink-0 items-center gap-3">
        {follow && <FollowSwitch on={follow.on} toggle={follow.toggle} />}
        <ActionHelp text={t("lyrics.againHelp")}>
          <Button
            isIconOnly
            variant="tertiary"
            size="sm"
            onPress={onAgain}
            isDisabled={isPending}
            aria-label={t("lyrics.again")}
            className="-mr-2 rounded-lg text-muted hover:text-foreground"
          >
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
          </Button>
        </ActionHelp>
      </div>
    </div>
  );
}

/** The panel's content for one track. Mounted with the popover, so stored
 * lyrics load on open and the network waits for a button. */
function LyricsBody({ track, follow }: { track: PlayableTrack; follow: { on: boolean; toggle: () => void } }) {
  const { t } = useTranslation("player");
  const queryClient = useQueryClient();
  const id = Number(track.id);

  // No retry: a local read failing means the sidecar is down.
  const stored = useQuery({
    queryKey: lyricsKey(id),
    queryFn: () => fetchLyrics(id, false),
    staleTime: Infinity,
    retry: false,
  });

  const search = useMutation({
    mutationFn: (force: boolean) => fetchLyrics(id, true, force),
    onSuccess: (found) => queryClient.setQueryData(lyricsKey(id), found),
  });

  if (stored.isPending)
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner size="sm" />
      </div>
    );

  const lyrics = stored.data;
  const hasWords = Boolean(lyrics && (lyrics.lines.length > 0 || lyrics.plain));

  if (lyrics && hasWords)
    return (
      <>
        {lyrics.lines.length > 0 ? (
          <TimedLyrics lines={lyrics.lines} follow={follow.on} />
        ) : (
          <p className={`${BODY} px-5 py-4 text-sm leading-relaxed whitespace-pre-line`}>{lyrics.plain}</p>
        )}
        <LyricsFooter
          lyrics={lyrics}
          isPending={search.isPending}
          onAgain={() => search.mutate(true)}
          follow={lyrics.lines.length > 0 ? follow : undefined}
        />
      </>
    );

  // Four distinct empty states, each with its own next step: never searched,
  // no lyrics found, services unreachable, or our own error.
  const searched = search.isSuccess || search.isError;
  const state = lyrics?.instrumental
    ? "instrumental"
    : lyrics?.unreachable
      ? "unreachable"
      : search.isError || stored.isError
        ? "failed"
        : searched
          ? "notFound"
          : "none";

  return (
    <LyricsOffer
      title={t(`lyrics.${state}`)}
      hint={state === "none" ? undefined : t(`lyrics.${state}Hint`)}
      action={
        state === "instrumental"
          ? undefined
          : {
              label: t(search.isPending ? "lyrics.searching" : state === "none" ? "lyrics.search" : "lyrics.retry"),
              isPending: search.isPending,
              onPress: () => search.mutate(false),
            }
      }
    />
  );
}

/** Lyrics for the playing track, one track at a time and only on demand. */
export function LyricsPanel() {
  const { t } = useTranslation("player");
  const { current } = usePlayer();
  // Held here so the reader's choice survives track changes.
  const [follow, setFollow] = useState(true);

  return (
    <Popover.Root>
      <Popover.Trigger aria-label={t("lyrics.title")} className={BAR_TRIGGER}>
        <MicVocal className="size-4" />
      </Popover.Trigger>
      {/* Clips the header's wash to the rounded corners. */}
      <Popover.Content placement="top end" className="w-96 overflow-hidden p-0">
        <Popover.Dialog aria-label={t("lyrics.title")} className="p-0">
          <div className="flex items-center gap-3.5 border-b border-separator/60 panel-wash px-5 pt-4 pb-3.5">
            <TrackThumb artUrl={current?.artUrl} size="size-11" radius="rounded-lg" loading="eager" />
            <div className="min-w-0 flex-1">
              <p className="text-[0.6875rem] font-semibold tracking-wider text-accent uppercase">{t("lyrics.title")}</p>
              <p className="mt-0.5 truncate text-sm font-semibold tracking-tight">
                {current?.title ?? t("nothingPlaying")}
              </p>
              {current?.subtitle && <p className="truncate text-xs text-muted">{current.subtitle}</p>}
            </div>
          </div>
          {current ? (
            <LyricsBody
              key={current.id}
              track={current}
              follow={{ on: follow, toggle: () => setFollow((on) => !on) }}
            />
          ) : (
            <p className="px-5 py-5 text-sm text-muted">{t("lyrics.nothingPlayingHint")}</p>
          )}
        </Popover.Dialog>
      </Popover.Content>
    </Popover.Root>
  );
}
