import { Radio, RadioGroup } from "@heroui/react";
import { Disc3, Music } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { JobKind } from "@/features/download/api";

/* HeroUI's `.radio` is a column whose `.radio__content` row is the only
 * clickable area — so the card frame goes on the root and every visual goes
 * inside Content, never as its sibling. */
const CARD =
  "flex-1 rounded-xl border border-separator bg-surface px-4 py-3 transition-colors " +
  "hover:border-accent/50 data-[selected]:border-accent data-[selected]:bg-accent-soft";

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
    <RadioGroup
      value={value ?? ""}
      onChange={(next) => onChange(next as JobKind)}
      aria-label={t("detected.mixed")}
      className="flex flex-col gap-2"
    >
      <span className="text-sm text-muted">{t("detected.mixed")}</span>
      <div className="flex flex-wrap gap-3">
        <Radio.Root value="album" className={CARD}>
          <Radio.Content className="w-full">
            <Radio.Control />
            <Disc3 className="size-5 shrink-0 text-muted" />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{t("detected.choicePlaylist")}</span>
              <span className="text-xs font-normal text-muted">
                {t("detected.choicePlaylistHint")}
              </span>
            </span>
          </Radio.Content>
        </Radio.Root>
        <Radio.Root value="single" className={CARD}>
          <Radio.Content className="w-full">
            <Radio.Control />
            <Music className="size-5 shrink-0 text-muted" />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{t("detected.choiceTrack")}</span>
              <span className="text-xs font-normal text-muted">
                {t("detected.choiceTrackHint")}
              </span>
            </span>
          </Radio.Content>
        </Radio.Root>
      </div>
    </RadioGroup>
  );
}
