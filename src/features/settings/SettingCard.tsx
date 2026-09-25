import { cn } from "@heroui/react";
import type { ReactNode } from "react";

import { FLASH, useSettingHighlight } from "@/features/settings/SettingsPanel";

/** A setting that needs its own surface (format, key field, service list,
 * dial). `settingKey` (i18n base key) lets search results highlight it. */
export function SettingCard({ settingKey, children }: { settingKey?: string; children: ReactNode }) {
  const { ref, isLit } = useSettingHighlight(settingKey);

  return (
    <div
      ref={ref}
      data-setting={settingKey}
      className={cn("rounded-xl border border-separator bg-surface p-4 transition-shadow", isLit && FLASH)}
    >
      {children}
    </div>
  );
}

interface SettingCardHeaderProps {
  title: string;
  /** Always visible, unlike a row's hover help. */
  description?: string;
  /** Opposite the title: a chip, a value, or the card's action. */
  trailing?: ReactNode;
}

/** Card header: one type scale for the whole pane, never an icon. */
export function SettingCardHeader({ title, description, trailing }: SettingCardHeaderProps) {
  return (
    <div className="flex flex-col gap-1">
      {/* Only the title line shares width with the trailing slot. */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="min-w-0 truncate text-[0.8125rem] font-semibold">{title}</h3>
        {trailing && <div className="flex shrink-0 items-center gap-2">{trailing}</div>}
      </div>
      {description && <p className="text-[0.8125rem] leading-relaxed text-muted">{description}</p>}
    </div>
  );
}
