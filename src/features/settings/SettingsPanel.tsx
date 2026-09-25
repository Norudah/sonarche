import { cn, Switch } from "@heroui/react";
import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { clearSettingsHighlight, useSettingsDialog } from "@/shared/lib/settingsDialog";
import { FieldHelp } from "@/shared/ui/FieldHelp";

/** Duration of a search result's highlight ring. */
const FLASH_MS = 1800;

/** Scrolls a setting into view and highlights it when search targets it;
 * clears on a timer. */
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

export const FLASH = "ring-2 ring-accent/60 ring-offset-2 ring-offset-surface";

/** Several settings as ruled rows. A control that fits beside a name is a
 * row; one that needs its own surface is a `SettingCard`. */
export function SettingsPanel({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-separator overflow-hidden rounded-xl border border-separator bg-surface">
      {children}
    </div>
  );
}

interface SettingRowProps {
  /** i18n base key (`appearance.theme`): the row reads `.name` and `.why`,
   * and search results point back to it. */
  settingKey: string;
  /** For tall controls (the theme tiles). */
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
        {/* The explanation on hover. Longer delay so crossing rows doesn't fire each one. */}
        <FieldHelp label={t("explain")} delay={450} text={t(`${settingKey}.why`)} />
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** A yes/no setting; the switch is labelled by the visible name. */
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
