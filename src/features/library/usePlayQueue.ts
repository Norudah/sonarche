import { useTranslation } from "react-i18next";

import { albumPath, artistPath } from "@/app/routes";
import type { LibraryTrack } from "@/features/library/api";
import { usePlayer } from "@/shared/player/PlayerContext";
import type { PlayableTrack } from "@/shared/player/types";

interface PlayQueue {
  /** A row click: play this track within the list, in whatever mode is active. */
  playFrom: (tracks: LibraryTrack[], startIndex: number) => void;
  /** "Play all": the set from the top, in order. */
  playOrdered: (tracks: LibraryTrack[]) => void;
  /** "Shuffle": the set shuffled, random opener, fresh draw per press. */
  playShuffled: (tracks: LibraryTrack[]) => void;
}

/**
 * Maps library items onto the player's shape and launches them as a queue. One
 * place, because the fallback labels and the authoritative duration have to be
 * identical wherever playback starts from — a table row, an album card, an
 * album's tracklist. The list is the clicked track's context: the album, the
 * discography, the explorer's filtered results.
 */
export function usePlayQueue(): PlayQueue {
  const { t } = useTranslation("library");
  const { play, playOrdered, playShuffled } = usePlayer();

  const toPlayable = (track: LibraryTrack): PlayableTrack => {
    // The album route is keyed on the album artist (falling back to the track
    // artist), exactly as `groupAlbums` files it.
    const albumArtist = track.albumArtist.trim() || track.artist.trim();
    return {
      id: track.id,
      src: track.audioUrl,
      title: track.title || t("unknownTitle"),
      subtitle: track.artist || t("unknownArtist"),
      artUrl: track.artUrl,
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
