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
 * And it stops at the header's own edge. It used to overhang by `-bottom-32`,
 * on the theory that the last few percent of alpha — where 8-bit banding is
 * worst — were better off below the fold. But the ramp now *ends* on opaque
 * `--background`, and an absolutely positioned element paints above the
 * in-flow siblings that follow it: those 128px were laying a sheet of page
 * background over the top of the tracklist. Since the final stop is already
 * the exact colour underneath the header, ending flush leaves no seam to hide.
 */
export function HeroWash() {
  return <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-px bottom-0 hero-wash" />;
}
