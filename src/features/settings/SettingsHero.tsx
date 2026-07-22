/** The head of every settings category: the same eyebrow / big title / muted
 * lede as the library heroes, so a category reads like a page in the app rather
 * than a form in a dialog. No accent wash here — that band is reserved for the
 * detail views (album, artist, drawer); a top-level list page wears the plain
 * title, as Tracks and Albums do. */
export function SettingsHero({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header>
      <p className="text-[0.6875rem] font-semibold tracking-wider text-accent uppercase">{eyebrow}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1.5 max-w-prose text-sm text-muted">{description}</p>
    </header>
  );
}
