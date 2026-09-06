import { cn } from "@heroui/react";
import type { ReactNode } from "react";

import { FLASH, useSettingHighlight } from "@/features/settings/SettingsPanel";

/** One setting that needs a surface of its own — a format chooser, a key
 * field, a list of services, a dial — boxed with the same rounded-xl /
 * separator border the queue table and the cards wear elsewhere.
 *
 * `settingKey` is the setting's i18n base key. It is what lets a search result
 * ring this card the way it rings a row; a card with nothing to point at (a
 * heading card, a purely informational one) can leave it out. */
export function SettingCard({ settingKey, children }: { settingKey?: string; children: ReactNode }) {
  const { ref, isLit } = useSettingHighlight(settingKey);

  return (
    <div
      ref={ref}
      data-setting={settingKey}
      className={cn("rounded-xl border border-separator bg-surface p-5 transition-shadow", isLit && FLASH)}
    >
      {children}
    </div>
  );
}
