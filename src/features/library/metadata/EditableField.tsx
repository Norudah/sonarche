import { Undo2 } from "lucide-react";
import { type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";

import { SuggestInput } from "@/features/library/metadata/SuggestInput";
import type { SuggestKind } from "@/features/library/metadata/suggestions";

/**
 * A labelled field in a metadata panel — the album modal's identity column, and
 * the track drawer.
 *
 * The panel no longer has a read mode, so the old grey/white pair — which said
 * "can you type here" — has nothing left to convey. What matters now is *what
 * you changed*: an edited field grows an accent rule down its left edge, states
 * the value it left, and offers to go back in one press.
 *
 * A field the tracks disagree on is drawn with a dashed border and says how many
 * values are in play. Left alone it writes nothing, so inspecting a half-tagged
 * record can never flatten it.
 */
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
  /** The value this field held before the edit, when it has moved. */
  origin?: string;
  /** Help affordance rendered beside the label — a `FieldHelp` or its popover. */
  help?: ReactNode;
  /** Muted qualifier appended to the label, e.g. "doesn't count toward completion". */
  hint?: string;
  /** How many distinct values the tracks carry, when they disagree. */
  mixedCount?: number;
  /** Counted by completion and still empty — worth pointing at, in the same
   * amber the tag dots and the completion ring use. */
  isMissing?: boolean;
  /** Pool to suggest from while typing — for the values the library already
   * knows (artists, albums, genres), where exact spelling is identity. */
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
        {/* The revert *is* the "modified" mark — one element, on the label's
            line, where nothing it does can resize the input. The badge and the
            in-field button it replaces used to appear together the moment a key
            was pressed, shrinking the field under the cursor. */}
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
        // Border width is on every state, modified or not: switching it on
        // alone would nudge the text sideways as you type.
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
