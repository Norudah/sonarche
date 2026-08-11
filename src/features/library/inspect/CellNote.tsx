import { Tooltip } from "@heroui/react";
import type { ReactNode } from "react";

/**
 * Why one inspected cell is marked, said in words.
 *
 * The mark alone cannot carry the reason: an amber cell reads as "something is
 * missing here", which is right for a hole and wrong for a genre the tree does
 * not know — the value is there, it is the *classification* that failed. That
 * distinction has to be readable, and the native `title` it used to live in is
 * a one-second delay on a grey slab most people never wait for.
 *
 * `role="presentation"` strips HeroUI's default button role: a cell is not a
 * control, and a hundred of them would be a hundred tab stops. The reason is
 * kept for screen readers by a hidden span instead, since a presentational
 * element cannot be named.
 */
export function CellNote({ text, children }: { text: string; children: ReactNode }) {
  return (
    <Tooltip delay={150}>
      <Tooltip.Trigger role="presentation" tabIndex={-1} className="block min-w-0">
        {children}
        <span className="sr-only">{text}</span>
      </Tooltip.Trigger>
      <Tooltip.Content showArrow className="tooltip-ink">
        {text}
      </Tooltip.Content>
    </Tooltip>
  );
}
