import { Switch } from "@heroui/react";
import { useTranslation } from "react-i18next";

import { CHECK_KEYS, setCheckEnabled, type CheckKey } from "@/features/library/triage/enabledChecks";

interface ChecksListProps {
  disabled: CheckKey[];
  counts?: Map<CheckKey, number>;
  /** `compact` for the popover, `rows` for the Settings card. */
  layout?: "compact" | "rows";
}

/** The check switches, shared by the Metadata popover and Settings. `counts`
 * only on the page (computing them in Settings would walk the library). */
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
