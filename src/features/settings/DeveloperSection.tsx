import { Alert, Button } from "@heroui/react";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { SettingCard } from "@/features/settings/SettingCard";
import { SettingsHero } from "@/features/settings/SettingsHero";
import { useResetLibraryDev } from "@/features/settings/hooks";

/** Dev-build helpers for testing (the section is only mounted in dev). The
 * reset asks for a second click instead of a dialog: it's a developer tool,
 * friction should stay minimal but a stray click must not wipe the library. */
export function DeveloperSection() {
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
    <>
      <SettingsHero eyebrow={t("title")} title={t("developer.title")} description={t("developer.description")} />

      <SettingCard>
        <div className="flex flex-col gap-3">
          <h3 className="font-medium">{t("developer.resetLibrary.name")}</h3>
          <p className="text-sm text-muted">{t("developer.resetLibrary.why")}</p>
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
    </>
  );
}
