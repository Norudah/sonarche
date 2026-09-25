import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import type { MoveCheck } from "@/features/settings/api";
import type { EraseKey } from "@/features/settings/erases";
import { closeSettings } from "@/shared/lib/settingsDialog";

/** Settings operations that must outlive the dialog (conversion, move,
 * erase). Starting one closes settings and hands it to `SettingsTaskHost`. */
type SettingsTask =
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
