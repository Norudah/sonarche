import { Alert, Button } from "@heroui/react";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { SettingCard } from "@/features/settings/SettingCard";
import { useResetLibraryDev } from "@/features/settings/hooks";

/**
 * The destructive one: it deletes the audio files, not just the index.
 *
 * Asks for a second click instead of a dialog — it's a developer tool, friction
 * should stay minimal, but a stray click must not wipe the library. Its
 * neighbour (`SetupResetCard`) touches none of this, which is exactly why the
 * two are separate cards in opposite registers rather than one control.
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
    <SettingCard>
      <div className="flex flex-col gap-3">
        <h3 className="font-medium">{t("developer.resetLibrary.name")}</h3>
        <p className="max-w-prose text-sm text-muted">{t("developer.resetLibrary.why")}</p>
        <Button
          variant={armed ? "danger" : "secondary"}
          className="self-start"
          isDisabled={reset.isPending}
          onPress={onPress}
        >
          {reset.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t("developer.resetLibrary.resetting")}
            </>
          ) : (
            <>
              <Trash2 className="size-4" />
              {armed ? t("developer.resetLibrary.confirm") : t("developer.resetLibrary.action")}
            </>
          )}
        </Button>
        {armed && !reset.isPending && (
          <Alert status="warning">
            <Alert.Content>
              <Alert.Description>{t("developer.resetLibrary.warning")}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}
        {reset.isSuccess && <p className="text-sm text-success">{t("developer.resetLibrary.done")}</p>}
        {reset.isError && <p className="text-sm text-danger">{String(reset.error)}</p>}
      </div>
    </SettingCard>
  );
}
