export interface PlayableTrack {
  id: string | number;
  /** Absolute path on disk, opened by the Rust engine (the asset protocol
   * misreported durations). */
  path: string;
  title: string;
  subtitle?: string;
  artUrl?: string | null;
  /** Cover path on disk, for the OS panel; `artUrl` is what the UI draws. */
  artPath?: string | null;
  /** Library duration in seconds, replaced by the engine's decoded one. */
  duration?: number | null;
  /** Ready-made hrefs: `shared/player` doesn't know the app's routes. */
  albumUrl?: string | null;
  artistUrl?: string | null;
}
