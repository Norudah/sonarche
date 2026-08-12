import { Radio } from "@heroui/react";
import { motion } from "motion/react";

import type { ThemePreference } from "@/features/settings/theme";
import { layoutIds, springs } from "@/shared/motion/tokens";

/**
 * A 200 px drawing of Sonarche wearing one theme: the sidebar with its accent
 * item, a page title, two cards on the ground, the player bar with its accent
 * transport. Enough structure that the tile is recognisably *this* app and not
 * a generic light/dark swatch, and no more — it has to read at a glance.
 *
 * Its colours come from `.theme-tile[data-tone]` in theme.css, which is the one
 * frozen copy of the palette in the app: the light tile must stay light while
 * the app is dark, so these are the only surfaces that must not follow the
 * theme selector.
 */
function Miniature({ tone }: { tone: "light" | "dark" }) {
  return (
    <div data-tone={tone} className="theme-tile absolute inset-0 flex flex-col bg-[var(--tile-background)]">
      <div className="flex min-h-0 flex-1">
        <div className="flex w-[27%] flex-col gap-1.5 border-r border-[var(--tile-separator)] bg-[var(--tile-panel)] px-2 py-2.5">
          <span className="h-1.5 w-[70%] rounded-full bg-[var(--tile-accent)]" />
          <span className="h-1 w-[85%] rounded-full bg-[var(--tile-muted)]" />
          <span className="h-1 w-[62%] rounded-full bg-[var(--tile-muted)]" />
          <span className="h-1 w-[75%] rounded-full bg-[var(--tile-muted)]" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-2.5">
          <span className="h-1.5 w-[55%] rounded-full bg-[var(--tile-ink)]" />
          <div className="flex min-h-0 flex-1 gap-1.5">
            <div className="flex-1 rounded-[4px] border border-[var(--tile-separator)] bg-[var(--tile-surface)]" />
            <div className="flex-1 rounded-[4px] border border-[var(--tile-separator)] bg-[var(--tile-surface)]" />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 border-t border-[var(--tile-separator)] bg-[var(--tile-surface)] px-2 py-1.5">
        <span className="size-2 shrink-0 rounded-full bg-[var(--tile-accent)]" />
        <span className="h-1 flex-1 rounded-full bg-[var(--tile-muted)]" />
      </div>
    </div>
  );
}

/**
 * One theme, shown rather than named.
 *
 * `system` is the two other tiles cut on the diagonal — both answers in one
 * frame. Any third invented look would be a lie: the app never wears a
 * "system" theme, it wears whichever one the desktop is on.
 */
export function ThemeTile({
  value,
  selected,
  label,
}: {
  value: ThemePreference;
  selected: ThemePreference;
  label: string;
}) {
  const isSelected = selected === value;

  return (
    <Radio.Root value={value} className="group relative mt-0">
      {/* Radio.Content is the actual react-aria RadioButton — the label the
          click handler lives on — so the drawing sits inside it: a press
          anywhere on the tile selects the theme, not just on the caption. */}
      <Radio.Content className="flex w-full cursor-pointer flex-col gap-2 text-[0.8125rem] font-medium text-muted transition-colors group-hover:text-foreground data-[selected]:text-accent">
        {/* `w-full` is load-bearing: HeroUI's `.radio` aligns its children to
            flex-start, so an aspect-ratio box with only absolute content inside
            shrinks to 3×2 actual pixels. */}
        <div className="relative aspect-[3/2] w-full overflow-hidden rounded-xl border border-separator shadow-xs">
          {value !== "dark" && <Miniature tone="light" />}
          {value === "dark" && <Miniature tone="dark" />}
          {value === "system" && (
            <div className="theme-tile__split absolute inset-0">
              <Miniature tone="dark" />
            </div>
          )}
        </div>
        <span className="self-center">{label}</span>
      </Radio.Content>

      {/* Outside the clipped frame so the ring is not shaved off by the
          overflow, and carrying the shared layoutId so it travels between
          tiles rather than blinking out and in. */}
      {isSelected && (
        <motion.span
          layoutId={layoutIds.themeChoice}
          transition={springs.snappy}
          className="pointer-events-none absolute inset-x-0 top-0 aspect-[3/2] rounded-xl ring-2 ring-accent"
        />
      )}
    </Radio.Root>
  );
}
