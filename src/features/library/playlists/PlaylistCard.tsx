import { Play } from "lucide-react";
import { motion } from "motion/react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { playlistPath } from "@/app/routes";
import type { Playlist } from "@/features/library/playlists/api";
import { PlaylistCoverMosaic } from "@/features/library/playlists/PlaylistCoverMosaic";
import { springs } from "@/shared/motion/tokens";

interface PlaylistCardProps {
  playlist: Playlist;
  /** The name as shown — the favorites' localized label, not its stored name. */
  displayName: string;
  /** The members' covers, resolved by the page — the card has no library. */
  covers: string[];
  trackCount: number;
  style?: CSSProperties;
  onPlay: () => void;
}

/** Same anatomy as `AlbumCard` — link and play button as siblings, the wrapper
 * as their shared positioning context — so the two shelves move as one. */
export function PlaylistCard({ playlist, displayName, covers, trackCount, style, onPlay }: PlaylistCardProps) {
  const { t } = useTranslation("library");
  const { t: tPlayer } = useTranslation("player");

  return (
    <div style={style} className="group/card cascade-item relative">
      <Link
        to={playlistPath(playlist.id)}
        className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <div className="relative aspect-square overflow-hidden rounded-xl shadow-sm ring-1 ring-separator/60 transition-shadow group-hover/card:shadow-lg">
          <PlaylistCoverMosaic
            covers={covers}
            customUrl={playlist.coverUrl}
            favorites={playlist.kind === "favorites"}
            className="size-full"
          />
        </div>
        <p className="mt-2.5 truncate text-sm font-medium">{displayName}</p>
        <p className="truncate text-[0.8125rem] text-muted">{t("trackCount", { count: trackCount })}</p>
      </Link>

      {trackCount > 0 && (
        <div className="absolute right-2.5 bottom-14 flex translate-y-1 items-center gap-1.5 opacity-0 transition-[opacity,translate] group-hover/card:translate-y-0 group-hover/card:opacity-100 focus-within:translate-y-0 focus-within:opacity-100">
          <motion.button
            type="button"
            onClick={onPlay}
            aria-label={tPlayer("play")}
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.06 }}
            transition={springs.snappy}
            className="flex size-10 cursor-pointer items-center justify-center rounded-full bg-accent text-accent-foreground glow-accent outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <Play className="size-4 fill-current" />
          </motion.button>
        </div>
      )}
    </div>
  );
}
