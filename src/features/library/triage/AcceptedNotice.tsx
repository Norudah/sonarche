import { Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { AcceptTarget } from "@/features/library/triage/queue";

/**
 * What has already been answered, and the way back out.
 *
 * Without it, "c'est voulu" would be a one-way door: the line vanishes, and
 * nothing on the page says the objects still exist or that the answer can be
 * revised. A count that can only go down by hiding things is the same
 * dishonesty the page was just cured of, in the other direction.
 *
 * Deliberately below the queue and deliberately plain — no card, no glyph, no
 * colour. It is a footnote about a decision already taken, not a seventh thing
 * to deal with, and someone who has finished with these checks should be able
 * to stop seeing it as content.
 */
export function AcceptedNotice({
  targets,
  isPending,
  onUndo,
}: {
  targets: AcceptTarget[];
  isPending: boolean;
  onUndo: (target: AcceptTarget) => void;
}) {
  const { t } = useTranslation("metadata");

  if (targets.length === 0) return null;

  return (
    <section className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 px-1">
      <p className="text-xs text-muted">{t("accept.answered")}</p>

      {targets.map((target) => (
        <button
          key={`${target.scope}:${target.check}`}
          type="button"
          disabled={isPending}
          onClick={() => onUndo(target)}
          className="flex cursor-pointer items-center gap-1.5 rounded-full bg-surface-secondary px-3 py-1 text-xs text-muted outline-none transition-colors hover:bg-surface-tertiary hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t(`queue.${target.check}`)}
          <span className="tabular-nums">{target.ids.length}</span>
          <Undo2 className="size-3.5 opacity-70" />
        </button>
      ))}
    </section>
  );
}
