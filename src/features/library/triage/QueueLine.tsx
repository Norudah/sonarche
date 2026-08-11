import {
  CalendarOff,
  Check,
  ChevronRight,
  Copy,
  Hash,
  ImageOff,
  Layers,
  ListX,
  ScanSearch,
  UserRoundX,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import type { TriageLine } from "@/features/library/triage/queue";

/* `bg-surface` and not just a border: a row of the queue is a card, the same
 * one `SettingCard` draws. It went without a background until now because on
 * the light theme the app ground (0.995) and a card (1.0) are the same white —
 * the omission was invisible. On the night theme it is 0.175 against 0.235, and
 * the whole page read as a hole with hairlines drawn on it. */
const ROW = "flex items-center gap-4 rounded-xl border border-separator/60 bg-surface px-4 py-3";

/**
 * One glyph per kind of defect.
 *
 * The five rows used to be typographically identical, so "10 tracklists with
 * holes" and "1 missing cover" arrived as the same object and the eye had to
 * read every line to find its way. A glyph is what makes a row recognisable
 * before it is read.
 */
const ICONS: Record<TriageLine["key"], LucideIcon> = {
  suspect: ScanSearch,
  duplicates: Copy,
  year: CalendarOff,
  track: Hash,
  genre: Layers,
  artwork: ImageOff,
  tracklist: ListX,
  artistImage: UserRoundX,
};

/**
 * Amber is spent on one row only.
 *
 * Every glyph used to wear it, which put a warning colour on "missing year" —
 * an absence in someone's own files, not an alarm — and made the page read as
 * six accusations. A suspect match is different in kind: it is the one line
 * where *we* may have written the wrong thing into a track, so it keeps the
 * warning tone and now owns it alone. The rest are neutral: still a queue,
 * still doors, no longer a scolding.
 */
const SUSPECT_TONE = "bg-warning-soft text-warning";
const NEUTRAL_TONE = "bg-surface-secondary text-muted";

/** "Neon Slumber, Half Light +19" — what the count is made of, in plain
 * muted text (not individually clickable in v1; the door opens the list). */
function Examples({ line }: { line: TriageLine }) {
  const { t } = useTranslation("metadata");

  if (line.examples.length === 0) return null;
  const rest = line.count - line.examples.length;

  return (
    <p className="mt-0.5 truncate text-xs text-muted">
      {line.examples.join(", ")}
      {rest > 0 && ` ${t("queue.more", { count: rest })}`}
    </p>
  );
}

function Glyph({ line }: { line: TriageLine }) {
  const Icon = ICONS[line.key];
  const tone = line.key === "suspect" ? SUSPECT_TONE : NEUTRAL_TONE;

  return (
    <span aria-hidden className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
      <Icon className="size-[1.125rem]" />
    </span>
  );
}

/**
 * "Seen, and wanted as it is."
 *
 * The answer that was missing. Every other action on this page changes the
 * library until the check passes; this one changes nothing and closes the line
 * anyway, which is what makes zero reachable on a collection of rips whose tags
 * are simply never going to be complete. Nothing is destroyed — the page keeps
 * a line at the bottom that takes it all back.
 *
 * Quiet by design, and revealed on hover: it is the second thing to do with a
 * line, after looking at what is in it.
 */
function AcceptButton({ onAccept, isPending }: { onAccept: () => void; isPending: boolean }) {
  const { t } = useTranslation("metadata");

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={(event) => {
        // The row is a link; answering it is not navigating into it.
        event.preventDefault();
        event.stopPropagation();
        onAccept();
      }}
      className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-muted opacity-0 transition group-hover/line:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent/40 hover:bg-surface-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Check className="size-3.5" />
      {t("accept.action")}
    </button>
  );
}

/**
 * One row of the correction queue. With a single door the whole row is the
 * link; the fused genre row instead carries one pill per door, because
 * "missing" and "off-tree" open two different filtered lists.
 */
export function QueueLine({
  line,
  isPending,
  onAccept,
  style,
}: {
  line: TriageLine;
  isPending: boolean;
  onAccept: (target: NonNullable<TriageLine["accept"]>) => void;
  style?: CSSProperties;
}) {
  const { t } = useTranslation("metadata");

  const label = (
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium">{t(`queue.${line.key}`)}</p>
      <Examples line={line} />
    </div>
  );

  const accept = line.accept && (
    <AcceptButton isPending={isPending} onAccept={() => line.accept && onAccept(line.accept)} />
  );

  if (line.doors.length === 1) {
    return (
      <Link
        to={line.doors[0].to}
        style={style}
        className={`${ROW} group/line cascade-item outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-accent/40`}
      >
        <Glyph line={line} />
        {label}
        {accept}
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-lg font-semibold tabular-nums">{line.count}</span>
          <ChevronRight className="size-4 text-muted transition-transform group-hover/line:translate-x-0.5" />
        </span>
      </Link>
    );
  }

  return (
    <div style={style} className={`${ROW} group/line cascade-item`}>
      <Glyph line={line} />
      {label}
      {accept}
      <span className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {line.doors.map((door) => (
          <Link
            key={door.key}
            to={door.to}
            className="group/door flex items-center gap-1 rounded-full bg-surface-secondary px-3 py-1 text-[0.8125rem] tabular-nums outline-none transition-colors hover:bg-surface-tertiary focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            {t(`queue.${door.key}`, { count: door.count })}
            <ChevronRight className="size-3.5 text-muted transition-transform group-hover/door:translate-x-0.5" />
          </Link>
        ))}
      </span>
    </div>
  );
}
