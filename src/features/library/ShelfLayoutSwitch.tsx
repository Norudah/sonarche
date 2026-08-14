import { LayoutGrid, Rows3 } from "lucide-react";
import { motion } from "motion/react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";

import type { ShelfLayout } from "@/features/library/shelfLayout";
import { springs } from "@/shared/motion/tokens";

/* The view-mode switch's shape, down to the padding and the type size: one pill
 * sliding between two labelled segments already means "throw this switch" in
 * this app, and a second dialect for the same gesture would make the two read as
 * unrelated controls.
 *
 * Labelled, not icon-only. Nothing else in the app asks the user to read an
 * icon on its own, and a grid glyph next to a rows glyph is exactly the pair
 * that gets guessed wrong — the words cost 60px and remove the guess. */
const SEGMENT =
  "relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-medium whitespace-nowrap " +
  "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40";

function Segment({
  layout,
  current,
  icon: Icon,
  label,
  onSelect,
}: {
  layout: ShelfLayout;
  current: ShelfLayout;
  icon: ComponentType<{ className?: string }>;
  label: string;
  onSelect: (layout: ShelfLayout) => void;
}) {
  const isActive = current === layout;

  return (
    <button
      type="button"
      onClick={() => onSelect(layout)}
      aria-pressed={isActive}
      className={SEGMENT + (isActive ? " text-accent" : " text-muted hover:text-foreground")}
    >
      {isActive && (
        <motion.span
          layoutId="shelfLayoutPill"
          transition={springs.snappy}
          className="absolute inset-0 rounded-full bg-surface shadow-xs"
        />
      )}
      {/* Load-bearing wrapper: the sliding pill is absolutely positioned, so it
       * paints over in-flow siblings. Positioning the content puts it back on
       * top — the same reason `ViewModeSwitch` wraps its own label. */}
      <span className="relative flex items-center gap-1.5">
        <Icon className="size-3.5 shrink-0" />
        {label}
      </span>
    </button>
  );
}

/** Covers or rows, for a shelf that can be read either way. */
export function ShelfLayoutSwitch({
  layout,
  onChange,
}: {
  layout: ShelfLayout;
  onChange: (layout: ShelfLayout) => void;
}) {
  const { t } = useTranslation("library");

  return (
    <div className="flex h-9 shrink-0 flex-row items-center gap-0.5 rounded-full bg-default/60 p-0.5">
      <Segment layout="grid" current={layout} icon={LayoutGrid} label={t("layout.grid")} onSelect={onChange} />
      <Segment layout="list" current={layout} icon={Rows3} label={t("layout.list")} onSelect={onChange} />
    </div>
  );
}
