import { Spinner } from "@heroui/react";
import { Crop } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Reframe the image that is already worn.
 *
 * Every other road into these modals brings a *new* file — the picker, a drop,
 * a link, the clipboard, an archive upload. This one brings the image back:
 * a cover whose subject sits too small, a disc cropped a hair off centre had
 * to be found again on disk and re-imported to be nudged, when the app was
 * holding it all along.
 *
 * It ends where a pick would: the image lands in the stage on the right as the
 * chosen source, framed whole, and nothing is written until the modal's own
 * confirm. `source` resolves the file — for a cover that means asking the
 * backend for the full-size archive rather than the 500px rendition.
 */
export function RecropButton({
  source,
  onAdopt,
  onFailed,
  disabled = false,
}: {
  /** The file to reopen, resolved when pressed. */
  source: () => Promise<string>;
  /** Take it as the replacement's source, exactly like a picked file. */
  onAdopt: (path: string) => Promise<void>;
  /** The file is gone or unreadable — the modal owns the message line. */
  onFailed: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation("library");
  const [isLoading, setIsLoading] = useState(false);

  const adopt = async () => {
    setIsLoading(true);
    try {
      await onAdopt(await source());
    } catch {
      onFailed();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      disabled={disabled || isLoading}
      onClick={() => void adopt()}
      className="flex cursor-pointer items-center gap-1.5 self-start rounded-full border border-separator px-3 py-1 text-[0.75rem] font-medium text-foreground outline-none transition-colors hover:bg-default/60 focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-default disabled:opacity-45"
    >
      {isLoading ? <Spinner size="sm" /> : <Crop className="size-3.5 text-muted" />}
      {t("imageSource.recrop")}
    </button>
  );
}
