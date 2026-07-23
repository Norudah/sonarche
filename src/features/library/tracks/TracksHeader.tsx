import { useTranslation } from "react-i18next";

import { HeroPlayButtons } from "@/features/library/HeroPlayButtons";
import { SearchField } from "@/features/library/tracks/SearchField";

interface TracksHeaderProps {
  count: number;
  playtime: { hours: number; minutes: number };
  query: string;
  onQueryChange: (value: string) => void;
  onPlayAll: () => void;
  onShuffleAll: () => void;
}

export function TracksHeader({ count, playtime, query, onQueryChange, onPlayAll, onShuffleAll }: TracksHeaderProps) {
  const { t } = useTranslation("library");

  // Minutes are padded only next to an hour count ("21 h 08"); alone they read
  // as a plain number ("41 min").
  const playtimeLabel =
    playtime.hours > 0
      ? t("totalPlaytime", {
          hours: playtime.hours,
          minutes: String(playtime.minutes).padStart(2, "0"),
        })
      : t("totalPlaytimeMinutes", { minutes: playtime.minutes });

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t("views.tracks")}</h1>
          <p className="mt-0.5 text-[0.8125rem] text-muted">
            {t("trackCount", { count })} · {playtimeLabel}
          </p>
        </div>
        {/* The same twin pills as the detail heroes — this page used to keep a
         * bare accent disc, the one leftover from before sets were playable.
         * Here the pair launches the visible list, filters included. */}
        <HeroPlayButtons onPlay={onPlayAll} onShuffle={onShuffleAll} />
      </div>

      <SearchField value={query} onChange={onQueryChange} />
    </div>
  );
}
