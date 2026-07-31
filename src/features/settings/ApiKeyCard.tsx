import { Button, Chip, Input, Label, TextField, toast } from "@heroui/react";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { ApiKeyStatus } from "@/features/settings/api";
import { SettingCard } from "@/features/settings/SettingCard";
import { useCheckApiKey, useSetApiKey } from "@/features/settings/hooks";
import { PrimaryButton } from "@/shared/ui/PrimaryButton";

/**
 * One API key: what it buys, the field, and the two things you can do with it.
 *
 * Both buttons live on the card rather than in a page footer. A footer made
 * sense when saving was one action for the whole screen; it stopped making
 * sense the moment a key could also be *tested*, because a test is about one
 * key and a button floating under the page cannot say which.
 *
 * Test works with nothing typed: it checks the stored key, which is the
 * question someone actually has when they open this screen — "is the key I put
 * in last month still good?". The frontend never sees that key; the backend
 * reads it from the keychain and hands it to the sidecar.
 */
export function ApiKeyCard({ status }: { status: ApiKeyStatus }) {
  const { t } = useTranslation("settings");
  const setKey = useSetApiKey();
  const check = useCheckApiKey();
  const [draft, setDraft] = useState("");

  const typed = draft.trim();
  const canSave = typed !== "";
  const canTest = canSave || status.configured;

  const save = async () => {
    try {
      await setKey.mutateAsync({ name: status.name, value: typed });
      setDraft("");
      toast.success(t("apiKeys.savedTitle"), { description: t(`apiKeys.${status.name}.savedDetail`) });
    } catch (error) {
      toast.danger(t("apiKeys.saveFailedTitle"), { description: String(error) });
    }
  };

  const test = async () => {
    try {
      // The draft when there is one, the stored key otherwise — testing what
      // is on screen matters more than testing what is filed.
      const verdict = await check.mutateAsync({ name: status.name, key: typed || undefined });
      if (verdict.valid) {
        toast.success(t("apiKeys.testOkTitle"), { description: t("apiKeys.testOkDetail") });
      } else {
        toast.danger(t("apiKeys.testFailedTitle"), {
          description: t(`apiKeys.testReason.${verdict.reason ?? "unknown"}`),
        });
      }
    } catch (error) {
      toast.danger(t("apiKeys.testUnreachableTitle"), { description: String(error) });
    }
  };

  const busy = setKey.isPending || check.isPending;

  return (
    <SettingCard>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <h3 className="font-medium">{t(`apiKeys.${status.name}.name`)}</h3>
          <Chip variant="soft" size="sm" color={status.configured ? "success" : "default"}>
            {status.configured ? t("apiKeys.configured") : t("apiKeys.notConfigured")}
          </Chip>
        </div>
        <p className="max-w-prose text-sm text-muted">{t(`apiKeys.${status.name}.why`)}</p>

        <TextField value={draft} onChange={setDraft} className="flex flex-col">
          <Label className="text-sm font-medium text-muted">{t("apiKeys.fieldLabel")}</Label>
          {/* The field and its two actions on one line: the buttons act on
              what is in the box, and a row is the only layout that says so. */}
          <div className="mt-1.5 flex items-center gap-2">
            {/* The row is pinned to the primary's 40 px rather than to
                HeroUI's 36: three controls acting on one value have to share a
                baseline, and the one that cannot bend is the accent button. */}
            <Input
              type="password"
              autoComplete="off"
              placeholder={status.configured ? "••••••••••••" : t("apiKeys.placeholder")}
              className="h-10 w-full rounded-xl"
            />
            <Button
              variant="secondary"
              className="h-10 shrink-0 rounded-xl"
              onPress={test}
              isDisabled={!canTest || busy}
            >
              {check.isPending && <Loader2 className="size-4 animate-spin" />}
              {t("apiKeys.test")}
            </Button>
            <PrimaryButton onPress={save} isPending={setKey.isPending} isDisabled={!canSave || busy}>
              {t("save")}
            </PrimaryButton>
          </div>
        </TextField>
      </div>
    </SettingCard>
  );
}
