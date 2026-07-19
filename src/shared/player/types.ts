export interface PlayableTrack {
  id: string | number;
  src: string;
  title: string;
  subtitle?: string;
  artUrl?: string | null;
  /** Duration (seconds) from the library's metadata. Shown until the file loads its own; see `playableDuration`. */
  duration?: number | null;
}
