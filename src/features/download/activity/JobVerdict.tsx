import { useTranslation } from "react-i18next";

import { type JobOutcome, OUTCOME_TONE, type OutcomeTone } from "@/features/download/activity/outcome";

const DOT: Record<OutcomeTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

const TEXT: Record<OutcomeTone, string> = {
  success: "text-muted",
  warning: "text-warning",
  danger: "text-danger",
};

/** The i18n key and its interpolation, per verdict. */
function phrase(outcome: JobOutcome): { key: string; values?: Record<string, number> } {
  switch (outcome.kind) {
    case "matched":
      return { key: "activity.verdict.matched" };
    case "partialMatch":
      return { key: "activity.verdict.partialMatch", values: { matched: outcome.matched, total: outcome.total } };
    case "guessed":
      return { key: "activity.verdict.guessed" };
    case "unmatched":
      return { key: "activity.verdict.unmatched" };
    case "lostTracks":
      return { key: "activity.verdict.lostTracks", values: { kept: outcome.kept, total: outcome.total } };
    case "failed":
      return { key: "activity.verdict.failed" };
  }
}

/**
 * A finished job in one word, with a tone dot.
 *
 * A dot and a label rather than a filled chip: the feed shows several of these
 * at once, and the album tracklist already reads its own completeness this way.
 * Success is the quiet case — muted text next to a green dot — because a shelf
 * of green badges makes the one amber row harder to find, not easier.
 */
export function JobVerdict({ outcome, source }: { outcome: JobOutcome; source?: string | null }) {
  const { t } = useTranslation("download");
  const tone = OUTCOME_TONE[outcome.kind];
  const { key, values } = phrase(outcome);

  return (
    <span
      className={`flex shrink-0 items-center gap-1.5 text-[0.8125rem] whitespace-nowrap tabular-nums ${TEXT[tone]}`}
      // Which database answered is detail, not headline: it belongs on hover.
      title={source ?? undefined}
    >
      <span className={`size-1.5 shrink-0 rounded-full ${DOT[tone]}`} />
      {t(key, values)}
    </span>
  );
}
