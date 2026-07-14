import { Chip, Input, Label, TextField } from "@heroui/react";
import { useTranslation } from "react-i18next";

import type { ApiKeyName, ApiKeyStatus } from "@/features/settings/api";

interface ApiKeysSectionProps {
  keys: ApiKeyStatus[];
  drafts: Record<string, string>;
  onDraftChange: (name: ApiKeyName, value: string) => void;
}

export function ApiKeysSection({ keys, drafts, onDraftChange }: ApiKeysSectionProps) {
  const { t } = useTranslation("settings");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-lg font-semibold">{t("apiKeys.title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("apiKeys.description")}</p>
      </div>

      {keys.map((key) => (
        <div key={key.name} className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <h3 className="font-medium">{t(`apiKeys.${key.name}.name`)}</h3>
            <Chip variant="soft" size="sm" color={key.configured ? "success" : "default"}>
              {key.configured ? t("apiKeys.configured") : t("apiKeys.notConfigured")}
            </Chip>
          </div>
          <p className="max-w-prose text-sm text-muted">{t(`apiKeys.${key.name}.why`)}</p>
          <TextField
            value={drafts[key.name] ?? ""}
            onChange={(value) => onDraftChange(key.name, value)}
            className="flex max-w-lg flex-col"
          >
            <Label className="text-sm font-medium text-muted">{t("apiKeys.fieldLabel")}</Label>
            <Input
              type="password"
              autoComplete="off"
              placeholder={key.configured ? "••••••••••••" : t("apiKeys.placeholder")}
              className="mt-1.5 w-full rounded-xl"
            />
          </TextField>
        </div>
      ))}
    </div>
  );
}
