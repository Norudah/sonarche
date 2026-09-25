import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

/** A computed, read-only field (the genre family), with `EditableField`'s
 * metrics but a flat, inert look. */
export function DerivedField({
  label,
  value,
  help,
  className,
}: {
  label: string;
  value: string;
  /** A `FieldHelp` beside the label. */
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
      {/* Same border widths as the input (transparent), so heights match. */}
      <p className="w-full rounded-xl border border-l-[3px] border-transparent bg-default px-3 py-2 text-[0.875rem] text-muted">
        {value || t("metadata.emptyValue")}
      </p>
    </div>
  );
}
