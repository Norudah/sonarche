import { useEffect } from "react";

import type { PlayableTrack } from "@/shared/player/types";

interface MediaSessionHandlers {
  current: PlayableTrack | null;
  isPlaying: boolean;
  toggle: () => void;
  next: () => void;
  previous: () => void;
}

/**
 * Mirror playback into the OS via the Media Session API: hardware media keys
 * and the system's now-playing surface drive the same queue as the on-screen
 * transport. Guarded — the API is absent from some webviews, and the app must
 * not care.
 */
export function useMediaSession({ current, isPlaying, toggle, next, previous }: MediaSessionHandlers): void {
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = current
      ? new MediaMetadata({
          title: current.title,
          artist: current.subtitle ?? "",
          artwork: current.artUrl ? [{ src: current.artUrl }] : [],
        })
      : null;
    return () => {
      navigator.mediaSession.metadata = null;
    };
  }, [current]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = current ? (isPlaying ? "playing" : "paused") : "none";
  }, [current, isPlaying]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.setActionHandler("play", toggle);
    navigator.mediaSession.setActionHandler("pause", toggle);
    navigator.mediaSession.setActionHandler("nexttrack", next);
    navigator.mediaSession.setActionHandler("previoustrack", previous);
    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
    };
  }, [toggle, next, previous]);
}
