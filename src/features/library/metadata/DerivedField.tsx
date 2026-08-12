import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

/**
 * A field the app computes and never writes — the genre family. Same label row
 * and box metrics as `EditableField`, so it reads as part of the form rather
 * than a footnote, but flat, grey and inert: visibly a consequence of the
 * genre, not a tag left unfilled.
 */
export function DerivedField({
  label,
  value,
  help,
  className,
}: {
  label: string;
  value: string;
  /** Help affordance rendered beside the label — a `FieldHelp`. */
  help?: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation("library");

  return (
    <div className={"flex min-w-0 flex-col gap-1" + (className ? ` ${className}` : "")}>
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-[0.75rem] font-medium whitespace-nowrap text-muted">
          {label}
          <span className="ml-1.5 font-normal opacity-70">· {t("metadata.derived")}</span>
        </span>
        {help}
      </div>
      {/* Same border widths as the editable input, transparent, so the two box
          heights line up; the flat default wash is what says "not yours to type in". */}
      <p className="w-full rounded-xl border border-l-[3px] border-transparent bg-default px-3 py-2 text-[0.875rem] text-muted">
        {value || t("metadata.emptyValue")}
      </p>
    </div>
  );
}
