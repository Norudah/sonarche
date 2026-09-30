import { Switch } from "@heroui/react";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { storeRematchConfirm } from "@/shared/lib/rematchConfirm";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

/** Confirms a re-match (it rewrites tags). "Don't ask again" is the Settings
 * preference and only applies when confirming. */
export function RematchConfirmDialog({
  scope,
  isOpen,
  onClose,
  onConfirm,
}: {
  scope: "track" | "album";
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation("library");
  const [skipNext, setSkipNext] = useState(false);

  // Each opening starts with the switch off.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setSkipNext(false);
  }

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      status="warning"
      icon={Sparkles}
      title={t("albumMetadata.rematch.confirmTitle")}
      cancelLabel={t("metadata.cancel")}
      confirmLabel={t("albums.rematch")}
      onConfirm={() => {
        if (skipNext) storeRematchConfirm(false);
        onConfirm();
      }}
    >
      <p>
        {t(scope === "album" ? "albumMetadata.rematch.confirmBodyAlbum" : "albumMetadata.rematch.confirmBodyTrack")}
      </p>
      <div className="mt-3 flex flex-col gap-1">
        <Switch isSelected={skipNext} onChange={setSkipNext} className="w-full">
          <Switch.Content className="w-full flex-row-reverse justify-between">
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <span className="text-[0.8125rem] font-medium text-foreground">
              {t("albumMetadata.rematch.confirmSkip")}
            </span>
          </Switch.Content>
        </Switch>
        <p className="text-[0.75rem] leading-relaxed text-muted/90">{t("albumMetadata.rematch.confirmSkipWhere")}</p>
      </div>
    </ConfirmDialog>
  );
}
