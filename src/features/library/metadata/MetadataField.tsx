import { type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";

// One persistent <input> per field, readOnly outside edit mode — not a <div>
// swapped for an <input> — so the fill and border can cross-fade between the
// grey "disabled" look and the white editable one when the mode flips, instead
// of snapping. Hand-rolled rather than HeroUI's Input, whose border resolves to
// zero width and vanishes on our near-white panel (same reason SearchField is).
//
// The two looks are inverted so editability reads at a glance: a value you can't
// edit sits in a flat grey box, one you can in a white box with a real border
// that lights to accent on focus. In edit mode the always-read fields (album
// artist, derived genre) stay grey, receding next to the live white inputs.
const FIELD_BOX = "w-full rounded-xl border px-3 py-2 text-[0.875rem] outline-none transition-colors duration-300";

export function MetadataField({
  label,
  value,
  isEditing,
  onChange,
  hint,
  action,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  isEditing: boolean;
  onChange: (value: string) => void;
  /** Muted qualifier appended to the label, e.g. "derived". */
  hint?: string;
  /** Trailing control (e.g. a "view album" link) shown beside the read value. */
  action?: ReactNode;
  /** Ghost text for an empty editable field — e.g. "multiple values" when an
   * album's tracks disagree on this tag. Only shown while editing. */
  placeholder?: string;
  className?: string;
}) {
  const { t } = useTranslation("library");
  const id = useId();
  const isEmpty = value.trim() === "";
  const wrap = "flex flex-col gap-1" + (className ? ` ${className}` : "");

  const state = isEditing
    ? "border-separator bg-surface text-foreground focus:border-accent focus:ring-2 focus:ring-accent/25"
    : "cursor-default border-transparent bg-default " + (isEmpty ? "text-muted/50" : "text-foreground");

  return (
    <div className={wrap}>
      {/* One line, always: a label long enough to wrap (a hinted field in a
          two-column row) used to push its own input down and break the
          alignment with the field beside it. Truncating keeps the two inputs
          on the same baseline whatever the language does to the wording. */}
      <label
        htmlFor={id}
        title={hint ? `${label} · ${hint}` : label}
        className="truncate text-[0.75rem] font-medium whitespace-nowrap text-muted"
      >
        {label}
        {hint && <span className="ml-1.5 font-normal opacity-70">· {hint}</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          readOnly={!isEditing}
          placeholder={isEditing ? placeholder : undefined}
          value={isEditing ? value : isEmpty ? t("metadata.emptyValue") : value}
          onChange={(event) => onChange(event.target.value)}
          className={`${FIELD_BOX} ${state} placeholder:text-muted/50${action && !isEditing ? " pr-24" : ""}`}
        />
        {action && !isEditing && <div className="absolute inset-y-0 right-3 flex items-center">{action}</div>}
      </div>
    </div>
  );
}
