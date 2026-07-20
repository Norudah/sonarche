import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Album } from "@/features/library/albums/albums";

/**
 * Counts from zero up to `target` on mount, and again whenever the target
 * moves — a re-match that fills six fields should be *seen* landing.
 *
 * A raw `requestAnimationFrame` rather than a Motion value: Motion animates
 * styles, and what changes here is text content. Driving a number through it
 * would mean a MotionValue plus a subscription just to call `setState`.
 *
 * The ramp is eased out, so the number sprints then settles on its final digits
 * instead of crawling the last third — a linear count reads as a loading
 * spinner made of digits.
 *
 * `prefers-reduced-motion` is checked here by hand: MotionProvider's
 * `reducedMotion="user"` only governs Motion components, and this is not one.
 * It short-circuits the *returned* value rather than pushing the target through
 * `setState`, which would be a synchronous state write inside an effect — a
 * cascading render, and one ESLint rightly flags.
 */
function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useCountUp(target: number, duration = 700): number {
  // Seeded with the real figure, not with zero, and the run starts from zero
  // only once a frame actually fires. If frames never come — a background tab,
  // a starved main thread, an automation browser with no rAF — the card shows
  // the correct number and simply does not animate, instead of sitting on a
  // wrong "0" forever. The ref remembers where the last run stopped, so a
  // target that moves mid-flight continues from there rather than snapping.
  const [value, setValue] = useState(target);
  const fromRef = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    const from = fromRef.current;
    if (from === target) return;

    let frame = 0;
    let started: number | null = null;

    const tick = (now: number) => {
      started ??= now;
      const t = Math.min((now - started) / duration, 1);
      const eased = 1 - (1 - t) ** 3;
      const current = Math.round(from + (target - from) * eased);
      setValue(current);
      fromRef.current = current;
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return prefersReducedMotion() ? target : value;
}

interface StatCardProps {
  value: string;
  label: string;
  /** Accent states a figure, green means there is nothing left to do. */
  tone: "accent" | "success";
}

/** Written out rather than interpolated: Tailwind scans source text, so a
 * `text-${tone}` never makes it into the stylesheet. */
const TONE_CLASS = {
  accent: "text-accent",
  success: "text-success",
} as const;

function StatCard({ value, label, tone }: StatCardProps) {
  return (
    <div className="rounded-xl border border-separator bg-surface/80 px-4 py-2.5 shadow-sm">
      {/* Bold, not semibold, and tight: the card shrank, so the figure has to
       * carry the weight the box used to. */}
      <p className={`text-2xl leading-none font-bold tracking-tight tabular-nums ${TONE_CLASS[tone]}`}>{value}</p>
      <p className="mt-1.5 text-[0.6875rem] text-muted">{label}</p>
    </div>
  );
}

/**
 * The two numbers a streaming service has no reason to show you, and the reason
 * this page no longer borrows one: an album here is a metadata object first.
 *
 * The score says how far the record has come; the count says how many of its
 * tracks are actually done. A percentage alone hides whether "95%" is one field
 * missing on one track or a little missing everywhere.
 */
export function AlbumStats({ album }: { album: Album }) {
  const { t } = useTranslation("library");

  // Floor, not round: 99.6% must not display as a complete 100%.
  const percent = useCountUp(Math.floor(album.completeness * 100));
  const tagged = useCountUp(album.fullyTagged);
  const isComplete = album.fullyTagged === album.tracks.length;

  return (
    <div className="flex shrink-0 items-end gap-2.5">
      <StatCard
        value={t("albums.completeness", { percent })}
        label={t("albums.stats.completeness")}
        tone={isComplete ? "success" : "accent"}
      />
      <StatCard
        value={`${tagged}/${album.tracks.length}`}
        label={t("albums.stats.tagged")}
        tone={isComplete ? "success" : "accent"}
      />
    </div>
  );
}
