import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { COMPLETENESS_KEYS, type FieldValues } from "@/features/library/metadata/fields";

/**
 * What this track is still missing, named.
 *
 * The old row was seven dots: it said "6 of 7" and left the user to hunt for
 * which one. A field you can name is a field you can go fill in — same doctrine
 * as the album panel's completion, and as the Metadata page before it.
 */
export function MetadataCompleteness({
  values,
  onOpenAlbum,
}: {
  values: FieldValues;
  /** Absent for a track filed under no album. */
  onOpenAlbum?: () => void;
}) {
  const { t } = useTranslation("library");
  const missing = COMPLETENESS_KEYS.filter((key) => values[key].trim() === "");
  const filled = COMPLETENESS_KEYS.length - missing.length;
  const isComplete = missing.length === 0;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-separator px-3.5 py-2.5">
      <span className={`size-2 shrink-0 rounded-full ${isComplete ? "bg-success" : "bg-warning"}`} aria-hidden />
      <p className="min-w-0 text-[0.8125rem] leading-snug">
        <span className="font-semibold text-foreground">
          {t("metadata.completeness", { filled, total: COMPLETENESS_KEYS.length })}
        </span>
        {!isComplete && (
          <span className="text-muted">
            {" — "}
            {t("metadata.missingFields", {
              fields: missing.map((key) => t(`metadata.fields.${key}`)).join(", "),
              count: missing.length,
            })}
          </span>
        )}
      </p>
      {onOpenAlbum && (
        <button
          type="button"
          onClick={onOpenAlbum}
          className="group ml-auto flex shrink-0 cursor-pointer items-center gap-1 rounded-md text-[0.75rem] font-medium text-accent outline-none transition-colors hover:text-accent/80 focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          {t("metadata.viewAlbum")}
          <ArrowRight className="size-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </button>
      )}
    </div>
  );
}
