import { Button, toast } from "@heroui/react";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { SettingRow } from "@/features/settings/SettingsPanel";
import { useReinstallEnvironment } from "@/features/settings/hooks";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

/** Removes the Python environment for a rebuild at next launch. No user data
 * is lost, so a plain confirmation (not the danger zone's typed phrase). */
export function ReinstallRow() {
  const { t } = useTranslation("settings");
  const [asking, setAsking] = useState(false);
  const reinstall = useReinstallEnvironment();

  const run = async () => {
    try {
      await reinstall.mutateAsync();
      // A webview reload: the front reboots through the environment check.
      window.location.reload();
    } catch (error) {
      setAsking(false);
      toast.danger(t("advanced.reinstall.failedTitle"), { description: String(error) });
    }
  };

  return (
    <SettingRow settingKey="advanced.reinstall">
      <Button variant="secondary" onPress={() => setAsking(true)} isDisabled={reinstall.isPending}>
        {t("advanced.reinstall.action")}
      </Button>

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
    </SettingRow>
  );
}
