import { Headphones, ScanSearch } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useInspectMode } from "@/features/library/inspect/inspectMode";
import { layoutIds, springs } from "@/shared/motion/tokens";

/* The composer's segmented control, at topbar height. */
const SEGMENT =
  "relative flex h-full cursor-pointer items-center rounded-full px-3 text-[0.8125rem] font-medium " +
  "whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40";

function Segment({
  active,
  inspecting,
  onPress,
  children,
}: {
  active: boolean;
  /** Decides the pill's colour (amber when inspecting). */
  inspecting: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onPress}
      className={
        SEGMENT + (active ? (inspecting ? " text-warning" : " text-foreground") : " text-muted hover:text-foreground")
      }
    >
      {active && (
        <motion.span
          layoutId={layoutIds.inspectLens}
          transition={springs.snappy}
          className={`absolute inset-0 rounded-full ${inspecting ? "bg-warning-soft" : "bg-surface shadow-xs"}`}
        />
      )}
      {/* Positioned so the label paints above the absolute pill. */}
      <span className="relative flex items-center gap-1.5">{children}</span>
    </button>
  );
}

/** The lens switch: both modes named, a sliding pill on the active one. Amber
 * when inspecting, the colour of the problems it reveals. */
export function InspectSwitch() {
  const { t } = useTranslation("library");
  const { inspecting, setInspecting } = useInspectMode();

  return (
    <div
      role="group"
      aria-label={t("inspect.switchLabel")}
      className="flex h-8 shrink-0 items-center rounded-full bg-default/60 p-0.5"
    >
      <Segment active={!inspecting} inspecting={inspecting} onPress={() => setInspecting(false)}>
        <Headphones className="size-3.5 shrink-0" />
        {t("inspect.modeListening")}
      </Segment>
      <Segment active={inspecting} inspecting={inspecting} onPress={() => setInspecting(true)}>
        <ScanSearch className="size-3.5 shrink-0" />
        {t("inspect.modeInspecting")}
      </Segment>
    </div>
  );
}
