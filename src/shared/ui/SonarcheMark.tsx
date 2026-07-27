import { useId } from "react";

/**
 * The Sonarche mark: a loaded ark that looks back at you.
 *
 * Three registers stacked — hull, deck with its four containers, and a wide low
 * cabin with two eyes — under the onde borrowed from the landing mock-up. The
 * onde is the only part that escapes the vessel's flat shapes and arcs: the ship
 * is built, the sound is alive. That contrast carries the identity.
 *
 * Reference drawings and the full rule sheet live in `docs/brand/`. The rules
 * that are easy to break by accident:
 *
 * - Nothing goes under the eyes. Anything centred below the cabin becomes a nose.
 * - Containers keep two cells of bare deck at each end, or they read as arms.
 * - No roof above the cabin: the onde is the only thing sitting on the ark.
 * - Amber is the sole departure from the indigo ramp, and only on the two end
 *   containers — they anchor the drawing when everything else closes up.
 *
 * Colours are baked in rather than themed: this is an illustration, not a glyph,
 * and it reads on both the light and the dark surface as it is. Below 32px the
 * one-pixel details stop drawing and start dirtying — `docs/brand/
 * sonarche-mark-small.svg` holds the simplified twin for that case, unused so
 * far because nothing renders the mark that small yet.
 */
export function SonarcheMark({ className }: { className?: string }) {
  // The head's highlight and shadow are clipped to its arch. Scoped so several
  // marks on one page can't resolve each other's clip path.
  const headClip = useId();

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <defs>
        <clipPath id={headClip}>
          <path d="M7.5 12V9.75C7.5 8.85 8.4 8.2 9.7 8 10.5 7.88 13.5 7.88 14.3 8 15.6 8.2 16.5 8.85 16.5 9.75V12Z" />
        </clipPath>
      </defs>

      {/* l'onde — six barres fines à bouts ronds */}
      <g fill="#6163f2">
        <rect x="9.56" y="5.8" width="0.5" height="1.25" rx="0.25" />
        <rect x="10.44" y="4.8" width="0.5" height="2.25" rx="0.25" />
        <rect x="11.31" y="3.8" width="0.5" height="3.25" rx="0.25" />
        <rect x="12.19" y="5.05" width="0.5" height="2" rx="0.25" />
        <rect x="13.06" y="4.3" width="0.5" height="2.75" rx="0.25" />
        <rect x="13.94" y="5.55" width="0.5" height="1.5" rx="0.25" />
      </g>

      {/* la tête — arc en anse de panier, à trois centres */}
      <path
        d="M7.5 12V9.75C7.5 8.85 8.4 8.2 9.7 8 10.5 7.88 13.5 7.88 14.3 8 15.6 8.2 16.5 8.85 16.5 9.75V12Z"
        fill="#c5cbef"
      />
      <g clipPath={`url(#${headClip})`}>
        <rect x="7.5" y="7.8" width="9" height="0.85" fill="#e2e7fc" />
        <rect x="7.5" y="11.4" width="9" height="0.6" fill="#a5aede" />
      </g>
      <rect x="9" y="9.05" width="2" height="2" rx="0.75" fill="#222652" />
      <rect x="13" y="9.05" width="2" height="2" rx="0.75" fill="#222652" />
      {/* l'éclat : sans lui ce sont deux hublots, avec lui c'est un regard */}
      <circle cx="9.6" cy="9.65" r="0.42" fill="#818cf9" />
      <circle cx="13.6" cy="9.65" r="0.42" fill="#818cf9" />

      {/* la cargaison — un ambre à chaque extrémité, deux indigos au milieu */}
      <rect x="3" y="9" width="2" height="3" rx="0.5" fill="#efa831" />
      <rect x="3" y="9" width="2" height="0.45" rx="0.22" fill="#fae1b8" />
      <rect x="3" y="10.3" width="2" height="0.5" fill="#fae1b8" />
      <rect x="5.1" y="10" width="1.5" height="2" rx="0.45" fill="#3d4097" />
      <rect x="5.1" y="10" width="1.5" height="0.4" rx="0.2" fill="#818cf9" />
      <rect x="5.1" y="10.9" width="1.5" height="0.45" fill="#818cf9" />
      <rect x="17.4" y="10" width="1.5" height="2" rx="0.45" fill="#3d4097" />
      <rect x="17.4" y="10" width="1.5" height="0.4" rx="0.2" fill="#818cf9" />
      <rect x="17.4" y="10.9" width="1.5" height="0.45" fill="#818cf9" />
      <rect x="19" y="9" width="2" height="3" rx="0.5" fill="#efa831" />
      <rect x="19" y="9" width="2" height="0.45" rx="0.22" fill="#fae1b8" />
      <rect x="19" y="10.3" width="2" height="0.5" fill="#fae1b8" />

      {/* la coque — plat-bord, deux bordés, quatre hublots */}
      <rect x="1.6" y="12" width="20.8" height="1.1" rx="0.55" fill="#818cf9" />
      <path
        d="M2.2 13.2h19.6q.75 0 .65.75l-.45 2.6q-.6 3.25-3.4 3.25H5.4q-2.8 0-3.4-3.25l-.45-2.6q-.1-.75.65-.75Z"
        fill="#3d4097"
      />
      <path d="M2.2 13.2h19.6q.75 0 .65.75H1.55q-.1-.75.65-.75Z" fill="#4f52c1" />
      <path d="M3.7 16.5h16.6l-.3 1.15q-.75 2.45-2.9 2.45H6.9q-2.15 0-2.9-2.45Z" fill="#2e3172" />
      <path d="M3.7 16.5h16.6l-.14.55H3.84Z" fill="#3d4097" />
      <g fill="#818cf9">
        <circle cx="5.6" cy="15" r="0.45" />
        <circle cx="9.7" cy="15" r="0.45" />
        <circle cx="14.3" cy="15" r="0.45" />
        <circle cx="18.4" cy="15" r="0.45" />
      </g>
    </svg>
  );
}
