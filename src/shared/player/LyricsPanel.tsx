import { Button, Popover, Spinner } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Hand, Loader2, Magnet, MicVocal, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { BAR_TRIGGER } from "@/shared/player/barTrigger";
import { activeLineIndex, fetchLyrics, type Lyrics, type LyricLine } from "@/shared/player/lyrics";
import { usePlayer, usePlayerProgress } from "@/shared/player/PlayerContext";
import type { PlayableTrack } from "@/shared/player/types";
import { PrimaryButton } from "@/shared/ui/PrimaryButton";
import { TrackThumb } from "@/shared/ui/TrackThumb";

const lyricsKey = (id: number) => ["lyrics", id] as const;

/** The body's ceiling. No floor: a panel padded out to a fixed height so its
 * states would not resize each other left a lake of empty surface under a
 * two-line answer, and the states only ever change when the reader asks. */
const BODY = "max-h-[19rem] overflow-y-auto";

/** How long the panel stops following the playhead after the reader has
 * scrolled by hand. Long enough to read back a verse, short enough that the
 * panel catches up on its own rather than needing to be told to. */
const FOLLOW_PAUSE_MS = 6000;

/**
 * The timed lines, following the playhead.
 *
 * Its own component because it is the only thing in the panel that redraws with
 * the playhead — `usePlayerProgress` fires a few times a second, and the header
 * and footer around it have no business re-rendering with it.
 *
 * A line is marked exactly the way the queue marks the playing track — accent
 * text on an accent wash — because it is the same statement: this is the one
 * you are on. That also means the panel still says where you are when the
 * following is paused or the timings are askew, which is the case the scroll
 * alone cannot be trusted for.
 */
function TimedLyrics({ lines, follow }: { lines: LyricLine[]; follow: boolean }) {
  const { t } = useTranslation("player");
  const { currentTime } = usePlayerProgress();
  const { seek } = usePlayer();
  const listRef = useRef<HTMLUListElement>(null);
  const activeRef = useRef<HTMLLIElement>(null);
  /** When the panel may resume following. Set by the reader's own scrolling. */
  const followFrom = useRef(0);

  const active = activeLineIndex(lines, currentTime);

  // Syncing with an external system — the scroll offset of a real node, which
  // no re-render moves on its own. `scrollTo` on the list rather than
  // `scrollIntoView` on the line: the latter walks up the ancestors and would
  // scroll the page behind the popover along with it.
  // `follow` is in the dependencies, not just in the guard: switching it back
  // on has to bring the panel to the current line at once, or the reader is
  // left staring at wherever they had scrolled to and has to hunt for it.
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

  // Wheel and touch, not `scroll`: the scroll event fires for our own smooth
  // animation too, and could not tell the reader's intent from the panel's.
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
          {/* A line is a place in the track, so it is a control: pressing one
           * takes playback there — the only way to re-hear a verse without
           * hunting for it on the seek bar. */}
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

/** The panel's own offer, in the shape the rest of the app makes one: a tinted
 * tile, a line that says where things stand, a hint, and the way out. */
function LyricsOffer({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  /** Absent when there is nothing left to try — an instrumental is an answer,
   * and a button that would return it again is not an offer. */
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

/**
 * Where the words came from, and the way to ask again.
 *
 * The provenance is not a credit line: it is what tells the reader why nothing
 * is scrolling. lyrics.ovh has no timings to give, so a page that came from it
 * is a page to re-fetch once LRCLIB is answering again — which is exactly what
 * the button beside it does.
 */
function LyricsFooter({
  lyrics,
  isPending,
  onAgain,
  follow,
}: {
  lyrics: Lyrics;
  isPending: boolean;
  onAgain: () => void;
  /** Absent when there is no timing to follow — a plain page has no scroll of
   * its own to hand back, so offering the switch would only puzzle. */
  follow?: { on: boolean; toggle: () => void };
}) {
  const { t } = useTranslation("player");
  // The services' own names, cased the way they write them — the wire value is
  // an identifier, not a label.
  const source =
    lyrics.source === "lrclib" ? "LRCLIB" : lyrics.source === "lyrics.ovh" ? "lyrics.ovh" : t("lyrics.fromStored");

  return (
    <div className="flex items-center justify-between gap-3 border-t border-separator px-5 py-2">
      <p className="truncate text-[0.6875rem] text-muted">
        {source} · {t(lyrics.lines.length > 0 ? "lyrics.timed" : "lyrics.untimed")}
      </p>
      <div className="-mr-2 flex shrink-0 items-center">
        {follow && (
          <Button
            isIconOnly
            variant="tertiary"
            size="sm"
            onPress={follow.toggle}
            aria-pressed={follow.on}
            aria-label={t(follow.on ? "lyrics.followOff" : "lyrics.followOn")}
            className={`rounded-lg ${follow.on ? "text-accent" : "text-muted hover:text-foreground"}`}
          >
            {follow.on ? <Magnet className="size-3.5" /> : <Hand className="size-3.5" />}
          </Button>
        )}
        <Button
          isIconOnly
          variant="tertiary"
          size="sm"
          onPress={onAgain}
          isDisabled={isPending}
          aria-label={t("lyrics.again")}
          className="rounded-lg text-muted hover:text-foreground"
        >
          {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
        </Button>
      </div>
    </div>
  );
}

/**
 * What the panel shows for one track, and the only thing that talks to the
 * sidecar. Mounted with the popover, so the stored lookup runs on open and not
 * before — and the network stays untouched until a button is pressed.
 */
function LyricsBody({ track, follow }: { track: PlayableTrack; follow: { on: boolean; toggle: () => void } }) {
  const { t } = useTranslation("player");
  const queryClient = useQueryClient();
  const id = Number(track.id);

  // No retry: this read only touches the library, so a failure means the
  // sidecar is down — three more attempts would just delay saying so.
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

  // Nothing to show, and which silence it is decides what to say. Four of them,
  // and they are four because they call for four different next moves: never
  // looked, the databases have no words for this recording, they did not answer
  // at all, or our own side broke.
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

/**
 * Lyrics for the playing track, on demand.
 *
 * Deliberately one track at a time and never on its own initiative: the panel
 * reads what the library already holds when it opens, and only its buttons go
 * looking. A song someone wants the words to is a one-off, not something to
 * sweep a library for.
 */
export function LyricsPanel() {
  const { t } = useTranslation("player");
  const { current } = usePlayer();
  // Held here rather than inside the body, which remounts on every track: a
  // reader who has taken the wheel means it for the session, not for one song.
  const [follow, setFollow] = useState(true);

  return (
    <Popover.Root>
      <Popover.Trigger aria-label={t("lyrics.title")} className={BAR_TRIGGER}>
        <MicVocal className="size-4" />
      </Popover.Trigger>
      <Popover.Content placement="top end" className="w-96 p-0">
        <Popover.Dialog aria-label={t("lyrics.title")} className="p-0">
          {/* The drawers' object header, at popover scale: the record on the
           * left, an accent eyebrow naming the panel, then the track. Same wash
           * and same hairline, so this reads as one of the app's panels about a
           * track rather than a tooltip that happens to hold text. */}
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
