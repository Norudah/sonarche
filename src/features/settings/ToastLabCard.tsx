import { Button, toast } from "@heroui/react";
import { useTranslation } from "react-i18next";

import { SettingCard, SettingCardHeader } from "@/features/settings/SettingCard";

/** The six shapes a toast can take in this app, each behind its own button.
 *
 * Every entry is a pure `toast.*` call and nothing else: no mutation, no
 * command, nothing to undo. What is being tested is the strip itself — how a
 * title sits over a description, where the danger red lands next to the amber,
 * whether a long sentence wraps or clips, and how three of them stack over the
 * player bar (`toast-region-lifted`).
 *
 * `tone` is what the button wears; `fire` is the call. Held as data so the row
 * stays a row — a lab of eight hand-written buttons is how the pane it lives in
 * got ugly in the first place. */
const SAMPLES = [
  {
    key: "success",
    tone: "secondary",
    fire: (title: string, description: string) => toast.success(title, { description }),
  },
  {
    key: "danger",
    tone: "danger-soft",
    fire: (title: string, description: string) => toast.danger(title, { description }),
  },
  {
    key: "warning",
    tone: "secondary",
    fire: (title: string, description: string) => toast.warning(title, { description }),
  },
  { key: "info", tone: "secondary", fire: (title: string, description: string) => toast.info(title, { description }) },
  // No description: the one-line form half the app's call sites use.
  { key: "plain", tone: "secondary", fire: (title: string) => toast(title) },
  // Long on purpose — a sidecar error arrives as a raw Python string, and this
  // is the only way to see what the region does with one before it happens.
  {
    key: "long",
    tone: "secondary",
    fire: (title: string, description: string) => toast.danger(title, { description, timeout: 12000 }),
  },
] as const;

/**
 * A bench for the toast strip, in the pane that exists to test the app.
 *
 * Toasts are the one surface nobody can look at on demand: each is the tail of
 * an operation that takes minutes or destroys something, so checking a spacing
 * change meant downloading a playlist or wiping a library. Six buttons make it
 * a glance.
 */
export function ToastLabCard() {
  const { t } = useTranslation("settings");

  return (
    <SettingCard settingKey="developer.toasts">
      <div className="flex flex-col gap-3">
        <SettingCardHeader
          title={t("developer.toasts.name")}
          description={t("developer.toasts.why")}
          trailing={
            <Button variant="secondary" onPress={() => toast.clear()}>
              {t("developer.toasts.clear")}
            </Button>
          }
        />

        <div className="flex flex-wrap gap-2">
          {SAMPLES.map(({ key, tone, fire }) => (
            <Button
              key={key}
              variant={tone}
              onPress={() =>
                fire(t(`developer.toasts.samples.${key}.title`), t(`developer.toasts.samples.${key}.body`))
              }
            >
              {t(`developer.toasts.samples.${key}.label`)}
            </Button>
          ))}
        </div>
      </div>
    </SettingCard>
  );
}
