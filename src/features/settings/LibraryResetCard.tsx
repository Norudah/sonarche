import { Button } from "@heroui/react";
import { Loader2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { SettingCard, SettingCardHeader } from "@/features/settings/SettingCard";
import { useResetLibraryDev } from "@/features/settings/hooks";

/**
 * The destructive one: it deletes the audio files, not just the index.
 *
 * Asks for a second click instead of a dialog — it's a developer tool, friction
 * should stay minimal, but a stray click must not wipe the library. Its
 * neighbour (`SetupResetCard`) touches none of this, which is exactly why the
 * two are separate cards in opposite registers rather than one control.
 *
 * The armed warning is the danger pane's own warning band rather than HeroUI's
 * `Alert`, which arrived at 14px with its own padding and made the card twice
 * the height of the one above it the moment you clicked.
 */
export function LibraryResetCard() {
  const { t } = useTranslation("settings");
  const reset = useResetLibraryDev();
  const [armed, setArmed] = useState(false);

  const onPress = () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    reset.mutate();
  };

  return (
    <SettingCard settingKey="developer.resetLibrary">
      <div className="flex flex-col gap-3">
        <SettingCardHeader title={t("developer.resetLibrary.name")} description={t("developer.resetLibrary.why")} />

        <div className="flex items-center gap-3">
          <Button variant={armed ? "danger" : "danger-soft"} isDisabled={reset.isPending} onPress={onPress}>
            {reset.isPending && <Loader2 className="size-4 animate-spin" />}
            {reset.isPending
              ? t("developer.resetLibrary.resetting")
              : armed
                ? t("developer.resetLibrary.confirm")
                : t("developer.resetLibrary.action")}
          </Button>
          {reset.isSuccess && <p className="text-[0.8125rem] text-success">{t("developer.resetLibrary.done")}</p>}
          {reset.isError && <p className="text-[0.8125rem] text-danger">{String(reset.error)}</p>}
        </div>

        {armed && !reset.isPending && (
          <div className="flex items-start gap-2.5 rounded-lg border border-danger/25 bg-danger/8 p-3 text-[0.8125rem] leading-relaxed">
            <TriangleAlert className="mt-px size-4 shrink-0 text-danger" />
            <p>{t("developer.resetLibrary.warning")}</p>
          </div>
        )}
      </div>
    </SettingCard>
  );
}
