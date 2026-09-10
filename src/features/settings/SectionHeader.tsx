/** The head of every settings pane: a title and a lede, nothing above them.
 *
 * The eyebrow that used to sit here said "Paramètres" — true, and redundant
 * now that the dialog's own menu says it two inches to the left. Smaller than
 * the library heroes too: this is a pane inside a window, not a page filling
 * one, and a 3xl title in a 42rem column reads as a headline for the whole
 * dialog rather than for the section under it. */
export function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <header>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">{description}</p>
    </header>
  );
}
