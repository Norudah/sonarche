import { cn, Switch } from "@heroui/react";
import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { clearSettingsHighlight, useSettingsDialog } from "@/shared/lib/settingsDialog";
import { FieldHelpPopover } from "@/shared/ui/FieldHelp";

/** How long the ring a search result leaves stays on. Long enough to be seen
 * after the scroll settles, short enough not to become a selection. */
const FLASH_MS = 1800;

/**
 * Scrolls a setting into view and rings it when a search result named it.
 *
 * Returns the ref to hang on the element and whether it is lit. The clear runs
 * on a timer rather than on the next interaction: the highlight is an answer to
 * "here it is", and an answer that waits to be dismissed is a state.
 */
export function useSettingHighlight(settingKey: string | undefined) {
  const { highlight } = useSettingsDialog();
  const ref = useRef<HTMLDivElement>(null);
  const isLit = settingKey !== undefined && highlight === settingKey;

  useEffect(() => {
    if (!isLit) return;
    ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    const timer = window.setTimeout(clearSettingsHighlight, FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [isLit]);

  return { ref, isLit };
}

/** The ring a revealed setting wears, on a row or on a card. */
export const FLASH = "ring-2 ring-accent/60 ring-offset-2 ring-offset-surface";

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
  /**
   * The setting's i18n base key — `appearance.theme`. The row reads
   * `<key>.name` and `<key>.why` off it rather than taking two strings, which
   * is what lets the search index (built from the same shape) point a result
   * back at this exact row.
   */
  settingKey: string;
  /** Set when the control is tall enough that a vertically centred label reads
   * as floating beside it — the theme tiles, mainly. */
  align?: "center" | "start";
  children: ReactNode;
}

export function SettingRow({ settingKey, align = "center", children }: SettingRowProps) {
  const { t } = useTranslation("settings");
  const { ref, isLit } = useSettingHighlight(settingKey);
  const name = t(`${settingKey}.name`);

  return (
    <div
      ref={ref}
      data-setting={settingKey}
      className={cn(
        "flex gap-5 px-4 py-3 transition-shadow",
        align === "center" ? "items-center" : "items-start",
        isLit && FLASH,
      )}
    >
      <div className={cn("flex min-w-0 flex-1 items-center gap-1.5", align === "start" && "pt-1")}>
        <span className="min-w-0 text-[0.8125rem] font-medium">{name}</span>
        {/* The full reason, folded. Nothing is lost — it is one click away, and
            it reads better in a panel of its own than as a paragraph competing
            with the ten around it. */}
        <FieldHelpPopover label={t("explain")} title={name} tone="muted">
          <p className="text-[0.8125rem] leading-relaxed text-muted">{t(`${settingKey}.why`)}</p>
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
  settingKey,
  isSelected,
  onChange,
}: {
  settingKey: string;
  isSelected: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const { t } = useTranslation("settings");

  return (
    <SettingRow settingKey={settingKey}>
      <Switch isSelected={isSelected} onChange={onChange} aria-label={t(`${settingKey}.name`)} className="mt-0">
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch>
    </SettingRow>
  );
}
