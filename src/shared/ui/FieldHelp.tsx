import { Popover, Tooltip } from "@heroui/react";
import { CircleHelp } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The help affordance that sits on a field's label.
 *
 * Two shapes, one grammar. `FieldHelp` is a tooltip for a notion that fits in a
 * sentence; `FieldHelpPopover` is a click-to-open panel for the two or three
 * that need a paragraph and an example. Both hang off the label, never off a
 * block of their own — an explanation placed away from what it explains reads as
 * one more thing to fill in.
 *
 * Deliberately not on every field: an icon carried by all of them stops being
 * seen. A field whose label already says everything ("Année") gets none.
 *
 * Both triggers render HeroUI's focusable `role="button"` div, so the tooltip
 * opens on keyboard focus and the popover on Enter/Space — no `tabIndex` of our
 * own to maintain.
 */

const TRIGGER =
  "flex size-4 shrink-0 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40";

export function FieldHelp({ label, text }: { label: string; text: string }) {
  return (
    <Tooltip delay={200}>
      <Tooltip.Trigger aria-label={label} className={`${TRIGGER} cursor-pointer text-muted/70 hover:text-muted`}>
        <CircleHelp className="size-3.5" />
      </Tooltip.Trigger>
      {/* `tooltip-ink` is ours (theme.css): HeroUI's default is white-on-white
          with `break-all`, which splits words mid-syllable. */}
      <Tooltip.Content showArrow className="tooltip-ink">
        {text}
      </Tooltip.Content>
    </Tooltip>
  );
}

/** The same dark slab for a control that is not a field — a bulk action whose
 * name cannot say what it does.
 *
 * `role="presentation"` and `tabIndex={-1}` strip HeroUI's trigger of the button
 * role it renders by default: the child here *is* the button, and a button
 * inside a button is both invalid markup and two things to tab through. The
 * control keeps its own `aria-label`, so nothing is lost to a screen reader. */
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
