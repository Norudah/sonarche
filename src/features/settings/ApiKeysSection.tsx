import { Button, Chip, Input, Label, Spinner, TextField } from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { ApiKeyName } from "@/features/settings/api";
import { SettingCard } from "@/features/settings/SettingCard";
import { SettingsHero } from "@/features/settings/SettingsHero";
import { useApiKeys, useSetApiKey } from "@/features/settings/hooks";

/** Keys need an explicit save, so this category owns its own drafts and commit —
 * the only category with a dirty state to track. */
export function ApiKeysSection() {
  const { t } = useTranslation("settings");
  const keys = useApiKeys();
  const setKey = useSetApiKey();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const dirty = Object.values(drafts).some((value) => value.trim() !== "");

  const save = async () => {
    for (const [name, value] of Object.entries(drafts)) {
      if (value.trim()) {
        await setKey.mutateAsync({ name: name as ApiKeyName, value });
      }
    }
    setDrafts({});
  };

  return (
    <>
      <SettingsHero eyebrow={t("title")} title={t("apiKeys.title")} description={t("apiKeys.description")} />

      {keys.isPending ? (
        <Spinner size="sm" aria-label={t("loading")} />
      ) : (
        (keys.data ?? []).map((key) => (
          <SettingCard key={key.name}>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <h3 className="font-medium">{t(`apiKeys.${key.name}.name`)}</h3>
                <Chip variant="soft" size="sm" color={key.configured ? "success" : "default"}>
                  {key.configured ? t("apiKeys.configured") : t("apiKeys.notConfigured")}
                </Chip>
              </div>
              <p className="max-w-prose text-sm text-muted">{t(`apiKeys.${key.name}.why`)}</p>
              <TextField
                value={drafts[key.name] ?? ""}
                onChange={(value) => setDrafts((prev) => ({ ...prev, [key.name]: value }))}
                className="flex flex-col"
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
          </SettingCard>
        ))
      )}

      <div className="flex items-center justify-end gap-3">
        {setKey.isError && <p className="text-sm text-danger">{String(setKey.error)}</p>}
        {setKey.isSuccess && !dirty && <p className="text-sm text-success">{t("saved")}</p>}
        <Button variant="primary" onPress={save} isDisabled={!dirty || setKey.isPending}>
          {setKey.isPending ? t("saving") : t("save")}
        </Button>
      </div>
    </>
  );
}
