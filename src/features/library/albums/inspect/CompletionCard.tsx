import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { AlbumCompletion } from "@/features/library/albums/albumCompletion";
import type { TrackFilter } from "@/features/library/albums/inspect/trackFilter";
import { FieldHelp } from "@/shared/ui/FieldHelp";

const SIZE = 52;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The record's completion — and the way into what is missing.
 *
 * The ring carries the ratio itself rather than a percentage: "24/29" is the
 * same fact the sentence beside it states, where "85 %" was a second metric
 * nobody could check against it. The arc still does the proportion, which is all
 * a percentage was ever good for here.
 *
 * Every gap is a button. A figure you can only look at has no place in this app.
 */
export function CompletionCard({
  completion,
  filter,
  onFilter,
}: {
  completion: AlbumCompletion;
  filter: TrackFilter | null;
  onFilter: (filter: TrackFilter | null) => void;
}) {
  const { t } = useTranslation("library");
  const { complete, total, gaps, filled, incompleteIds } = completion;
  const isComplete = total > 0 && complete === total;
  const ratio = total === 0 ? 1 : complete / total;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3.5">
        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90" aria-hidden>
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE}
              className="stroke-default"
            />
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - ratio)}
              className={isComplete ? "stroke-success" : "stroke-warning"}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className={`text-[0.6875rem] leading-none font-bold tabular-nums ${isComplete ? "text-success" : "text-warning"}`}
            >
              {complete}/{total}
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <p className="text-[0.8125rem] font-semibold text-foreground">
              {isComplete
                ? t("albumMetadata.completion.allComplete", { count: total })
                : t("albumMetadata.completion.heading", { count: complete, total })}
            </p>
            <FieldHelp
              label={t("metadata.help.open", {
                field: t("albumMetadata.completion.heading", { count: complete, total }),
              })}
              text={t("metadata.help.completion")}
            />
          </div>
          {incompleteIds.length > 0 && (
            <button
              type="button"
              onClick={() =>
                onFilter(
                  filter?.id === "incomplete"
                    ? null
                    : {
                        id: "incomplete",
                        label: t("albumMetadata.completion.showIncomplete", { count: incompleteIds.length }),
                        trackIds: incompleteIds,
                      },
                )
              }
              className="group flex w-fit cursor-pointer items-center gap-1 rounded-md text-left text-[0.75rem] font-medium text-accent outline-none transition-colors hover:text-accent/80 focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              {t("albumMetadata.completion.showIncomplete", { count: incompleteIds.length })}
              <ArrowRight className="size-3 transition-transform duration-200 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none" />
            </button>
          )}
        </div>
      </div>

      {gaps.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {gaps.map((gap) => {
            const label = t("albumMetadata.completion.gap", {
              field: t(`metadata.fields.${gap.field}`),
              count: gap.missing,
            });
            const isOn = filter?.id === gap.field;
            return (
              <button
                key={gap.field}
                type="button"
                onClick={() => onFilter(isOn ? null : { id: gap.field, label, trackIds: gap.trackIds })}
                className={`cursor-pointer rounded-full border px-2.5 py-1 text-[0.75rem] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 ${
                  isOn
                    ? "border-warning bg-warning text-warning-foreground"
                    : "border-warning/35 bg-warning-soft text-warning hover:border-warning/60"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {filled.length > 0 && !isComplete && (
        <p className="text-[0.75rem] leading-snug text-muted/80">
          {t("albumMetadata.completion.filled", {
            fields: filled.map((field) => t(`metadata.fields.${field}`)).join(", "),
          })}
        </p>
      )}
    </section>
  );
}
