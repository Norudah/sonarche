import { Alert, Button } from "@heroui/react";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

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
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-lg font-semibold">{t("developer.title")}</h2>
        <p className="mt-1 max-w-prose text-sm text-muted">{t("developer.description")}</p>
      </div>

      <div className="flex max-w-lg flex-col gap-3">
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
    </div>
  );
}
