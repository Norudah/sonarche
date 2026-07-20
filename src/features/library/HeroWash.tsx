/**
 * The ground under every library hero — album, artist, genre.
 *
 * It used to blow the artwork up and blur it behind white text: the streaming
 * grammar, and one every music app already wears. Sonarche's subject is the
 * metadata, so the ground is a plain accent wash instead. The artwork keeps one
 * place to speak — the cover itself, at its real size and unblurred — and the
 * numbers on the band get to be the loudest thing on the page.
 *
 * Two things here exist because the first version ended on a visible horizontal
 * seam, roughly under the cover.
 *
 * The last stop is the page background itself, not `transparent` and not an
 * alpha-zero accent. Both of those compile to `oklab(0 0 0 / 0)` — a
 * *colourless black* — so the ramp drifts towards grey as it fades, and the
 * edge of that grey haze is the line you see (checked in the browser: the
 * computed third stop really is black at zero alpha, even when written as
 * `accent-soft/0`). Landing on an opaque `--background` keeps every stop in the
 * same family and ends the ramp on the exact colour it is sitting on.
 *
 * And it reaches `-bottom-32`, past the header it belongs to: the ramp used to
 * hit zero exactly at the header's edge, where the last few percent of alpha
 * are also where 8-bit banding is worst. Ending the gradient below the fold
 * puts that fragile tail outside the band. The heroes dropped `overflow-hidden`
 * for this — it was only ever there to clip the blurred artwork, which is gone.
 */
export function HeroWash() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 -top-px -bottom-32 bg-gradient-to-b from-accent-soft/80 via-accent-soft/25 to-background"
    />
  );
}
