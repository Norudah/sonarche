import { Headphones, ScanSearch } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useInspectMode } from "@/features/library/inspect/inspectMode";
import { layoutIds, springs } from "@/shared/motion/tokens";

/* The composer's segmented control, in the topbar's height. Same vocabulary on
 * purpose — one pill sliding between two segments already means "throw this
 * switch" in this app (KindChoice, ViewModeSwitch) — and it is also what fixed
 * this control's cramped look: with a single sliding pill there is only ever
 * one filled shape on screen, and the resting segment is plain text with air
 * around it instead of a second box glued to the first. */
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
  /** Which room the switch is in — it decides the pill's colour, not the
   * segment's place: amber is the inspection room's wall, wherever the pill
   * happens to sit. */
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
      {/* Load-bearing wrapper: the sliding pill is absolutely positioned, so it
       * paints over in-flow siblings. Positioning the content puts it back on
       * top — same as the composer's switch. */}
      <span className="relative flex items-center gap-1.5">{children}</span>
    </button>
  );
}

/**
 * The lens, as the app's own switch: both modes named, one pill on the live one.
 *
 * Its whole history is a search for the shape that says "this alternates".
 * A bare icon read as a third door beside settings; a pill naming the current
 * mode read as a status badge; two adjoining boxes read as cramped furniture
 * wedged into the bar. The sliding pill is the answer the app already had —
 * the resting mode is quiet text, so the control is mostly air, and the pill
 * crossing over *is* the switch being thrown.
 *
 * The colour carries the argument. Listening is the app's ordinary chrome;
 * inspecting is amber, the same amber every missing tag and every doubtful
 * match wears underneath — so the lit pill is not only the way into that room,
 * it is a sample of what the room looks like.
 */
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
