import { Button, toast } from "@heroui/react";
import { useTranslation } from "react-i18next";

import { SettingCard, SettingCardHeader } from "@/features/settings/SettingCard";

/** One button per toast shape, pure `toast.*` calls with no side effects. */
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
  { key: "plain", tone: "secondary", fire: (title: string) => toast(title) },
  // Long, like a raw sidecar error.
  {
    key: "long",
    tone: "secondary",
    fire: (title: string, description: string) => toast.danger(title, { description, timeout: 12000 }),
  },
] as const;

/** Dev bench for toasts, which otherwise only appear after long operations. */
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
