import { Button, Spinner, toast } from "@heroui/react";
import { open } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import { Folder } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { MoveCheck } from "@/features/settings/api";
import { MoveLibraryDialog } from "@/features/settings/MoveLibraryDialog";
import { SettingCard } from "@/features/settings/SettingCard";
import { useCheckLibraryMove, useLibraryLocation, useMoveLibrary } from "@/features/settings/hooks";

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
  const move = useMoveLibrary();
  const [pending, setPending] = useState<{ parent: string; check: MoveCheck } | null>(null);

  const pick = async () => {
    const chosen = await open({ directory: true, multiple: false });
    if (typeof chosen !== "string") return;
    try {
      setPending({ parent: chosen, check: await preflight.mutateAsync(chosen) });
    } catch (error) {
      toast.danger(t("library.move.failedTitle"), { description: String(error) });
    }
  };

  const confirm = async () => {
    if (!pending) return;
    try {
      await move.mutateAsync(pending.parent);
      // A relaunch and not a cache invalidation: playback was stopped, the
      // sidecar was taken down, and every track path the app is holding points
      // at the old folder. Restarting is the only way to be sure none of it
      // survives — and the dialog said it would.
      await relaunch();
    } catch (error) {
      setPending(null);
      toast.danger(t("library.move.failedTitle"), { description: String(error) });
    }
  };

  return (
    <SettingCard>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="font-medium">{t("library.location.name")}</h3>
          <p className="max-w-prose text-sm text-muted">{t("library.location.why")}</p>
        </div>

        {location.isPending ? (
          <Spinner size="sm" aria-label={t("loading")} />
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-separator bg-default/40 px-3.5 py-3">
            <Folder className="size-4 shrink-0 text-muted" />
            <p className="min-w-0 flex-1 truncate font-mono text-[0.8125rem]" title={location.data?.path}>
              {location.data?.path}
            </p>
            {location.data?.isDefault && (
              <span className="shrink-0 text-[0.75rem] text-muted">{t("library.location.isDefault")}</span>
            )}
          </div>
        )}

        <Button
          variant="secondary"
          className="h-10 self-start rounded-xl"
          onPress={pick}
          isDisabled={preflight.isPending || move.isPending}
        >
          {t("library.location.action")}
        </Button>
      </div>

      <MoveLibraryDialog
        check={pending?.check ?? null}
        isMoving={move.isPending}
        onClose={() => setPending(null)}
        onConfirm={confirm}
      />
    </SettingCard>
  );
}
