import { useTranslation } from "react-i18next";

import type { LibraryTrack } from "@/features/library/api";
import { usePlayer } from "@/shared/player/PlayerContext";

/**
 * Maps a library item onto the player's shape. One place, because the fallback
 * labels have to be identical wherever playback starts from — a table row, an
 * album card, an album's tracklist.
 */
export function usePlayTrack(): (track: LibraryTrack) => void {
  const { t } = useTranslation("library");
  const { play } = usePlayer();

  return (track: LibraryTrack) =>
    play({
      id: track.id,
      src: track.audioUrl,
      title: track.title || t("unknownTitle"),
      subtitle: track.artist || t("unknownArtist"),
      artUrl: track.artUrl,
      duration: track.length,
    });
}
