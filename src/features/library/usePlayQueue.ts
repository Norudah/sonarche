import { useTranslation } from "react-i18next";

import { albumPath, artistPath } from "@/app/routes";
import type { LibraryTrack } from "@/features/library/api";
import { usePlayer } from "@/shared/player/PlayerContext";
import type { PlayableTrack } from "@/shared/player/types";

interface PlayQueue {
  /** A row click: play within the list, in the active mode. */
  playFrom: (tracks: LibraryTrack[], startIndex: number) => void;
  playOrdered: (tracks: LibraryTrack[]) => void;
  playShuffled: (tracks: LibraryTrack[]) => void;
}

/** Launches library items as a player queue, so labels and durations are
 * mapped the same way everywhere. */
export function usePlayQueue(): PlayQueue {
  const { t } = useTranslation("library");
  const { play, playOrdered, playShuffled } = usePlayer();

  const toPlayable = (track: LibraryTrack): PlayableTrack => {
    // Same keying as `groupAlbums`.
    const albumArtist = track.albumArtist.trim() || track.artist.trim();
    return {
      id: track.id,
      path: track.path,
      title: track.title || t("unknownTitle"),
      subtitle: track.artist || t("unknownArtist"),
      artUrl: track.artUrl,
      artPath: track.artPath,
      duration: track.length,
      albumUrl: track.album.trim() ? albumPath(albumArtist, track.album) : null,
      artistUrl: track.artist.trim() ? artistPath(track.artist) : null,
    };
  };

  return {
    playFrom: (tracks, startIndex) => play(tracks.map(toPlayable), startIndex),
    playOrdered: (tracks) => playOrdered(tracks.map(toPlayable)),
    playShuffled: (tracks) => playShuffled(tracks.map(toPlayable)),
  };
}
