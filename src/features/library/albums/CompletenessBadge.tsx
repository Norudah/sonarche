import { useTranslation } from "react-i18next";

/**
 * The share of the album's metadata that is actually filled in — Sonarche's own
 * signal, and the one thing a streaming service could never show you.
 *
 * Only rendered below 100%: a wall of covers each stamped "100%" would be pure
 * noise, and the badge has to mean "this one needs you". Amber is the app's
 * reserved "incomplete metadata" hue (same as the empty genre in the track
 * table), so it reads as a nudge rather than as an error.
 */
export function CompletenessBadge({ value }: { value: number }) {
  const { t } = useTranslation("library");
  if (value >= 1) return null;

  // Floor, not round: 99.6% must not display as a complete "100%".
  const percent = Math.floor(value * 100);

  return (
    <span
      title={t("albums.completenessHint")}
      className="pointer-events-none absolute top-2 right-2 rounded-md bg-warning-soft px-1.5 py-0.5 text-[0.6875rem] font-semibold text-warning tabular-nums shadow-sm"
    >
      {t("albums.completeness", { percent })}
    </span>
  );
}
