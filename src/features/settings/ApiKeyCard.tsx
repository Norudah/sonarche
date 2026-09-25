import { Button, Chip, Input, Label, TextField, toast } from "@heroui/react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { ApiKeyStatus } from "@/features/settings/api";
import { SettingCard, SettingCardHeader } from "@/features/settings/SettingCard";
import { useCheckApiKey, useRevealApiKey, useSetApiKey } from "@/features/settings/hooks";

/**
 * One API key: field, test and save. Test without input checks the stored key.
 * Reveal reads the keychain only on press (a read can prompt for a password
 * on macOS) and keeps the value in component state only.
 */
export function ApiKeyCard({ status }: { status: ApiKeyStatus }) {
  const { t } = useTranslation("settings");
  const setKey = useSetApiKey();
  const check = useCheckApiKey();
  const reveal = useRevealApiKey();
  const [draft, setDraft] = useState("");
  const [revealed, setRevealed] = useState(false);

  const typed = draft.trim();
  const canSave = typed !== "";
  const canTest = canSave || status.configured;

  const save = async () => {
    try {
      await setKey.mutateAsync({ name: status.name, value: typed });
      setDraft("");
      setRevealed(false);
      toast.success(t("services.savedTitle"), { description: t(`services.${status.name}.savedDetail`) });
    } catch (error) {
      toast.danger(t("services.saveFailedTitle"), { description: String(error) });
    }
  };

  const test = async () => {
    try {
      // The draft if any, else the stored key.
      const verdict = await check.mutateAsync({ name: status.name, key: typed || undefined });
      if (verdict.valid) {
        toast.success(t("services.testOkTitle"), { description: t("services.testOkDetail") });
      } else {
        toast.danger(t("services.testFailedTitle"), {
          description: t(`services.testReason.${verdict.reason ?? "unknown"}`),
        });
      }
    } catch (error) {
      toast.danger(t("services.testUnreachableTitle"), { description: String(error) });
    }
  };

  /** Toggles visibility, loading the stored key first if the field is empty. */
  const toggleReveal = async () => {
    if (revealed) {
      setRevealed(false);
      return;
    }
    try {
      // Never overwrite a draft in progress.
      if (draft === "" && status.configured) setDraft((await reveal.mutateAsync(status.name)) ?? "");
      setRevealed(true);
    } catch (error) {
      toast.danger(t("services.revealFailedTitle"), { description: String(error) });
    }
  };

  const busy = setKey.isPending || check.isPending;

  return (
    <SettingCard settingKey={`services.${status.name}`}>
      <div className="flex flex-col gap-3">
        <SettingCardHeader
          title={t(`services.${status.name}.name`)}
          description={t(`services.${status.name}.why`)}
          trailing={
            <Chip variant="soft" size="sm" color={status.configured ? "success" : "default"}>
              {status.configured ? t("services.configured") : t("services.notConfigured")}
            </Chip>
          }
        />

        <TextField value={draft} onChange={setDraft} className="flex flex-col">
          <Label className="text-[0.75rem] font-medium text-muted">{t("services.fieldLabel")}</Label>
          {/* Field and actions on one line; heights come from `.settings-pane .button`. */}
          <div className="mt-1.5 flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                type={revealed ? "text" : "password"}
                autoComplete="off"
                placeholder={status.configured ? "••••••••••••" : t("services.placeholder")}
                className="h-8 w-full rounded-xl pr-9 font-mono text-[0.8125rem]"
              />
              {/* Inside the field: it acts on what the field shows. */}
              {(status.configured || draft !== "") && (
                <button
                  type="button"
                  onClick={() => void toggleReveal()}
                  disabled={reveal.isPending}
                  aria-label={revealed ? t("services.hide") : t("services.reveal")}
                  className="absolute inset-y-0 right-0 flex w-9 cursor-pointer items-center justify-center rounded-r-xl text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-default disabled:opacity-40"
                >
                  {reveal.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : revealed ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </button>
              )}
            </div>
            <Button variant="secondary" className="shrink-0" onPress={test} isDisabled={!canTest || busy}>
              {check.isPending && <Loader2 className="size-4 animate-spin" />}
              {t("services.test")}
            </Button>
            <Button variant="primary" className="shrink-0" onPress={save} isDisabled={!canSave || busy}>
              {setKey.isPending && <Loader2 className="size-4 animate-spin" />}
              {t("save")}
            </Button>
          </div>
        </TextField>
      </div>
    </SettingCard>
  );
}
