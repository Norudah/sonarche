import { Tooltip } from "@heroui/react";
import type { ReactNode } from "react";

/** Explains a marked cell in a tooltip. `role="presentation"` avoids a tab
 * stop per cell; a hidden span keeps the reason for screen readers. */
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
