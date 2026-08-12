import { Switch } from "@heroui/react";

import { SettingCard } from "@/features/settings/SettingCard";

interface SwitchCardProps {
  name: string;
  why: string;
  isSelected: boolean;
  onChange: (enabled: boolean) => void;
}

/**
 * A setting whose answer is yes or no.
 *
 * The one shape on this page where the name and the control share a line —
 * `Setting` stacks name, reason and control, and stacking a switch under its
 * own name puts the label on screen twice. The reason still runs at full width
 * underneath, like every other card here.
 *
 * Written out by hand in four places before this, which is three too many for
 * a row of three elements that must line up pixel for pixel across categories.
 */
export function SwitchCard({ name, why, isSelected, onChange }: SwitchCardProps) {
  return (
    <SettingCard>
      <div className="flex flex-col gap-1">
        <Switch isSelected={isSelected} onChange={onChange} className="w-full">
          {/* `flex-row-reverse` on the clickable row, not on the root: the
              control is authored first and belongs on the right, and the whole
              row stays the hit target either way. */}
          <Switch.Content className="w-full flex-row-reverse justify-between">
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <span className="text-[0.8125rem] font-semibold">{name}</span>
          </Switch.Content>
        </Switch>
        <p className="text-[0.8125rem] leading-relaxed text-muted">{why}</p>
      </div>
    </SettingCard>
  );
}
