import { Undo2 } from "lucide-react";
import { type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";

import { SuggestInput } from "@/features/library/metadata/SuggestInput";
import type { SuggestKind } from "@/features/library/metadata/suggestions";

/** A labelled metadata field. An edited field gets an accent rule, shows its
 * previous value and offers a revert. A mixed field (tracks disagree) is
 * dashed and writes nothing unless changed. */
export function EditableField({
  label,
  value,
  origin,
  help,
  hint,
  mixedCount,
  isMissing,
  suggest,
  onChange,
  onRevert,
  className,
}: {
  label: string;
  value: string;
  /** The value before the edit, when it moved. */
  origin?: string;
  /** A `FieldHelp` or its popover. */
  help?: ReactNode;
  /** Muted qualifier after the label. */
  hint?: string;
  /** Distinct values when the tracks disagree. */
  mixedCount?: number;
  /** Counted by completion and empty: shown in amber. */
  isMissing?: boolean;
  /** Suggests existing library values, where exact spelling matters. */
  suggest?: SuggestKind;
  onChange: (value: string) => void;
  onRevert?: () => void;
  className?: string;
}) {
  const { t } = useTranslation("library");
  const id = useId();
  const isModified = origin != null;
  const isMixed = mixedCount != null && value.trim() === "";
  const showMissing = isMissing && value.trim() === "" && !isMixed;

  return (
    <div className={"flex min-w-0 flex-col gap-1" + (className ? ` ${className}` : "")}>
      <div className="flex min-w-0 items-center gap-1.5">
        <label htmlFor={id} className="truncate text-[0.75rem] font-medium whitespace-nowrap text-muted">
          {label}
          {hint && <span className="ml-1.5 font-normal opacity-70">· {hint}</span>}
        </label>
        {help}
        {/* The revert is the "modified" mark, on the label line so the input never resizes. */}
        {isModified && onRevert && (
          <button
            type="button"
            onClick={onRevert}
            title={t("albumMetadata.changes.revert", { value: origin || t("metadata.emptyValue") })}
            className="ml-auto flex min-w-0 max-w-36 shrink cursor-pointer items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[0.6875rem] text-accent outline-none transition-colors hover:brightness-95 focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <Undo2 className="size-3 shrink-0" />
            <span className="truncate">{origin || t("metadata.emptyValue")}</span>
          </button>
        )}
      </div>

      <SuggestInput
        id={id}
        value={value}
        suggest={suggest}
        onChange={onChange}
        placeholder={
          isMixed
            ? t("albumMetadata.mixed.value", { count: mixedCount })
            : showMissing
              ? t("albumMetadata.tracks.missing")
              : undefined
        }
        // Constant border width, so the text doesn't shift when modified.
        className={`w-full rounded-xl border border-l-[3px] px-3 py-2 text-[0.875rem] text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/25 ${
          isMixed
            ? "border-dashed border-muted/35 bg-surface placeholder:text-muted/60"
            : showMissing
              ? "border-dashed border-warning/45 bg-warning-soft placeholder:text-warning"
              : "border-separator bg-surface"
        } ${isModified ? "border-l-accent!" : ""}`}
      />
    </div>
  );
}
