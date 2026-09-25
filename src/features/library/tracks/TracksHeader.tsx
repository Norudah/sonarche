import { useTranslation } from "react-i18next";

import { HeroPlayButtons } from "@/features/library/HeroPlayButtons";

interface TracksHeaderProps {
  count: number;
  playtime: { hours: number; minutes: number };
  onPlayAll: () => void;
  onShuffleAll: () => void;
}

/** Title, size and play buttons; search lives in the filter bar. */
export function TracksHeader({ count, playtime, onPlayAll, onShuffleAll }: TracksHeaderProps) {
  const { t } = useTranslation("library");

  // Minutes padded only next to hours ("21 h 08", "41 min").
  const playtimeLabel =
    playtime.hours > 0
      ? t("totalPlaytime", {
          hours: playtime.hours,
          minutes: String(playtime.minutes).padStart(2, "0"),
        })
      : t("totalPlaytimeMinutes", { minutes: playtime.minutes });

  return (
    <div className="flex items-center gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("views.tracks")}</h1>
        <p className="mt-0.5 text-[0.8125rem] text-muted">
          {t("trackCount", { count })} · {playtimeLabel}
        </p>
      </div>
      {/* Plays the visible list, filters included. */}
      <HeroPlayButtons onPlay={onPlayAll} onShuffle={onShuffleAll} />
    </div>
  );
}
