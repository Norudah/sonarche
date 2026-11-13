import { cn } from "@heroui/react";
import { X } from "lucide-react";

interface CloseButtonProps {
  label: string;
  onPress: () => void;
  className?: string;
}

/** The one way to close a dialog, panel or editor: round, 32px, quiet until
 * hovered. */
export function CloseButton({ label, onPress, className }: CloseButtonProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={label}
      className={cn(
        "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-default/60 text-muted outline-none",
        "transition-colors hover:bg-default hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent",
        className,
      )}
    >
      <X className="size-4" />
    </button>
  );
}
