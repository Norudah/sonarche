import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import type { MoveCheck } from "@/features/settings/api";
import type { EraseKey } from "@/features/settings/erases";
import { closeSettings } from "@/shared/lib/settingsDialog";

/**
 * The three things settings can start that must outlive it.
 *
 * A whole-library conversion runs for hours and holds the app; a move ends in
 * a relaunch; an erase cannot be taken back. All three used to be dialogs
 * nested inside the settings pane that opened them — which meant Escape, a
 * click on the veil, or any other way of dismissing settings would unmount the
 * dialog reporting on an operation still running underneath. The mutation
 * would carry on in Rust with nothing on screen to say so.
 *
 * So they leave. Starting one closes settings and hands the task to a host
 * mounted beside it, which owns the mutation and the dialog for as long as it
 * takes. Nothing reopens settings afterwards: two of the three end in a reload
 * anyway, and the third has just spent an hour rewriting the library.
 */
export type SettingsTask =
  { kind: "convert" } | { kind: "move"; parent: string; check: MoveCheck } | { kind: "erase"; key: EraseKey };

interface SettingsTasks {
  task: SettingsTask | null;
  start: (task: SettingsTask) => void;
  end: () => void;
}

const SettingsTasksContext = createContext<SettingsTasks | null>(null);

export function SettingsTasksProvider({ children }: { children: ReactNode }) {
  const [task, setTask] = useState<SettingsTask | null>(null);

  const value = useMemo<SettingsTasks>(
    () => ({
      task,
      start: (next) => {
        closeSettings();
        setTask(next);
      },
      end: () => setTask(null),
    }),
    [task],
  );

  return <SettingsTasksContext.Provider value={value}>{children}</SettingsTasksContext.Provider>;
}

export function useSettingsTasks(): SettingsTasks {
  const value = useContext(SettingsTasksContext);
  if (value == null) throw new Error("useSettingsTasks must be used inside a SettingsTasksProvider");
  return value;
}
