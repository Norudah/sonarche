import { Button, toast } from "@heroui/react";
import { FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

import { revealLogFile } from "@/features/settings/api";
import { SettingRow } from "@/features/settings/SettingsPanel";
import { isMacOS } from "@/shared/lib/platform";

/**
 * The diagnostic log, and the one way to reach it without spelunking.
 *
 * A user asked for their log is a user mid-bug-report: "it's under
 * AppData/…/logs" is exactly the kind of instruction that dies in transit.
 * The button reveals the file itself in the OS file manager, selected and
 * ready to drag into a message.
 */
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
    <SettingRow name={t("advanced.logs.name")} why={t("advanced.logs.why")}>
      <Button variant="secondary" onPress={() => void reveal()}>
        <FolderOpen className="size-4" />
        {isMacOS ? t("advanced.logs.actionMac") : t("advanced.logs.actionWindows")}
      </Button>
    </SettingRow>
  );
}
