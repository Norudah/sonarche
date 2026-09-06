import { Spinner } from "@heroui/react";
import { useTranslation } from "react-i18next";

import { DelaySlider } from "@/features/settings/DelaySlider";
import { RATE_LIMITS } from "@/features/settings/rateLimits";
import { SectionHeader } from "@/features/settings/SectionHeader";
import { SettingCard } from "@/features/settings/SettingCard";
import { SettingsPanel, SwitchRow } from "@/features/settings/SettingsPanel";
import { usePreferences, useSetRateLimitDelay } from "@/features/settings/hooks";
import { storeAutoExpand, useAutoExpand } from "@/shared/lib/optionPanels";

/**
 * The two pages that put music in the ark, and the pace at which one of them
 * works.
 *
 * A category of its own rather than two switches filed under Appearance: what
 * a panel does when a link is pasted is not how the app is dressed, and the
 * download and import pages are a pair everywhere else in the product — same
 * sidebar group, same composer grammar, one shared history page.
 *
 * The download pause used to be a category on its own, holding one slider and
 * a read-only card. It is filed here now, under the page it paces: someone
 * hunting it is thinking "my long playlists keep failing", not "rate limits".
 * The delays the app *imposes* stayed behind with the services that impose
 * them — those are not about downloading, and they are not adjustable.
 */
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
          name={t("adding.downloadOptions.name")}
          why={t("adding.downloadOptions.why")}
          isSelected={download}
          onChange={(on) => storeAutoExpand("download", on)}
        />
        <SwitchRow
          name={t("adding.importOptions.name")}
          why={t("adding.importOptions.why")}
          isSelected={importing}
          onChange={(on) => storeAutoExpand("import", on)}
        />
      </SettingsPanel>

      {/* Auto-saves on slider release — nothing here has a footer to press. */}
      {preferences.isPending ? (
        <Spinner size="sm" aria-label={t("loading")} />
      ) : (
        RATE_LIMITS.map((def) => (
          <SettingCard key={def.key}>
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
