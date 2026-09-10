import { Popover } from "@heroui/react";
import { SlidersHorizontal } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { ChecksList } from "@/features/library/triage/ChecksList";
import type { CheckKey } from "@/features/library/triage/enabledChecks";
import type { TriageLine } from "@/features/library/triage/queue";

/**
 * Which checks this page is allowed to raise.
 *
 * Every line stays listed here whether it is on or not, with the count it would
 * report — turning one off must not make it vanish from the place you go to
 * turn it back on, and a line reading "0" is itself the answer to "is this
 * still worth watching".
 *
 * A popover rather than only a settings page: the question occurs to someone
 * looking at the queue, and an answer three screens away from the annoyance is
 * an answer nobody finds — the same reasoning that moved the badge switch onto
 * this hero. Settings carries the same switches (see `ChecksList`) for whoever
 * arrives from the other direction; the counts are this surface's alone.
 */
export function ChecksMenu({ queue, disabled }: { queue: TriageLine[]; disabled: CheckKey[] }) {
  const { t } = useTranslation("metadata");
  const counts = useMemo(() => new Map(queue.map((line) => [line.key, line.count])), [queue]);

  return (
    <Popover>
      <Popover.Trigger
        aria-label={t("checks.label")}
        className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.8125rem] text-muted outline-none transition-colors hover:bg-surface-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <SlidersHorizontal className="size-3.5" />
        {t("checks.label")}
      </Popover.Trigger>

      <Popover.Content placement="bottom end">
        <Popover.Dialog className="flex w-[19rem] flex-col gap-3 p-4 outline-none">
          <div className="flex flex-col gap-1">
            <Popover.Heading className="text-[0.8125rem] font-semibold">{t("checks.heading")}</Popover.Heading>
            <p className="text-xs leading-relaxed text-muted">{t("checks.why")}</p>
          </div>

          <ChecksList disabled={disabled} counts={counts} />
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
