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

/* A card background, not just a border: invisible on light, needed on dark. */
const ROW = "flex items-center gap-4 rounded-xl border border-separator/60 bg-surface px-4 py-3";

/** One glyph per kind of defect, so rows are recognisable before being read. */
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

/** Only the suspect-match glyph is amber: the one line where the app may have
 * written something wrong. Counts are amber (see `COUNT`). */
const SUSPECT_TONE = "bg-warning-soft text-warning";
const NEUTRAL_TONE = "bg-surface-secondary text-muted";

/** Amber counts: every check can be disabled or accepted, so a remaining
 * number is something left to do. */
const COUNT = "text-lg font-semibold text-warning tabular-nums";

/** A few names the count is made of. */
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

/** "Seen, and wanted as it is": closes the line without changing the library.
 * Revealed on hover; reversible below the queue. */
function AcceptButton({ onAccept, isPending }: { onAccept: () => void; isPending: boolean }) {
  const { t } = useTranslation("metadata");

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={(event) => {
        // The row is a link; accepting isn't navigating.
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

/** One queue row: the whole row links when it has one door; the genre row has
 * one pill per door. */
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
          <span className={COUNT}>{line.count}</span>
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
            // The pill carries the number, so it's amber like the counts.
            className="group/door flex items-center gap-1 rounded-full bg-warning-soft px-3 py-1 text-[0.8125rem] font-medium text-warning tabular-nums outline-none transition-colors hover:bg-warning/20 focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            {t(`queue.${door.key}`, { count: door.count })}
            <ChevronRight className="size-3.5 transition-transform group-hover/door:translate-x-0.5" />
          </Link>
        ))}
      </span>
    </div>
  );
}
