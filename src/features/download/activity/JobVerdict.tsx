import { useTranslation } from "react-i18next";

import { type JobOutcome, OUTCOME_TONE } from "@/features/download/activity/outcome";
import { Verdict } from "@/shared/ui/Verdict";

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
 * A finished job in one word.
 *
 * The dot, its tones and the quiet treatment of success are the app's shared
 * `Verdict` — the import closes the same way. What belongs here is only which
 * word a given outcome earns.
 */
export function JobVerdict({ outcome, source }: { outcome: JobOutcome; source?: string | null }) {
  const { t } = useTranslation("download");
  const { key, values } = phrase(outcome);

  return (
    // Which database answered is detail, not headline: it belongs on hover.
    <Verdict tone={OUTCOME_TONE[outcome.kind]} title={source ?? undefined}>
      {t(key, values)}
    </Verdict>
  );
}
