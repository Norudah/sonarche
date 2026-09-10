import { cn } from "@heroui/react";
import type { ReactNode } from "react";

import { FLASH, useSettingHighlight } from "@/features/settings/SettingsPanel";

/** One setting that needs a surface of its own — a format chooser, a key
 * field, a list of services, a dial — boxed with the same rounded-xl /
 * separator border the queue table and the cards wear elsewhere.
 *
 * `settingKey` is the setting's i18n base key. It is what lets a search result
 * ring this card the way it rings a row; a card with nothing to point at (a
 * heading card, a purely informational one) can leave it out.
 *
 * The padding is the rows' own (16px, against their 16/12), not the 20 it used
 * to be: a card and a row are two shapes for the same rank of thing, and a
 * card that is roomier than the panel above it reads as more important than
 * the switches — which it is not. */
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
  /** The card's own sentence. Stays on screen here rather than folding behind
   * a hover mark the way a row's does: a card exists precisely because its
   * setting needed more than a line. */
  description?: string;
  /** Whatever sits opposite the title — a state chip, a value, the button that
   * runs the card's one action. */
  trailing?: ReactNode;
}

/**
 * Every card's head, at the panel's scale, and never with a glyph.
 *
 * There was one for a while, on the cards that happened to have an obvious
 * one. That is exactly the failure: a settings list where some names carry a
 * picture and others do not reads as two kinds of thing, and the reader spends
 * a beat working out what the difference means before finding out it means
 * nothing. Uniform beats decorated.
 *
 * Written by hand nine times before this existed, and it had drifted exactly
 * where you would expect: `font-medium` on an unstated size (16px) over
 * `text-sm` prose (14px), sitting one line under switch rows set at 13px. In a
 * 42rem dialog column the difference is not subtle — the card titles read as
 * section headings and the section header stops being one. One type scale for
 * the whole pane, stated once here.
 */
export function SettingCardHeader({ title, description, trailing }: SettingCardHeaderProps) {
  return (
    <div className="flex flex-col gap-1">
      {/* Only the title line shares its width with the trailing slot. The
          sentence underneath runs the full card: a paragraph squeezed into the
          half-column left by a status chip wraps after five words and turns a
          three-line explanation into seven. */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="min-w-0 truncate text-[0.8125rem] font-semibold">{title}</h3>
        {trailing && <div className="flex shrink-0 items-center gap-2">{trailing}</div>}
      </div>
      {description && <p className="text-[0.8125rem] leading-relaxed text-muted">{description}</p>}
    </div>
  );
}
