import { cn, Switch } from "@heroui/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { FieldHelpPopover } from "@/shared/ui/FieldHelp";

/**
 * Several settings on one plane, ruled apart.
 *
 * The page used to be a stack of one-setting cards, each with its name and two
 * to four lines of prose at the same weight. Beautifully written and completely
 * unscannable: every item had the same silhouette and the same mass, so there
 * was nothing to skim — you read the page or you found nothing. Four cards took
 * about 520 px; the same four rows take about 180.
 *
 * The rule for what goes in here: a control that fits to the right of a name is
 * a row; a control that needs a surface of its own (the format chooser, the API
 * key field, the service list, the delay dial) stays a card.
 */
export function SettingsPanel({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-separator overflow-hidden rounded-xl border border-separator bg-surface">
      {children}
    </div>
  );
}

interface SettingRowProps {
  name: string;
  /** The full reason, folded behind the mark on the label. Nothing is lost —
   * it is one click away and it reads better in a panel than as a paragraph
   * competing with the ten around it. */
  why: string;
  /** Set when the control is tall enough that a vertically centred label reads
   * as floating beside it — the theme tiles, mainly. */
  align?: "center" | "start";
  children: ReactNode;
}

export function SettingRow({ name, why, align = "center", children }: SettingRowProps) {
  const { t } = useTranslation("settings");

  return (
    <div className={cn("flex gap-5 px-4 py-3", align === "center" ? "items-center" : "items-start")}>
      <div className={cn("flex min-w-0 flex-1 items-center gap-1.5", align === "start" && "pt-1")}>
        <span className="min-w-0 text-[0.8125rem] font-medium">{name}</span>
        <FieldHelpPopover label={t("explain")} title={name} tone="muted">
          <p className="text-[0.8125rem] leading-relaxed text-muted">{why}</p>
        </FieldHelpPopover>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** The commonest row of all: a setting whose answer is yes or no. The switch
 * carries the name as its label rather than repeating it — the visible text is
 * to its left, and a second copy inside the control would be read twice. */
export function SwitchRow({
  name,
  why,
  isSelected,
  onChange,
}: {
  name: string;
  why: string;
  isSelected: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <SettingRow name={name} why={why}>
      <Switch isSelected={isSelected} onChange={onChange} aria-label={name} className="mt-0">
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch>
    </SettingRow>
  );
}
