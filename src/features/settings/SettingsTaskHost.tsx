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

/**
 * Runs what settings started, outside settings.
 *
 * Mounted beside the dialog rather than inside it, so a conversion that takes
 * hours, a move that ends in a relaunch and an erase that cannot be undone all
 * survive every way there is to dismiss the pane that offered them. The
 * mutations live here for the same reason: unmounting their dialog used to
 * unmount them, leaving Rust working with nothing on screen to say so.
 *
 * Nothing is rendered until a task is asked for, so none of these hooks
 * subscribes to anything on an ordinary launch.
 */
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
      // A relaunch and not a cache invalidation: playback was stopped, the
      // sidecar was taken down, and every track path the app is holding points
      // at the old folder. Restarting is the only way to be sure none of it
      // survives — and the dialog said it would.
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
      // Factory settings include the front's own: theme, language choice, the
      // remembered download category all live in localStorage. Only the full
      // erase claims them — the aimed ones touch nothing the user chose.
      if (eraseKey === "erase") window.localStorage.clear();
      // The reload is a full front reboot — splash, environment check, sidecar
      // respawned on demand — and the process underneath keeps the setup.
      // `relaunch()` was worse in both worlds: in dev it killed the process the
      // tauri CLI was watching, which took vite down with it and relaunched the
      // app onto a dead dev server; in prod it paid a whole process restart for
      // nothing the reload does not already redo.
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
