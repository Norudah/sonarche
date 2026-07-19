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
 * Note that none of this shortens silence at the end of a file. That is
 * content: the audio really does run that long, and the bar is right to say so.
 */
export function trackDuration(libraryLength: number | null, reported: number): number | null {
  if (libraryLength != null && libraryLength > 0) return libraryLength;
  // NaN before metadata loads, Infinity for a stream of unknown length.
  return Number.isFinite(reported) && reported > 0 ? reported : null;
}
