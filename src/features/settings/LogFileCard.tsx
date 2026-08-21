import { Button, toast } from "@heroui/react";
import { useTranslation } from "react-i18next";

import { revealLogFile } from "@/features/settings/api";
import { SettingCard } from "@/features/settings/SettingCard";
import { isMacOS } from "@/shared/lib/platform";

/**
 * The diagnostic log, and the one way to reach it without spelunking.
 *
 * A user asked for their log is a user mid-bug-report: "it's under
 * AppData/…/logs" is exactly the kind of instruction that dies in transit.
 * The button reveals the file itself in the OS file manager, selected and
 * ready to drag into a message.
 */
export function LogFileCard() {
  const { t } = useTranslation("settings");

  const reveal = async () => {
    try {
      await revealLogFile();
    } catch (error) {
      toast.danger(t("library.logs.failed"), { description: String(error) });
    }
  };

  return (
    <SettingCard>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="font-medium">{t("library.logs.name")}</h3>
          <p className="max-w-prose text-sm text-muted">{t("library.logs.why")}</p>
        </div>
        <Button variant="secondary" className="h-10 self-start rounded-xl" onPress={reveal}>
          {isMacOS ? t("library.logs.actionMac") : t("library.logs.actionWindows")}
        </Button>
      </div>
    </SettingCard>
  );
}
