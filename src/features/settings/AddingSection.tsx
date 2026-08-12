import { useTranslation } from "react-i18next";

import { SettingsHero } from "@/features/settings/SettingsHero";
import { SwitchCard } from "@/features/settings/SwitchCard";
import { storeAutoExpand, useAutoExpand } from "@/shared/lib/optionPanels";

/**
 * The two pages that put music in the ark, and the one habit they share.
 *
 * A category of its own rather than two switches filed under Appearance: what
 * a panel does when a link is pasted is not how the app is dressed, and the
 * download and import pages are a pair everywhere else in the product — same
 * sidebar group, same composer grammar, one shared history page. This is where
 * anything else about how music comes in will land.
 *
 * Neither switch touches what an import or a download *does* — only whether the
 * options are already unfolded when you arrive at them.
 */
export function AddingSection() {
  const { t } = useTranslation("settings");
  const download = useAutoExpand("download");
  const importing = useAutoExpand("import");

  return (
    <>
      <SettingsHero eyebrow={t("title")} title={t("adding.title")} description={t("adding.description")} />

      <SwitchCard
        name={t("adding.downloadOptions.name")}
        why={t("adding.downloadOptions.why")}
        isSelected={download}
        onChange={(on) => storeAutoExpand("download", on)}
      />

      <SwitchCard
        name={t("adding.importOptions.name")}
        why={t("adding.importOptions.why")}
        isSelected={importing}
        onChange={(on) => storeAutoExpand("import", on)}
      />
    </>
  );
}
