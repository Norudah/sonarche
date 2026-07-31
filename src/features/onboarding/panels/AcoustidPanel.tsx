import { Button, InputGroup } from "@heroui/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ArrowUpRight, KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useSaveAcoustidKey } from "@/features/onboarding/hooks";
import { ActionButton } from "@/shared/ui/ActionLink";

/**
 * The step that is optional and shouldn't feel it.
 *
 * The app runs without a key; it just stops identifying records and starts
 * guessing them. So the argument is made in the words the user will meet again
 * on the download feed — "Identifié" against "Tags devinés" — rather than in
 * praise of fingerprinting, and the way out says what it costs instead of
 * offering a neutral "Skip".
 *
 * The key is checked against AcoustID before it is stored: a typed-in secret
 * that is only ever exercised on the first download is a typo waiting to be
 * discovered late, with nothing on screen to correct.
 */

const ACCOUNT_URL = "https://acoustid.org/login";
const APPLICATION_URL = "https://acoustid.org/new-application";

function LinkRow({ label, hint, url }: { label: string; hint: string; url: string }) {
  const { t } = useTranslation("onboarding");
  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[0.8125rem] font-medium">{label}</p>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      <button
        type="button"
        onClick={() => openUrl(url)}
        className="group/link flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-accent transition-colors outline-none hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        {t("steps.acoustid.open")}
        <ArrowUpRight className="size-3.5 transition-transform duration-200 ease-out group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 motion-reduce:transition-none" />
      </button>
    </div>
  );
}

export function AcoustidPanel({ isConfigured, onSkip }: { isConfigured: boolean; onSkip: () => void }) {
  const { t } = useTranslation("onboarding");
  const [key, setKey] = useState("");
  const save = useSaveAcoustidKey();

  const rejected = save.data && !save.data.valid ? save.data.reason : null;
  const canSubmit = key.trim().length > 0 && !save.isPending;

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-surface p-4 shadow-sm">
      <p className="max-w-prose text-[0.8125rem] leading-relaxed text-muted">{t("steps.acoustid.body")}</p>

      <div className="divide-y divide-separator overflow-hidden rounded-xl bg-panel">
        <LinkRow label={t("steps.acoustid.account.label")} hint={t("steps.acoustid.account.hint")} url={ACCOUNT_URL} />
        <LinkRow
          label={t("steps.acoustid.application.label")}
          hint={t("steps.acoustid.application.hint")}
          url={APPLICATION_URL}
        />
      </div>

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) save.mutate(key.trim());
        }}
      >
        <div className="flex items-stretch gap-2">
          <InputGroup.Root fullWidth className="rounded-xl bg-panel">
            <InputGroup.Prefix className="pr-2.5 pl-3.5 text-muted">
              <KeyRound className="size-4" />
            </InputGroup.Prefix>
            <InputGroup.Input
              type="password"
              autoComplete="off"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              placeholder={isConfigured ? t("steps.acoustid.replace") : t("steps.acoustid.placeholder")}
              aria-label={t("steps.acoustid.fieldLabel")}
              className="py-2.5"
            />
          </InputGroup.Root>
          <Button type="submit" variant="primary" className="shrink-0 rounded-xl px-4" isDisabled={!canSubmit}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            {save.isPending ? t("steps.acoustid.checking") : t("steps.acoustid.check")}
          </Button>
        </div>

        {rejected && <p className="text-[0.8125rem] text-danger">{t(`steps.acoustid.rejected.${rejected}`)}</p>}
        {save.isError && <p className="text-[0.8125rem] text-danger">{t("steps.acoustid.unreachable")}</p>}
      </form>

      {/* Nothing left to pass over once a key is in: the way out only exists
          while the step is still asking. */}
      {!isConfigured && (
        <ActionButton tone="muted" onPress={onSkip} className="self-start">
          {t("steps.acoustid.skip")}
        </ActionButton>
      )}
    </div>
  );
}
