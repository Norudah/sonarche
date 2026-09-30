import { Spinner } from "@heroui/react";
import { Crop } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

/** Reopens the current image in the crop stage as the new source. Nothing is
 * written until confirm. `source` resolves the file (for a cover, admitting
 * its artpath to the asset scope). */
export function RecropButton({
  source,
  onAdopt,
  onFailed,
  disabled = false,
}: {
  /** Resolved on press. */
  source: () => Promise<string>;
  /** Adopted like a picked file. */
  onAdopt: (path: string) => Promise<void>;
  /** The file is gone or unreadable. */
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
