import { useState } from "react";

/**
 * The ground behind a full-bleed hero: a fixed indigo gradient, with a piece of
 * artwork blown up and blurred over it once it has decoded. Same grammar as the
 * metadata drawer's header — dark ground, white text — so the app's one
 * "spotlight" treatment stays recognisable, coloured by the record rather than
 * by a constant. Shared by the album hero and the artist hero.
 *
 * Two things here exist purely to stop the banner stuttering on arrival.
 *
 * The gradient is *always* painted rather than being the no-artwork
 * alternative. It used to be either/or, so a band with a cover rendered as a
 * dark scrim over nothing for the frames before the image decoded, then the
 * artwork popped in.
 *
 * And the artwork fades in on load instead of appearing the instant it decodes,
 * which turns that pop into a cross-fade from the gradient. Decoding finishes
 * whenever it finishes — that timing is not ours to control, so the arrival is
 * made smooth rather than fast.
 *
 * `will-change-transform` is load-bearing too: a 64px blur across a band this
 * wide is expensive to rasterise, and without its own compositor layer the
 * browser redoes that work on every frame of the page's enter animation. It has
 * to be `will-change` and not Tailwind's `transform-gpu` — v4 puts `scale` in
 * its own property, so `transform-gpu` left the element on a flattened 2D
 * identity matrix and promoted nothing (checked in the browser, not assumed).
 */
export function HeroBackdrop({ artUrl }: { artUrl: string | null }) {
  const [isLoaded, setIsLoaded] = useState(false);
  // A cached cover can finish before React attaches onLoad — the callback ref
  // catches that case, where waiting for the event would leave it invisible.
  const catchCached = (node: HTMLImageElement | null) => {
    if (node?.complete) setIsLoaded(true);
  };

  return (
    <>
      <div className="absolute inset-0 bg-gradient-to-br from-metadata-header-from to-metadata-header-to" />
      {artUrl && (
        <>
          {/* scale-110 hides the transparent fringe blur leaves at the edges. */}
          <img
            ref={catchCached}
            src={artUrl}
            alt=""
            aria-hidden
            onLoad={() => setIsLoaded(true)}
            className={
              "absolute inset-0 size-full scale-110 object-cover blur-3xl transition-opacity duration-300 will-change-transform " +
              (isLoaded ? "opacity-100" : "opacity-0")
            }
          />
          <div
            className={
              "absolute inset-0 bg-black/55 transition-opacity duration-300 " +
              (isLoaded ? "opacity-100" : "opacity-0")
            }
          />
        </>
      )}
    </>
  );
}
