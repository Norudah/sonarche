import { Button, Chip, Input, Label, TextField, toast } from "@heroui/react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { ApiKeyStatus } from "@/features/settings/api";
import { SettingCard, SettingCardHeader } from "@/features/settings/SettingCard";
import { useCheckApiKey, useRevealApiKey, useSetApiKey } from "@/features/settings/hooks";

/**
 * One API key: what it buys, the field, and the three things you can do with it.
 *
 * Both action buttons live on the card rather than in a page footer. A footer
 * made sense when saving was one action for the whole screen; it stopped making
 * sense the moment a key could also be *tested*, because a test is about one
 * key and a button floating under the page cannot say which.
 *
 * Test works with nothing typed: it checks the stored key, which is the
 * question someone actually has when they open this screen — "is the key I put
 * in last month still good?".
 *
 * The eye is the answer to the other one. A field showing eight bullets with no
 * way behind them means the only way to check a key is to paste a new one over
 * it — and half the time you paste the same one, having gone to look it up
 * again. Revealing fetches from the keychain on the press and holds the value
 * in component state until it is hidden again; nothing caches it, and nothing
 * reads it on mount (see `useRevealApiKey`), because on macOS a read is a
 * password dialog and a password dialog nobody asked for is the bug this app
 * just spent a release fixing.
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
      // The draft when there is one, the stored key otherwise — testing what
      // is on screen matters more than testing what is filed.
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

  /** Show what is in the field — and put the filed key there first if the
   * field is empty. One control for the two questions people actually have:
   * "what did I just paste" and "what is stored". */
  const toggleReveal = async () => {
    if (revealed) {
      setRevealed(false);
      return;
    }
    try {
      // Only when there is nothing typed: a draft the user is in the middle of
      // pasting must not be overwritten by the stored value.
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
          {/* The field and its actions on one line: the buttons act on what is
              in the box, and a row is the only layout that says so. Heights
              come from the pane, not from here — see `.settings-pane .button`
              in theme.css. */}
          <div className="mt-1.5 flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                type={revealed ? "text" : "password"}
                autoComplete="off"
                placeholder={status.configured ? "••••••••••••" : t("services.placeholder")}
                className="h-8 w-full rounded-xl pr-9 font-mono text-[0.8125rem]"
              />
              {/* Inside the field rather than beside it: it acts on what the
                  field shows, and a fourth control in the button row would be
                  read as a fourth thing you can do to the key. Only offered
                  when there is something filed to reveal. */}
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
