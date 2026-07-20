export interface PlayableTrack {
  id: string | number;
  src: string;
  title: string;
  subtitle?: string;
  artUrl?: string | null;
  /** Duration (seconds) as stored by the library, which is the audio file's own. Authoritative; see `trackDuration`. */
  duration?: number | null;
}
