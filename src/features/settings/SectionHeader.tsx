/** Title and lede of a settings pane. */
export function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <header>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">{description}</p>
    </header>
  );
}
