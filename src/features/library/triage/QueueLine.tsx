import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import type { TriageLine } from "@/features/library/triage/queue";

/* `bg-surface` and not just a border: a row of the queue is a card, the same
 * one `SettingCard` draws. It went without a background until now because on
 * the light theme the app ground (0.995) and a card (1.0) are the same white —
 * the omission was invisible. On the night theme it is 0.175 against 0.235, and
 * the whole page read as a hole with hairlines drawn on it. */
const ROW = "flex items-center justify-between gap-4 rounded-xl border border-separator/60 bg-surface px-4 py-3";

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

/**
 * One row of the correction queue. With a single door the whole row is the
 * link; the fused genre row instead carries one pill per door, because
 * "missing" and "off-tree" open two different filtered lists.
 */
export function QueueLine({ line }: { line: TriageLine }) {
  const { t } = useTranslation("metadata");

  const label = (
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium">{t(`queue.${line.key}`)}</p>
      <Examples line={line} />
    </div>
  );

  if (line.doors.length === 1) {
    return (
      <Link
        to={line.doors[0].to}
        className={`${ROW} group/line outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-accent/40`}
      >
        {label}
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-lg font-semibold tabular-nums">{line.count}</span>
          <ChevronRight className="size-4 text-muted transition-transform group-hover/line:translate-x-0.5" />
        </span>
      </Link>
    );
  }

  return (
    <div className={ROW}>
      {label}
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
