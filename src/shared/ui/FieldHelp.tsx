import { Popover, Tooltip } from "@heroui/react";
import { CircleHelp } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Help attached to a field label: `FieldHelp` is a tooltip, `FieldHelpPopover`
 * a click-to-open panel for longer explanations. Used sparingly. HeroUI's
 * triggers are focusable, so both work from the keyboard.
 */

/* `inline-flex` + baseline nudge, so it can also end a sentence. */
const TRIGGER =
  "inline-flex size-4 shrink-0 items-center justify-center rounded-full align-[-0.2em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40";

export function FieldHelp({ label, text, delay = 200 }: { label: string; text: ReactNode; delay?: number }) {
  return (
    <Tooltip delay={delay}>
      <Tooltip.Trigger aria-label={label} className={`${TRIGGER} cursor-pointer text-muted/70 hover:text-muted`}>
        <CircleHelp className="size-3.5" />
      </Tooltip.Trigger>
      {/* `tooltip-ink` (theme.css): HeroUI's default is white-on-white with `break-all`. */}
      <Tooltip.Content showArrow className="tooltip-ink">
        {text}
      </Tooltip.Content>
    </Tooltip>
  );
}

/** Tooltip for a control that isn't a field. `role="presentation"` and
 * `tabIndex={-1}` drop HeroUI's trigger role: the child is the button. */
export function ActionHelp({ children, text }: { children: ReactNode; text: string }) {
  return (
    <Tooltip delay={300}>
      <Tooltip.Trigger role="presentation" tabIndex={-1} className="inline-flex">
        {children}
      </Tooltip.Trigger>
      <Tooltip.Content showArrow className="tooltip-ink">
        {text}
      </Tooltip.Content>
    </Tooltip>
  );
}

export function FieldHelpPopover({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  return (
    <Popover>
      <Popover.Trigger
        aria-label={label}
        className={`${TRIGGER} cursor-pointer bg-accent-soft text-accent hover:brightness-95`}
      >
        <CircleHelp className="size-3" />
      </Popover.Trigger>
      <Popover.Content className="max-w-80">
        <Popover.Dialog className="flex flex-col gap-2.5 p-4 outline-none">
          <Popover.Heading className="text-[0.8125rem] font-semibold text-foreground">{title}</Popover.Heading>
          {children}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
