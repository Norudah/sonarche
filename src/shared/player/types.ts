export interface PlayableTrack {
  id: string | number;
  /** Absolute path on disk. The Rust engine opens the file itself — it is not
   * a URL, and deliberately not one: routing audio through the asset protocol
   * is what made every track report twice its real length. */
  path: string;
  title: string;
  subtitle?: string;
  artUrl?: string | null;
  /** Cover path on disk, for the OS panel. `artUrl` is what the UI draws. */
  artPath?: string | null;
  /** Duration (seconds) as the library stores it. Shown until the engine
   * answers with what it actually decoded, which then wins. */
  duration?: number | null;
  /** Where the bar can take you — ready-made hrefs, because the launching
   * feature knows the app's routes and shared/player must not. */
  albumUrl?: string | null;
  artistUrl?: string | null;
}
