import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { genrePath } from "@/app/routes";
import { canDragGenre } from "@/features/library/genres/arrange";
import type { Family } from "@/features/library/genres/genres";
import { toneOf } from "@/features/library/genres/tone";
import { DROP_ATTR } from "@/features/library/genres/useChipDrag";
import { springs } from "@/shared/motion/tokens";

/** Beyond this, a "+N" chip opens the family page. Arrange mode shows all. */
const VISIBLE_SUBS = 5;

/** Motion can't drive a bare <Link>. */
const MotionLink = motion.create(Link);

/** Drag plumbing shared by every card in arrange mode. */
export interface ArrangeProps {
  chipProps: (
    genre: string,
    from: string,
  ) => {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  };
  /** Card under a live drag. */
  over: string | null;
  /** Genre being dragged, to quiet its source chip. */
  dragging: string | null;
}

interface FamilyCardProps {
  family: Family;
  label: string;
  style?: CSSProperties;
  /** Arrange mode: chips become handles, links go quiet, the card is a drop target. */
  arrange?: ArrangeProps;
}

/** Washed in the family tone. */
const chipClass =
  "inline-block rounded-full bg-[color-mix(in_oklab,var(--tone)_12%,transparent)] px-2.5 py-1 text-[0.75rem] " +
  "text-foreground/85 outline-none transition-colors hover:bg-[color-mix(in_oklab,var(--tone)_20%,transparent)] " +
  "focus-visible:ring-2 focus-visible:ring-accent/40";

/** Draggable: trembles (dashed under reduced motion); `touch-none` prevents scrolling. */
const looseChipClass =
  "inline-block cursor-grab touch-none rounded-full bg-[color-mix(in_oklab,var(--tone)_12%,transparent)] px-2.5 py-1 " +
  "text-[0.75rem] text-foreground/85 outline-none select-none active:cursor-grabbing " +
  "focus-visible:ring-2 focus-visible:ring-accent/40 " +
  "motion-reduce:outline motion-reduce:outline-1 motion-reduce:outline-dashed " +
  "motion-reduce:outline-offset-2 motion-reduce:outline-[color-mix(in_oklab,var(--tone)_45%,transparent)]";

/**
 * A browse family as a door: a tone rule, tinted chips linking to each genre
 * (push navigation, unlike the page's own chips) and an arrow to the family
 * page. In arrange mode chips drag, links go quiet, and the card becomes a
 * drop zone.
 */
export function FamilyCard({ family, label, style, arrange }: FamilyCardProps) {
  const { t } = useTranslation("library");
  const tone = toneOf(family.key);
  const subs = arrange ? family.subs : family.subs.slice(0, VISIBLE_SUBS);
  const hiddenCount = family.subs.length - subs.length;
  const isOver = arrange?.over === family.key;

  return (
    <div
      {...(arrange ? { [DROP_ATTR]: family.key } : {})}
      style={
        {
          ...style,
          "--tone": tone,
          background: `color-mix(in oklab, var(--tone) ${isOver ? 14 : 7}%, transparent)`,
          ...(isOver ? { outline: "2px solid var(--tone)", outlineOffset: "-1px" } : {}),
        } as CSSProperties
      }
      className="cascade-item flex flex-col rounded-2xl border border-separator transition-[background,outline-color]"
    >
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <span aria-hidden className="h-9 w-1 shrink-0 rounded-full" style={{ background: tone }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] font-semibold">{label}</span>
          <span className="mt-0.5 block truncate text-[0.6875rem] text-muted">
            {t("trackCount", { count: family.trackCount })} · {t("albumCount", { count: family.albums.length })} ·{" "}
            {t("artistCount", { count: family.artistCount })}
          </span>
        </span>
        {arrange ? (
          /* Inactive during arrange mode, but still visible so the layout doesn't jump. */
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--tone)_14%,transparent)] opacity-35"
          >
            <ArrowRight className="size-4" style={{ color: tone }} />
          </span>
        ) : (
          <MotionLink
            to={genrePath(family.key)}
            aria-label={label}
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.94 }}
            transition={springs.snappy}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--tone)_14%,transparent)] outline-none transition-colors hover:bg-[color-mix(in_oklab,var(--tone)_24%,transparent)] focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <ArrowRight className="size-4" style={{ color: tone }} />
          </MotionLink>
        )}
      </div>

      {subs.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-5 pt-0.5 pb-4">
          {subs.map((sub, index) =>
            arrange ? (
              canDragGenre(sub.name) ? (
                <button
                  key={sub.name}
                  type="button"
                  {...arrange.chipProps(sub.name, family.key)}
                  className={`chip-jiggle ${looseChipClass} ${arrange.dragging === sub.name ? "opacity-30" : ""}`}
                  style={{ "--jiggle-phase": `${(index % 5) * -0.07}s` } as CSSProperties}
                >
                  {sub.name}
                  <span className="ml-1.5 tabular-nums opacity-60">{sub.trackCount}</span>
                </button>
              ) : (
                /* Family roots can't move; they stay still. */
                <span key={sub.name} className={`${chipClass} opacity-55`}>
                  {sub.name}
                  <span className="ml-1.5 tabular-nums opacity-60">{sub.trackCount}</span>
                </span>
              )
            ) : (
              <MotionLink
                key={sub.name}
                to={genrePath(family.key, sub.name)}
                whileHover={{ scale: 1.07 }}
                whileTap={{ scale: 0.95 }}
                transition={springs.snappy}
                className={chipClass}
              >
                {sub.name}
                <span className="ml-1.5 tabular-nums opacity-60">{sub.trackCount}</span>
              </MotionLink>
            ),
          )}
          {hiddenCount > 0 && (
            <MotionLink
              to={genrePath(family.key)}
              whileHover={{ scale: 1.07 }}
              whileTap={{ scale: 0.95 }}
              transition={springs.snappy}
              className={chipClass}
            >
              {t("genres.moreSubs", { count: hiddenCount })}
            </MotionLink>
          )}
        </div>
      )}
    </div>
  );
}

interface GhostFamilyCardProps {
  familyKey: string;
  label: string;
  over: boolean;
  style?: CSSProperties;
}

/** An empty family, shown only in arrange mode as a drop target; fills in
 * when a drag hovers it. */
export function GhostFamilyCard({ familyKey, label, over, style }: GhostFamilyCardProps) {
  const { t } = useTranslation("library");
  const tone = toneOf(familyKey);

  return (
    <div
      {...{ [DROP_ATTR]: familyKey }}
      style={
        {
          ...style,
          "--tone": tone,
          background: `color-mix(in oklab, var(--tone) ${over ? 12 : 3}%, transparent)`,
          ...(over ? { outline: "2px solid var(--tone)", outlineOffset: "-1px" } : {}),
        } as CSSProperties
      }
      className={`cascade-item flex flex-col rounded-2xl border border-dashed border-separator transition-[background,outline-color] ${
        over ? "" : "opacity-80"
      }`}
    >
      <div className="flex items-center gap-3 px-5 py-4">
        <span aria-hidden className="h-9 w-1 shrink-0 rounded-full opacity-50" style={{ background: tone }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] font-semibold text-foreground/70">{label}</span>
          <span className="mt-0.5 block truncate text-[0.6875rem] text-muted">{t("genres.arrange.emptyFamily")}</span>
        </span>
      </div>
    </div>
  );
}
