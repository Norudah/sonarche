/**
 * The duration to show for a track, given what the library knows and what the
 * <audio> element reports.
 *
 * The library wins, and that is not a fallback ordering — `length` in beets is
 * read from the audio file itself at import, so it *is* the file's duration,
 * to a tenth of a second. It was briefly not: enrichment overwrote it with
 * MusicBrainz' duration for the recording, which the downloaded file never
 * quite matches. That is fixed at the source now (see `work_fields` in the
 * sidecar), and this side gets to be simple again.
 *
 * The element's own figure is the fallback, not the reference, because read
 * back through the asset protocol it has been seen to come out at roughly
 * double the real one — which put the end of the music at the halfway mark of
 * the seek bar. It is only consulted for a track the library has no length for.
 *
 * Note that none of this shortens real silence inside the file — that is
 * content, and it lies within the library's length. What gets cut is only the
 * element's phantom overrun past that length (see `isPastKnownEnd`).
 */
export function trackDuration(libraryLength: number | null, reported: number): number | null {
  if (libraryLength != null && libraryLength > 0) return libraryLength;
  // NaN before metadata loads, Infinity for a stream of unknown length.
  return Number.isFinite(reported) && reported > 0 ? reported : null;
}

/**
 * Grace past the library length before declaring the track over. Covers the
 * ~250 ms `timeupdate` granularity and beets' tenth-of-a-second rounding
 * without ever letting a whole phantom minute through.
 */
const END_OVERRUN = 0.5;

/**
 * Whether the element has played past the end of the actual content.
 *
 * The same asset-protocol distortion that doubles the *reported* duration also
 * doubles the element's idea of where the file ends: after the real last
 * sample it keeps "playing" silence, the clock keeps counting, and `ended`
 * only fires at the phantom end — minutes late. Display was already shielded
 * by `trackDuration`; ending the track is the library's call too, so the
 * player treats crossing this line exactly like the `ended` event.
 *
 * Always false without a library length: then the element's own end is the
 * only end there is, and `ended` handles it.
 */
export function isPastKnownEnd(libraryLength: number | null, currentTime: number): boolean {
  return libraryLength != null && libraryLength > 0 && currentTime >= libraryLength + END_OVERRUN;
}
