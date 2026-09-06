import { Button } from "@heroui/react";
import { toast } from "@heroui/react";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { SettingCard } from "@/features/settings/SettingCard";
import { useReinstallEnvironment } from "@/features/settings/hooks";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

/**
 * Throw the Python environment away and let the app rebuild it on the next
 * launch. Drastic, not dangerous — which is exactly why it left the danger
 * zone: nothing it removes is irreplaceable, and a red frame around an action
 * that loses none of your data teaches people that the frame means nothing.
 *
 * A plain yes/no, not the typed phrase the erases ask for. Putting the typing
 * exercise on both is how people learn to type through it.
 */
export function ReinstallCard() {
  const { t } = useTranslation("settings");
  const [asking, setAsking] = useState(false);
  const reinstall = useReinstallEnvironment();

  const run = async () => {
    try {
      await reinstall.mutateAsync();
      // A webview reload, not a process relaunch: the front reboots through
      // the splash and the environment check, which is what rebuilds the venv.
      window.location.reload();
    } catch (error) {
      setAsking(false);
      toast.danger(t("advanced.reinstall.failedTitle"), { description: String(error) });
    }
  };

  return (
    <SettingCard>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-[0.8125rem] font-semibold">{t("advanced.reinstall.name")}</p>
          <p className="text-[0.8125rem] leading-relaxed text-muted">{t("advanced.reinstall.why")}</p>
        </div>
        <Button
          variant="secondary"
          className="h-10 shrink-0 rounded-xl"
          onPress={() => setAsking(true)}
          isDisabled={reinstall.isPending}
        >
          <RotateCcw className="size-4" />
          {t("advanced.reinstall.action")}
        </Button>
      </div>

      <ConfirmDialog
        isOpen={asking}
        onClose={() => setAsking(false)}
        status="warning"
        icon={RotateCcw}
        title={t("advanced.reinstall.dialogTitle")}
        cancelLabel={t("advanced.reinstall.cancel")}
        confirmLabel={t("advanced.reinstall.confirm")}
        onConfirm={() => void run()}
        isPending={reinstall.isPending}
      >
        <p>{t("advanced.reinstall.dialogBody")}</p>
      </ConfirmDialog>
    </SettingCard>
  );
}
