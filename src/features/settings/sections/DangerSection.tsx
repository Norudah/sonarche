import { Button } from "@heroui/react";
import { useTranslation } from "react-i18next";

import { AIMED_ERASES, FULL_ERASE, type EraseDef } from "@/features/settings/erases";
import { SectionHeader } from "@/features/settings/SectionHeader";
import { useSettingsTasks } from "@/features/settings/tasks";

/** One erase with its description always visible. Only the full erase is a
 * solid button; the others are outlined. */
function DangerAction({ def, solid = false }: { def: EraseDef; solid?: boolean }) {
  const { t } = useTranslation("settings");
  const { start } = useSettingsTasks();
  const { key } = def;

  return (
    <div className="flex items-start justify-between gap-4 py-3.5">
      <div className="flex flex-col gap-1">
        <p className="text-[0.8125rem] font-semibold">{t(`danger.${key}.name`)}</p>
        <p className="text-[0.8125rem] leading-relaxed text-muted">{t(`danger.${key}.why`)}</p>
      </div>
      {/* No icon and a fixed minimum width, so the buttons match. */}
      <Button
        variant={solid ? "danger" : "danger-soft"}
        className="mt-0.5 shrink-0"
        onPress={() => start({ kind: "erase", key })}
      >
        {t(`danger.${key}.action`)}
      </Button>
    </div>
  );
}

/** The irreversible actions. The pane only asks; `SettingsTaskHost` confirms
 * and runs them, so they can't be dismissed with the dialog. */
export function DangerSection() {
  const { t } = useTranslation("settings");

  return (
    <>
      <SectionHeader title={t("danger.title")} description={t("danger.description")} />

      <div className="overflow-hidden rounded-xl border border-danger/30 bg-surface">
        <div className="divide-y divide-separator px-4">
          {AIMED_ERASES.map((def) => (
            <DangerAction key={def.key} def={def} />
          ))}
        </div>

        {/* The full erase in its own tinted band. */}
        <div className="border-t border-danger/20 bg-danger/5 px-4">
          <DangerAction def={FULL_ERASE} solid />
        </div>
      </div>
    </>
  );
}
