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

/** Lives in the shell: panes come from both `features/settings` and `features/update`. */
const PANES: Record<SettingsCategoryId, () => React.ReactElement> = {
  appearance: AppearanceSection,
  adding: AddingSection,
  metadata: () => <MetadataSection checks={<MetadataChecksCard />} />,
  files: FilesSection,
  services: ServicesSection,
  updates: UpdateSection,
  advanced: AdvancedSection,
  danger: DangerSection,
  developer: DeveloperSection,
};

/** Mounts the settings dialog and its `⌘,` / `Ctrl+,` shortcut (open only). */
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
    // Long operations started from a pane keep running after the dialog closes.
    <SettingsTasksProvider>
      <SettingsDialog>
        <Pane />
      </SettingsDialog>
      <SettingsTaskHost />
    </SettingsTasksProvider>
  );
}
