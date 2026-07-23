import { useTranslation } from "react-i18next";

import type { LibraryTrack } from "@/features/library/api";
import { usePlayer } from "@/shared/player/PlayerContext";

/**
 * Maps library items onto the player's shape and launches them as a queue. One
 * place, because the fallback labels and the authoritative duration have to be
 * identical wherever playback starts from — a table row, an album card, an
 * album's tracklist. The list is the clicked track's context: the album, the
 * discography, the explorer's filtered results.
 */
export function usePlayQueue(): (tracks: LibraryTrack[], startIndex?: number) => void {
  const { t } = useTranslation("library");
  const { play } = usePlayer();

  return (tracks: LibraryTrack[], startIndex = 0) =>
    play(
      tracks.map((track) => ({
        id: track.id,
        src: track.audioUrl,
        title: track.title || t("unknownTitle"),
        subtitle: track.artist || t("unknownArtist"),
        artUrl: track.artUrl,
        duration: track.length,
      })),
      startIndex,
    );
}
