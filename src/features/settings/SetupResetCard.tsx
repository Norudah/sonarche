import { Button, Checkbox } from "@heroui/react";
import { Loader2, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { SETUP_RESET_TARGET_NAMES, type SetupResetTargetName } from "@/features/settings/api";
import { SettingCard } from "@/features/settings/SettingCard";
import { useResetSetupDev } from "@/features/settings/hooks";

/**
 * Replay the first-run walkthrough without losing anything.
 *
 * A checklist rather than one button: re-testing the install does not mean
 * dropping the AcoustID key, and having to paste a real key back after every
 * run would make the reset too expensive to use. Neutral on purpose — the
 * destructive reset lives in its own card, in its own register.
 */
export function SetupResetCard() {
  const { t } = useTranslation("settings");
  const reset = useResetSetupDev();
  const [selected, setSelected] = useState<Set<SetupResetTargetName>>(new Set(["onboarding"]));

  const toggle = (name: SetupResetTargetName, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(name);
      else next.delete(name);
      return next;
    });

  const run = () =>
    reset.mutate(Object.fromEntries(SETUP_RESET_TARGET_NAMES.map((name) => [name, selected.has(name)])));

  return (
    <SettingCard>
      <div className="flex flex-col gap-3">
        <h3 className="font-medium">{t("developer.resetSetup.name")}</h3>
        <p className="max-w-prose text-sm text-muted">{t("developer.resetSetup.why")}</p>

        <div className="flex flex-col gap-2.5 py-1">
          {SETUP_RESET_TARGET_NAMES.map((name) => (
            <Checkbox key={name} isSelected={selected.has(name)} onChange={(on) => toggle(name, on)}>
              <span className="text-sm">
                {t(`developer.resetSetup.targets.${name}.label`)}
                <span className="text-muted"> — {t(`developer.resetSetup.targets.${name}.cost`)}</span>
              </span>
            </Checkbox>
          ))}
        </div>

        <Button
          variant="secondary"
          className="self-start"
          isDisabled={reset.isPending || selected.size === 0}
          onPress={run}
        >
          {reset.isPending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
          {reset.isPending ? t("developer.resetSetup.running") : t("developer.resetSetup.action")}
        </Button>

        {reset.isSuccess && <p className="text-sm text-success">{t("developer.resetSetup.done")}</p>}
        {reset.isError && <p className="text-sm text-danger">{String(reset.error)}</p>}
      </div>
    </SettingCard>
  );
}
