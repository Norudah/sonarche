import { Switch } from "@heroui/react";
import { useTranslation } from "react-i18next";

import { CHECK_KEYS, setCheckEnabled, type CheckKey } from "@/features/library/triage/enabledChecks";

interface ChecksListProps {
  disabled: CheckKey[];
  counts?: Map<CheckKey, number>;
  /**
   * `compact` is the popover: a short list in a small floating box, where the
   * padding of a settings row would be most of the panel.
   *
   * `rows` is the settings card, and it is the same shape as every other option
   * in that dialog — ruled apart, breathing at the panel's own rhythm. Eight
   * switches stacked at popover density in a 42rem column read as one dense
   * block rather than eight separate answers.
   */
  layout?: "compact" | "rows";
}

/**
 * The eight checks, each with the switch that silences it.
 *
 * Shared by the two places that offer them: the popover on the Metadata page,
 * where the question occurs to you, and the Settings pane, where you go looking
 * for it afterwards. One list rather than two, because a control duplicated by
 * hand is a control that will disagree with itself by the next release.
 *
 * `counts` is optional and only the page passes it. On the page a line reading
 * "0" is itself an answer — "is this still worth watching" — and the numbers
 * are right there under the popover. In settings there is no queue on screen to
 * relate them to, and computing them would mean walking the whole library to
 * decorate a preference; the pane points at the page instead.
 */
export function ChecksList({ disabled, counts, layout = "compact" }: ChecksListProps) {
  const { t } = useTranslation("metadata");
  const isRows = layout === "rows";

  return (
    <div className={isRows ? "flex flex-col divide-y divide-separator/60" : "flex flex-col gap-2.5"}>
      {CHECK_KEYS.map((check) => (
        <Switch
          key={check}
          isSelected={!disabled.includes(check)}
          onChange={(enabled) => setCheckEnabled(check, enabled)}
          className="w-full"
        >
          <Switch.Content className={`w-full flex-row-reverse justify-between gap-3 ${isRows ? "px-3 py-2.5" : ""}`}>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <span className="flex min-w-0 items-center gap-1.5 text-[0.8125rem]">
              <span className="truncate">{t(`queue.${check}`)}</span>
              {counts && <span className="shrink-0 tabular-nums text-muted">{counts.get(check) ?? 0}</span>}
            </span>
          </Switch.Content>
        </Switch>
      ))}
    </div>
  );
}
