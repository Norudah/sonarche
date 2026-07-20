import { Input, Label, TextField } from "@heroui/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export function MetadataField({
  label,
  value,
  isEditing,
  onChange,
  hint,
  action,
  className,
}: {
  label: string;
  value: string;
  isEditing: boolean;
  onChange: (value: string) => void;
  /** Muted qualifier appended to the label, e.g. "derived". */
  hint?: string;
  /** Trailing control pinned inside the field box (link, button). */
  action?: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation("library");

  return (
    <TextField
      value={isEditing ? value : value || t("metadata.emptyValue")}
      onChange={onChange}
      isReadOnly={!isEditing}
      className={"flex flex-col" + (className ? ` ${className}` : "")}
    >
      <Label className="text-[0.8125rem] font-medium text-muted">
        {label}
        {hint && <span className="ml-1.5 font-normal opacity-70">· {hint}</span>}
      </Label>
      <div className="relative mt-0.5">
        {/* `secondary` is HeroUI's flat filled field: no border, no shadow — the
            calm gray box the panel is designed around. `--input-bg`/`-hover` are
            what that variant reads its background from; the shared `--default`/
            `--default-hover` tokens it defaults to are too dark for this panel
            (and the hover step, mixed from a different base than our override,
            landed as an abrupt jump), so both are overridden locally to two
            steps of the same background scale rather than for every `secondary`
            input app-wide. */}
        <Input
          variant="secondary"
          className={
            "w-full rounded-xl px-3 py-[0.4375rem] text-[0.8125rem] [--input-bg-hover:var(--color-background-tertiary)] [--input-bg:var(--color-background-secondary)] sm:text-[0.8125rem]" +
            (action ? " pr-28" : "")
          }
        />
        {action && <div className="absolute inset-y-0 right-3 flex items-center">{action}</div>}
      </div>
    </TextField>
  );
}
