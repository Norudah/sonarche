import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * The chrome the edit session's two windows share — the form and the image
 * picker stacked over it. One header, one footer bar, so the upper window
 * reads as the same session rather than as somewhere else.
 */
export function EditDialogHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
}) {
  const { t } = useTranslation("library");

  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-separator px-6 py-4">
      <div className="min-w-0 flex-1">
        <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-0.5 truncate text-[0.75rem] text-muted">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={t("metadata.close")}
        className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-default/60 text-muted outline-none transition-colors hover:bg-default hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <X className="size-3.5" />
      </button>
    </header>
  );
}

export const EDIT_DIALOG_BODY = "flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5";

export const EDIT_DIALOG_FOOTER = "flex shrink-0 items-center gap-2 border-t border-separator px-6 py-3.5";

export const EDIT_DIALOG_QUIET_BUTTON =
  "cursor-pointer rounded-full px-3.5 py-1.5 text-[0.8125rem] font-medium text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-default disabled:opacity-45";

export const EDIT_DIALOG_CONFIRM_BUTTON =
  "flex cursor-pointer items-center gap-2 rounded-xl bg-accent px-4 py-1.5 text-[0.8125rem] font-medium text-accent-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-default disabled:opacity-45";
