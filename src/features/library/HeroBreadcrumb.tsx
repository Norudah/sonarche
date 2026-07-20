interface HeroBreadcrumbProps {
  /** Where the trail leads back to. The caller owns the history logic: only it
   * knows whether stepping back lands on the shelf it names. */
  onBack: () => void;
  backLabel: string;
  /** The page you are on. Not a link — you are already here. */
  current: string;
  label: string;
}

/**
 * The trail at the top of every library hero.
 *
 * A breadcrumb rather than the back arrow the dark bands used to carry: on a
 * light wash a lone arrow reads as an overlay control that lost its overlay,
 * and naming the trail costs the same line.
 */
export function HeroBreadcrumb({ onBack, backLabel, current, label }: HeroBreadcrumbProps) {
  return (
    <nav aria-label={label} className="flex items-center gap-1.5 text-[0.8125rem]">
      <button
        type="button"
        onClick={onBack}
        className="cursor-pointer rounded-sm font-medium text-accent outline-none transition-colors hover:text-accent-hover focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        {backLabel}
      </button>
      <span className="text-muted/60">/</span>
      <span className="min-w-0 truncate text-muted">{current}</span>
    </nav>
  );
}
