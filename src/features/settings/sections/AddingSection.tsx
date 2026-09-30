import { Spinner } from "@heroui/react";
import { useTranslation } from "react-i18next";

import { DelaySlider } from "@/features/settings/DelaySlider";
import { RATE_LIMITS } from "@/features/settings/rateLimits";
import { SectionHeader } from "@/features/settings/SectionHeader";
import { SettingCard } from "@/features/settings/SettingCard";
import { SettingsPanel, SwitchRow } from "@/features/settings/SettingsPanel";
import { usePreferences, useSetRateLimitDelay } from "@/features/settings/hooks";
import { storeAutoExpand, useAutoExpand } from "@/shared/lib/optionPanels";

/** Settings for the download and import pages, including the download pause. */
export function AddingSection() {
  const { t } = useTranslation("settings");
  const download = useAutoExpand("download");
  const importing = useAutoExpand("import");
  const preferences = usePreferences();
  const setDelay = useSetRateLimitDelay();

  return (
    <>
      <SectionHeader title={t("adding.title")} description={t("adding.description")} />

      <SettingsPanel>
        <SwitchRow
          settingKey="adding.downloadOptions"
          isSelected={download}
          onChange={(on) => storeAutoExpand("download", on)}
        />
        <SwitchRow
          settingKey="adding.importOptions"
          isSelected={importing}
          onChange={(on) => storeAutoExpand("import", on)}
        />
      </SettingsPanel>

      {/* Saves on slider release. */}
      {preferences.isPending ? (
        <Spinner size="sm" aria-label={t("loading")} />
      ) : (
        RATE_LIMITS.map((def) => (
          <SettingCard key={def.key} settingKey={def.labelBase}>
            <DelaySlider
              def={def}
              seconds={preferences.data![def.field]}
              onCommit={(seconds) => setDelay.mutate({ key: def.key, seconds })}
            />
          </SettingCard>
        ))
      )}

      {setDelay.isError && <p className="text-sm text-danger">{String(setDelay.error)}</p>}
    </>
  );
}
