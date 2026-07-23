/**
 * A titled section inside the album drawer: a caption and a one-line gloss of
 * what editing here does. `accent` adds a light rule down the left edge to set
 * the section off — used on "specific fields", skipped on "common fields" whose
 * separation the header's own border already carries.
 */
export function AlbumSectionHeading({
  title,
  description,
  accent = false,
}: {
  title: string;
  description: string;
  accent?: boolean;
}) {
  return (
    <div className={"flex flex-col gap-1" + (accent ? " border-l-2 border-accent/30 pl-3.5" : "")}>
      <p className="text-[0.6875rem] font-semibold tracking-wider text-muted uppercase">{title}</p>
      <p className="text-[0.75rem] text-muted/70">{description}</p>
    </div>
  );
}
