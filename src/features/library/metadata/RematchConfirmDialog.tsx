import { Switch } from "@heroui/react";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { storeRematchConfirm } from "@/shared/lib/rematchConfirm";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

/**
 * The confirmation that stands between the re-match button and the rewrite.
 *
 * Re-match is the one button in the editors that changes tags the user did not
 * type — asking first is the default. The dialog carries its own way to stop
 * asking ("don't ask again"), which is the same preference the settings page
 * edits; the switch only commits with the confirmation, so backing out of the
 * dialog never silences future ones.
 */
export function RematchConfirmDialog({
  scope,
  isOpen,
  onClose,
  onConfirm,
}: {
  /** Which sentence the body says — one track, or every track of the album. */
  scope: "track" | "album";
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation("library");
  const [skipNext, setSkipNext] = useState(false);

  // A fresh opening starts with the switch off: "don't ask again" is a choice
  // about this confirmation, not a sticky draft across dialogs.
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
