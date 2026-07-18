import { Radio, RadioGroup } from "@heroui/react";
import { Disc3, Music } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { JobKind } from "@/features/download/api";

/* HeroUI's `.radio` is a column whose `.radio__content` row is the only
 * clickable area — so the pill shape goes on the root while the padding that
 * makes it a real target lives on Content. */
/* `.radio` carries a 16px top margin for HeroUI's stacked layout — useless
 * here, and it is what pads the pill open at the top. */
const SEGMENT =
  "mt-0 rounded-full transition-colors data-[selected]:bg-surface data-[selected]:shadow-xs";
/* HeroUI's `.radio__content` sets its own color, so the text state has to be
 * declared here rather than inherited from the root. */
const SEGMENT_CONTENT =
  "gap-1.5 px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors " +
  "text-muted hover:text-foreground data-[selected]:text-accent";

/** Shown only for a video opened from inside a playlist, where the URL alone
 * cannot say whether the user wants the set or the one track. */
export function KindChoice({
  value,
  onChange,
}: {
  value: JobKind | null;
  onChange: (kind: JobKind) => void;
}) {
  const { t } = useTranslation("download");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted">{t("detected.mixedLabel")}</span>

      <RadioGroup
        value={value ?? ""}
        onChange={(next) => onChange(next as JobKind)}
        aria-label={t("detected.mixed")}
        className="flex flex-row gap-0.5 rounded-full bg-default/60 p-0.5"
      >
        <Radio.Root value="album" className={SEGMENT}>
          <Radio.Content className={SEGMENT_CONTENT}>
            <Disc3 className="size-3.5 shrink-0" />
            {t("detected.choicePlaylist")}
          </Radio.Content>
        </Radio.Root>
        <Radio.Root value="single" className={SEGMENT}>
          <Radio.Content className={SEGMENT_CONTENT}>
            <Music className="size-3.5 shrink-0" />
            {t("detected.choiceTrack")}
          </Radio.Content>
        </Radio.Root>
      </RadioGroup>

      <span className="text-xs text-muted/70">{t("detected.confirmHint")}</span>
    </div>
  );
}
