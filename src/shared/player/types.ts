export interface PlayableTrack {
  id: string | number;
  src: string;
  title: string;
  subtitle?: string;
  artUrl?: string | null;
  /** Known duration (seconds) from the library's metadata, authoritative over the browser's own estimate. */
  duration?: number | null;
}
