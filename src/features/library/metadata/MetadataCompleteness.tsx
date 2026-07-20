import { useTranslation } from "react-i18next";

import { COMPLETENESS_KEYS } from "@/features/library/metadata/fields";

/** Segmented meter: one dash per tracked field, filled left to right. Amber
 * while fields are missing (the reserved "incomplete metadata" hue), green once
 * the record is whole. */
export function MetadataCompleteness({ filled }: { filled: number }) {
  const { t } = useTranslation("library");
  const total = COMPLETENESS_KEYS.length;
  const isComplete = filled === total;

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-[0.75rem] font-bold tracking-[0.12em] text-muted/70 uppercase">
        {t("metadata.completeness", { filled, total })}
      </p>
      <div className="flex shrink-0 gap-1.5">
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={
              "h-1.5 w-5 rounded-full " + (index < filled ? (isComplete ? "bg-success" : "bg-warning") : "bg-default")
            }
          />
        ))}
      </div>
    </div>
  );
}
