import { Button, toast } from "@heroui/react";
import { useTranslation } from "react-i18next";

import { revealLogFile } from "@/features/settings/api";
import { SettingRow } from "@/features/settings/SettingsPanel";
import { isMacOS } from "@/shared/lib/platform";

/** Reveals the log file in the OS file manager, ready to attach to a report. */
export function LogFileRow() {
  const { t } = useTranslation("settings");

  const reveal = async () => {
    try {
      await revealLogFile();
    } catch (error) {
      toast.danger(t("advanced.logs.failed"), { description: String(error) });
    }
  };

  return (
    <SettingRow settingKey="advanced.logs">
      <Button variant="secondary" onPress={() => void reveal()}>
        {isMacOS ? t("advanced.logs.actionMac") : t("advanced.logs.actionWindows")}
      </Button>
    </SettingRow>
  );
}
