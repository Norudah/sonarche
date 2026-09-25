import { toast } from "@heroui/react";
import { relaunch } from "@tauri-apps/plugin-process";
import { useTranslation } from "react-i18next";

import type { MoveCheck } from "@/features/settings/api";
import { parseAudioFormat } from "@/features/settings/audioFormats";
import { ConvertLibraryDialog } from "@/features/settings/ConvertLibraryDialog";
import { EraseDialog } from "@/features/settings/EraseDialog";
import { ERASES, type EraseKey } from "@/features/settings/erases";
import {
  useConvertLibrary,
  useConvertProgress,
  useEraseAllData,
  useEraseArtistImages,
  useEraseHistory,
  useEraseLibrary,
  useErasePlaylists,
  useMoveLibrary,
  usePreferences,
} from "@/features/settings/hooks";
import { MoveLibraryDialog } from "@/features/settings/MoveLibraryDialog";
import { useSettingsTasks } from "@/features/settings/tasks";

/** Runs long operations started from Settings (conversion, move, erase),
 * mounted beside the dialog so closing it doesn't cancel them. Renders nothing
 * until a task is requested. */
export function SettingsTaskHost() {
  const { task, end } = useSettingsTasks();

  if (task === null) return null;
  if (task.kind === "convert") return <ConvertTask onDone={end} />;
  if (task.kind === "move") return <MoveTask parent={task.parent} check={task.check} onCancel={end} />;
  return <EraseTask eraseKey={task.key} onDone={end} />;
}

function ConvertTask({ onDone }: { onDone: () => void }) {
  const preferences = usePreferences();
  const convert = useConvertLibrary();
  const progress = useConvertProgress(convert.isPending);
  const format = parseAudioFormat(preferences.data?.audioFormat);

  return (
    <ConvertLibraryDialog
      isOpen
      format={format}
      progress={progress}
      report={convert.data ?? null}
      error={convert.isError ? String(convert.error) : null}
      isRunning={convert.isPending}
      onClose={() => {
        convert.reset();
        onDone();
      }}
      onConfirm={() => convert.mutate()}
    />
  );
}

function MoveTask({ parent, check, onCancel }: { parent: string; check: MoveCheck; onCancel: () => void }) {
  const { t } = useTranslation("settings");
  const move = useMoveLibrary();

  const confirm = async () => {
    try {
      await move.mutateAsync(parent);
      // Playback, the sidecar and every held path point at the old folder.
      await relaunch();
    } catch (error) {
      onCancel();
      toast.danger(t("files.move.failedTitle"), { description: String(error) });
    }
  };

  return (
    <MoveLibraryDialog check={check} isMoving={move.isPending} onClose={onCancel} onConfirm={() => void confirm()} />
  );
}

function EraseTask({ eraseKey, onDone }: { eraseKey: EraseKey; onDone: () => void }) {
  const { t } = useTranslation("settings");
  const mutations = {
    eraseLibrary: useEraseLibrary(),
    eraseArtistImages: useEraseArtistImages(),
    erasePlaylists: useErasePlaylists(),
    eraseHistory: useEraseHistory(),
    erase: useEraseAllData(),
  };

  const def = ERASES[eraseKey];
  const mutation = mutations[eraseKey];

  const run = async () => {
    try {
      await mutation.mutateAsync();
      // Only the full erase clears the front's localStorage (theme, language…).
      if (eraseKey === "erase") window.localStorage.clear();
      // A webview reload reboots the front and keeps the setup. `relaunch()` would
      // also kill the dev server in dev.
      if (def.reloads) {
        window.location.reload();
        return;
      }
      onDone();
      toast.success(t(`danger.${eraseKey}.doneTitle`));
    } catch (error) {
      onDone();
      toast.danger(t(`danger.${eraseKey}.failedTitle`), { description: String(error) });
    }
  };

  return (
    <EraseDialog
      isOpen
      isPending={mutation.isPending}
      onClose={onDone}
      onConfirm={() => void run()}
      title={t(`danger.${eraseKey}.dialogTitle`)}
      intro={t(`danger.${eraseKey}.dialogBody`)}
      items={def.itemKeys.map((item) => t(`danger.${eraseKey}.${item}`))}
      note={t(eraseKey === "erase" ? "danger.erase.keepsEngine" : `danger.${eraseKey}.keeps`)}
      confirmLabel={t(`danger.${eraseKey}.confirm`)}
    />
  );
}
