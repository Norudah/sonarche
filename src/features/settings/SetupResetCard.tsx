import { Button, Checkbox } from "@heroui/react";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { SETUP_RESET_TARGET_NAMES, type SetupResetTargetName } from "@/features/settings/api";
import { SettingCard, SettingCardHeader } from "@/features/settings/SettingCard";
import { useResetSetupDev } from "@/features/settings/hooks";

/**
 * Replay the first-run walkthrough without losing anything.
 *
 * A checklist rather than one button: re-testing the install does not mean
 * dropping the AcoustID key, and having to paste a real key back after every
 * run would make the reset too expensive to use. Neutral on purpose — the
 * destructive reset lives in its own card, in its own register.
 *
 * The boxes are drawn now. HeroUI's checkbox is compound like its switch, and
 * this was the app's only call site: a bare `<Checkbox>{label}</Checkbox>`
 * renders the label, the state and the click target, and no box at all — five
 * lines of text you had to guess were selectable, in the one pane whose whole
 * job is being obvious to whoever is testing the app.
 */
export function SetupResetCard() {
  const { t } = useTranslation("settings");
  const reset = useResetSetupDev();
  // The card says "replay the setup", so the default selection has to be one:
  // the flag alone only replays the *screen*, with both engine steps already
  // green — which looks like the button did nothing. The key stays unchecked,
  // being the only item here that costs something real to put back.
  const [selected, setSelected] = useState<Set<SetupResetTargetName>>(new Set(["venv", "tools", "onboarding"]));

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
    <SettingCard settingKey="developer.resetSetup">
      <div className="flex flex-col gap-3">
        <SettingCardHeader title={t("developer.resetSetup.name")} description={t("developer.resetSetup.why")} />

        <div className="flex flex-col gap-2 rounded-lg border border-separator/60 bg-default/30 p-3">
          {SETUP_RESET_TARGET_NAMES.map((name) => (
            <Checkbox key={name} isSelected={selected.has(name)} onChange={(on) => toggle(name, on)}>
              <Checkbox.Content className="items-center gap-2.5">
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <span className="text-[0.8125rem]">
                  {t(`developer.resetSetup.targets.${name}.label`)}
                  <span className="text-muted"> — {t(`developer.resetSetup.targets.${name}.cost`)}</span>
                </span>
              </Checkbox.Content>
            </Checkbox>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Button variant="secondary" isDisabled={reset.isPending || selected.size === 0} onPress={run}>
            {reset.isPending && <Loader2 className="size-4 animate-spin" />}
            {reset.isPending ? t("developer.resetSetup.running") : t("developer.resetSetup.action")}
          </Button>
          {reset.isSuccess && <p className="text-[0.8125rem] text-success">{t("developer.resetSetup.done")}</p>}
          {reset.isError && <p className="text-[0.8125rem] text-danger">{String(reset.error)}</p>}
        </div>
      </div>
    </SettingCard>
  );
}
