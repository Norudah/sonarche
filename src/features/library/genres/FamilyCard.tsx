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

/** Chips beyond this fold into a "+N" chip that opens the family page, where
 * SubGenreChips shows them all. Browse mode only: arrange mode unfolds them —
 * a genre that cannot be seen cannot be dragged. */
const VISIBLE_SUBS = 5;

/** Every affordance on this card is a link, and the app answers a pointer by
 * scaling under a snappy spring — the album and artist cards' play buttons do
 * exactly this. Motion cannot drive a bare <Link>, hence the wrapper. */
const MotionLink = motion.create(Link);

/** What the arrange mode hands each card: the drag plumbing and who is where.
 * One object for the whole shelf — the cards read their own part off it. */
export interface ArrangeProps {
  /** Spread onto a draggable chip. */
  chipProps: (
    genre: string,
    from: string,
  ) => {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  };
  /** Card key currently under a live drag, or null. */
  over: string | null;
  /** Genre in flight, to quiet the chip it was lifted from. */
  dragging: string | null;
}

interface FamilyCardProps {
  family: Family;
  label: string;
  style?: CSSProperties;
  /** Present while the page is in arrange mode: chips become handles, links go
   * quiet, the card becomes a drop target. */
  arrange?: ArrangeProps;
}

/** Washed in the family tone rather than neutral: the chips are the card's
 * content, so they carry the identity at a lower volume than the rule. */
const chipClass =
  "inline-block rounded-full bg-[color-mix(in_oklab,var(--tone)_12%,transparent)] px-2.5 py-1 text-[0.75rem] " +
  "text-foreground/85 outline-none transition-colors hover:bg-[color-mix(in_oklab,var(--tone)_20%,transparent)] " +
  "focus-visible:ring-2 focus-visible:ring-accent/40";

/** A draggable chip in arrange mode: grabbable, trembling, and — when motion
 * is reduced — dashed instead, so the mode never goes mute. `touch-none` keeps
 * a finger-drag from scrolling the page out from under the gesture. */
const looseChipClass =
  "inline-block cursor-grab touch-none rounded-full bg-[color-mix(in_oklab,var(--tone)_12%,transparent)] px-2.5 py-1 " +
  "text-[0.75rem] text-foreground/85 outline-none select-none active:cursor-grabbing " +
  "focus-visible:ring-2 focus-visible:ring-accent/40 " +
  "motion-reduce:outline motion-reduce:outline-1 motion-reduce:outline-dashed " +
  "motion-reduce:outline-offset-2 motion-reduce:outline-[color-mix(in_oklab,var(--tone)_45%,transparent)]";

/**
 * One browse family as a door, not a statistic.
 *
 * The family's identity is carried quietly: a short tone rule to the left of
 * the name — the same device the album drawer uses to head a section — plus
 * chips washed in that tone and a whisper of it behind the whole card. No
 * heavy colour block or full-height border: thirteen of these read as one
 * shelf, not a rainbow.
 *
 * Navigation is two kinds of link, kept apart so neither nests inside the
 * other: the arrow button opens the family page, and each chip deep-links to
 * one genre on that same page via the `genre` query param SubGenreChips
 * already understands. The title is deliberately not a link — one explicit
 * affordance beats a whole header that highlights on hover.
 *
 * The chips push rather than replace — from the index the family page is a new
 * place, unlike the refinement chips on the page itself.
 *
 * In arrange mode the card changes species: chips stop being doors and become
 * objects (they tremble, they drag), the arrow goes quiet, and the card itself
 * becomes a landing zone that lights in its own tone when a drag hovers it.
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
          /* The door is closed while the furniture moves: a live link under a
           * drop gesture is a misclick machine. Kept visible at low volume so
           * the card's anatomy does not jump between modes. */
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
                /* A genre that IS a family root cannot move (the sidecar
                 * refuses it); it sits still so stillness keeps meaning
                 * "pinned" while everything loose trembles. */
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

/**
 * A family that holds nothing yet, conjured only for arrange mode — ordinarily
 * an empty family has no card, which means no landing zone. Dashed where the
 * real cards are solid, tone at a whisper, and it fills in (solid outline,
 * fuller wash) the moment a drag hovers: the card previews the shelf it would
 * become. Dropping here is what brings it to life for real.
 */
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
