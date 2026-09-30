/** Playing-track bars, coloured by `currentColor`. */
export function Equalizer({ className = "" }: { className?: string }) {
  return (
    <div className={`flex h-3.5 items-end gap-0.5 ${className}`} aria-hidden>
      <span className="h-full w-0.5 origin-bottom rounded-full bg-current animate-equalizer [animation-delay:-0.6s]" />
      <span className="h-full w-0.5 origin-bottom rounded-full bg-current animate-equalizer [animation-delay:-0.3s]" />
      <span className="h-full w-0.5 origin-bottom rounded-full bg-current animate-equalizer" />
      <span className="h-full w-0.5 origin-bottom rounded-full bg-current animate-equalizer [animation-delay:-0.45s]" />
    </div>
  );
}
