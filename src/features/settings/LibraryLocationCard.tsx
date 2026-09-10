import { Button, Spinner, toast } from "@heroui/react";
import { open } from "@tauri-apps/plugin-dialog";
import { Folder } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SettingCard, SettingCardHeader } from "@/features/settings/SettingCard";
import { useSettingsTasks } from "@/features/settings/tasks";
import { useCheckLibraryMove, useLibraryLocation } from "@/features/settings/hooks";

/**
 * Where the music lives, and the way to move it.
 *
 * The picker asks for a *parent* and the app appends its own folder name —
 * see `library_move.rs` for why. The card says so, because "choose a folder"
 * and "choose where the Sonarche folder goes" are different instructions and
 * only one of them matches what happens.
 */
export function LibraryLocationCard() {
  const { t } = useTranslation("settings");
  const location = useLibraryLocation();
  const preflight = useCheckLibraryMove();
  const { start } = useSettingsTasks();

  // The picker and the preflight belong here — both happen while settings is
  // open, and both are cheap. The move itself ends in a relaunch, so it is
  // handed to `SettingsTaskHost` along with what the preflight found.
  const pick = async () => {
    const chosen = await open({ directory: true, multiple: false });
    if (typeof chosen !== "string") return;
    try {
      start({ kind: "move", parent: chosen, check: await preflight.mutateAsync(chosen) });
    } catch (error) {
      toast.danger(t("files.move.failedTitle"), { description: String(error) });
    }
  };

  return (
    <SettingCard settingKey="files.location">
      <div className="flex flex-col gap-3">
        <SettingCardHeader title={t("files.location.name")} description={t("files.location.why")} />

        {location.isPending ? (
          <Spinner size="sm" aria-label={t("loading")} />
        ) : (
          <div className="flex items-center gap-2.5 rounded-lg border border-separator bg-default/40 px-3 py-2">
            <Folder className="size-3.5 shrink-0 text-muted" />
            <p className="min-w-0 flex-1 truncate font-mono text-[0.75rem]" title={location.data?.path}>
              {location.data?.path}
            </p>
            {location.data?.isDefault && (
              <span className="shrink-0 text-[0.6875rem] text-muted">{t("files.location.isDefault")}</span>
            )}
          </div>
        )}

        <Button variant="secondary" className="self-start" onPress={() => void pick()} isDisabled={preflight.isPending}>
          {t("files.location.action")}
        </Button>
      </div>
    </SettingCard>
  );
}
