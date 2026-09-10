import { useEffect } from "react";

import { MetadataChecksCard } from "@/app/layout/MetadataChecksCard";
import { SettingsDialog } from "@/features/settings/SettingsDialog";
import { SettingsTaskHost } from "@/features/settings/SettingsTaskHost";
import { AddingSection } from "@/features/settings/sections/AddingSection";
import { AdvancedSection } from "@/features/settings/sections/AdvancedSection";
import { AppearanceSection } from "@/features/settings/sections/AppearanceSection";
import { DangerSection } from "@/features/settings/sections/DangerSection";
import { DeveloperSection } from "@/features/settings/sections/DeveloperSection";
import { FilesSection } from "@/features/settings/sections/FilesSection";
import { MetadataSection } from "@/features/settings/sections/MetadataSection";
import { ServicesSection } from "@/features/settings/sections/ServicesSection";
import { SettingsTasksProvider } from "@/features/settings/tasks";
import { UpdateSection } from "@/features/update/UpdateSection";
import { openSettings, useSettingsDialog, type SettingsCategoryId } from "@/shared/lib/settingsDialog";

/**
 * Which pane each category shows.
 *
 * The map lives at app level, exactly where the router used to hold it: the
 * updates pane belongs to `features/update` and every other one to
 * `features/settings`, and features do not import each other. The shell is the
 * one place allowed to know about both.
 */
const PANES: Record<SettingsCategoryId, () => React.ReactElement> = {
  appearance: AppearanceSection,
  adding: AddingSection,
  // The only pane the shell has to compose: its last card holds a preference
  // owned by the library feature. See `MetadataChecksCard`.
  metadata: () => <MetadataSection checks={<MetadataChecksCard />} />,
  files: FilesSection,
  services: ServicesSection,
  updates: UpdateSection,
  advanced: AdvancedSection,
  danger: DangerSection,
  developer: DeveloperSection,
};

/**
 * Mounts the settings dialog and the one keystroke that opens it.
 *
 * `⌘,` / `Ctrl+,` is the convention on every desktop platform and the app had
 * no shortcut at all while settings was a route — a route is reached by
 * clicking, and nobody thinks to bind a key to a link. It only ever opens:
 * pressing it again on an open dialog reads as "show me the settings", which
 * is already true, and Escape is the way out.
 *
 * Inside the setup gate, like the rest of the chrome — there are no settings
 * to change while the environment is still being checked.
 */
export function SettingsHost() {
  const { category } = useSettingsDialog();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "," || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      openSettings();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const Pane = PANES[category];

  return (
    // The provider wraps both: the panes start the long operations, and the
    // host — mounted beside the dialog, not inside it — runs them for as long
    // as they take. See `features/settings/tasks`.
    <SettingsTasksProvider>
      <SettingsDialog>
        <Pane />
      </SettingsDialog>
      <SettingsTaskHost />
    </SettingsTasksProvider>
  );
}
