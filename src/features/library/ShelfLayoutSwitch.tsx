import { LayoutGrid, Rows3 } from "lucide-react";
import { motion } from "motion/react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";

import type { ShelfLayout } from "@/features/library/shelfLayout";
import { springs } from "@/shared/motion/tokens";

/* Same shape as the view-mode switch; labelled rather than icon-only. */
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
      {/* Positioned so the label paints above the absolute pill. */}
      <span className="relative flex items-center gap-1.5">
        <Icon className="size-3.5 shrink-0" />
        {label}
      </span>
    </button>
  );
}

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
