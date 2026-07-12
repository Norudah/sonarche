/** Animated bars shown over the artwork while audio is playing. */
export function Equalizer() {
  return (
    <div className="flex h-4 items-end gap-0.5" aria-hidden>
      <span className="h-full w-0.5 origin-bottom rounded-full bg-accent-foreground animate-equalizer [animation-delay:-0.6s]" />
      <span className="h-full w-0.5 origin-bottom rounded-full bg-accent-foreground animate-equalizer [animation-delay:-0.3s]" />
      <span className="h-full w-0.5 origin-bottom rounded-full bg-accent-foreground animate-equalizer" />
      <span className="h-full w-0.5 origin-bottom rounded-full bg-accent-foreground animate-equalizer [animation-delay:-0.45s]" />
    </div>
  );
}
