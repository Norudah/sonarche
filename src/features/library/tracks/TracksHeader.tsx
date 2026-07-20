import { motion } from "motion/react";
import { Play } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SearchField } from "@/features/library/tracks/SearchField";
import { springs } from "@/shared/motion/tokens";

interface TracksHeaderProps {
  count: number;
  playtime: { hours: number; minutes: number };
  query: string;
  onQueryChange: (value: string) => void;
  onPlayAll: () => void;
}

export function TracksHeader({
  count,
  playtime,
  query,
  onQueryChange,
  onPlayAll,
}: TracksHeaderProps) {
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
      <div className="flex items-center gap-4">
        {/* The page's one primary action, so it gets the press feedback the
         * composer's submit button already has. */}
        <motion.button
          type="button"
          onClick={onPlayAll}
          aria-label={t("playAll")}
          whileTap={{ scale: 0.94 }}
          whileHover={{ scale: 1.05 }}
          transition={springs.snappy}
          className="flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg shadow-accent/30 outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <Play className="size-5 fill-current" />
        </motion.button>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t("views.tracks")}</h1>
          <p className="mt-0.5 text-[0.8125rem] text-muted">
            {t("trackCount", { count })} · {playtimeLabel}
          </p>
        </div>
      </div>

      <SearchField value={query} onChange={onQueryChange} />
    </div>
  );
}
