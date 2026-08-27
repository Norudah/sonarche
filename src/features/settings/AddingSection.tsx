import { useTranslation } from "react-i18next";

import { AudioFormatCard } from "@/features/settings/AudioFormatCard";
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
 * The two switches touch nothing an import or a download *does* — only whether
 * the options are already unfolded when you arrive at them. The format card
 * underneath is the opposite and the page says so by putting it last: it
 * decides what the audio files are made of.
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

      {/* Last, and the only card here that touches the files themselves: the
          two switches above are about how a page looks when you arrive at it,
          this one decides what the audio is made of. */}
      <AudioFormatCard />
    </>
  );
}
