/**
 * The accent wash under every library hero. It ends on the opaque
 * `--background`, not `transparent` (which is black at zero alpha and greys
 * the fade), and stops at the header's edge so it doesn't cover the content.
 */
export function HeroWash() {
  return <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-px bottom-0 hero-wash" />;
}
