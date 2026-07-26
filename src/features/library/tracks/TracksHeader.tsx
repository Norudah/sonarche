import { useTranslation } from "react-i18next";

import { HeroPlayButtons } from "@/features/library/HeroPlayButtons";

interface TracksHeaderProps {
  count: number;
  playtime: { hours: number; minutes: number };
  onPlayAll: () => void;
  onShuffleAll: () => void;
}

/**
 * Identity and intent: what this page is, how big it is, how to start it.
 *
 * The search moved down into the filter bar with the rest of the controls. It was
 * the only one up here, which made the title row half a toolbar — and left
 * nowhere for the filters to go without turning it into a whole one.
 */
export function TracksHeader({ count, playtime, onPlayAll, onShuffleAll }: TracksHeaderProps) {
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
  );
}
