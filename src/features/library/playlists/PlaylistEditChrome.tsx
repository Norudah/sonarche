import { useTranslation } from "react-i18next";

import { CloseButton } from "@/shared/ui/CloseButton";

/** Header shared by the edit form and the image pane beside it: the same
 * anatomy as `Dialog.Header`, kept apart because the two panes each carry one. */
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
    <header className="flex shrink-0 items-start gap-3 px-6 pt-5 pb-4">
      <div className="min-w-0 flex-1">
        <h2 className="text-[1.0625rem] leading-snug font-semibold tracking-tight text-balance text-foreground">
          {title}
        </h2>
        <p className="mt-0.5 truncate text-xs text-muted">{subtitle}</p>
      </div>
      <CloseButton label={t("metadata.close")} onPress={onClose} className="-mt-0.5 -mr-1.5" />
    </header>
  );
}

export const EDIT_DIALOG_BODY = "flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pb-5";

export const EDIT_DIALOG_FOOTER = "flex shrink-0 items-center gap-2 border-t border-separator px-6 py-4";
