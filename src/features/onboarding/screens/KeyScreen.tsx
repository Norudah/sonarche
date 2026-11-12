import { Button, cn, Input } from "@heroui/react";
import { ArrowRight, AudioLines, Clock, ExternalLink, KeyRound, Tag } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { FactList } from "@/features/onboarding/layout/FactList";
import { SetupActionBar, SetupPrimaryButton } from "@/features/onboarding/layout/SetupActionBar";
import { SetupHeader } from "@/features/onboarding/layout/SetupHeader";
import { SetupBody } from "@/features/onboarding/layout/SetupLayout";
import { StageCard, type StageState } from "@/features/onboarding/layout/StageCard";
import type { SetupMode } from "@/features/onboarding/steps";
import type { KeyFlow } from "@/features/onboarding/useKeyFlow";
import { ActionButton } from "@/shared/ui/ActionLink";
import { Verdict } from "@/shared/ui/Verdict";

const FORM_ID = "setup-acoustid-key";
const LINKS = ["account", "application"] as const;

function OpenButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { t } = useTranslation("onboarding");
  return (
    <Button
      variant="secondary"
      size="sm"
      onPress={onPress}
      aria-label={label}
      className="h-[30px] shrink-0 rounded-[9px] bg-surface px-2.5 shadow-xs hover:bg-panel"
    >
      {t("key.open")}
      <ExternalLink className="size-3" />
    </Button>
  );
}

function KeySteps({ flow }: { flow: KeyFlow }) {
  const { t } = useTranslation("onboarding");
  const { view, visited } = flow;
  const verified = view === "verified";

  const pasteState: StageState = verified
    ? "done"
    : view === "rejected"
      ? "error"
      : view === "verifying"
        ? "busy"
        : visited >= LINKS.length
          ? "active"
          : "pending";

  const pasteText =
    view === "rejected" && flow.rejection
      ? t(`key.rejected.${flow.rejection}`)
      : verified
        ? t("key.verified.line")
        : view === "verifying"
          ? t("key.verifyingLine")
          : t("key.steps.paste.text");

  const showField = !verified && visited >= LINKS.length;

  return (
    <StageCard
      compact={verified}
      footer={
        showField && (
          <form
            id={FORM_ID}
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              flow.submit();
            }}
          >
            <Input
              type="password"
              autoComplete="off"
              spellCheck={false}
              autoFocus
              value={flow.value}
              onChange={(event) => flow.edit(event.target.value)}
              placeholder={t("key.field.placeholder")}
              aria-label={t("key.field.label")}
              aria-invalid={view === "rejected" || undefined}
              disabled={view === "verifying"}
              className={cn(
                "h-10 w-full rounded-[10px] font-mono text-[0.8125rem]",
                view === "rejected" && "ring-1 ring-danger",
              )}
            />
            {flow.unreachable && <p className="text-[0.78125rem] text-danger">{t("key.unreachable")}</p>}
          </form>
        )
      }
    >
      {LINKS.map((link, index) => (
        <StageCard.Stage
          key={link}
          number={index + 1}
          state={verified || visited > index ? "done" : visited === index ? "active" : "pending"}
          title={t(`key.steps.${link}.title`)}
          text={verified ? undefined : t(`key.steps.${link}.text`)}
          action={!verified && <OpenButton label={t(`key.steps.${link}.open`)} onPress={() => flow.openLink(index)} />}
        />
      ))}
      <StageCard.Stage number={3} state={pasteState} title={t("key.steps.paste.title")} text={pasteText} />
    </StageCard>
  );
}

function SavedKeyCard() {
  const { t } = useTranslation("onboarding");
  return (
    <div className="mt-[26px] flex items-center gap-3.5 rounded-xl bg-surface px-4 py-3.5 shadow-sm">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-accent-soft text-accent">
        <KeyRound className="size-[18px]" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <strong className="text-sm font-semibold">{t("key.saved.card")}</strong>
        {/* Never read back: that would open the keychain prompt. */}
        <span className="font-mono text-xs tracking-wider text-muted" aria-hidden>
          ••••••••••••
        </span>
      </span>
      <Verdict tone="success">{t("key.saved.status")}</Verdict>
    </div>
  );
}

interface KeyScreenProps {
  mode: SetupMode;
  flow: KeyFlow;
  onBack: (() => void) | null;
  /** Into the app, with or without a key. */
  onEnter: () => void;
}

export function KeyScreen({ mode, flow, onBack, onEnter }: KeyScreenProps) {
  const { t } = useTranslation("onboarding");
  const { t: tCommon } = useTranslation("common");
  const { view } = flow;

  const eyebrow = t(mode === "repair" ? "eyebrow.repair" : "eyebrow.optional");
  const header = {
    intro: { title: t("key.intro.title"), lead: t("key.intro.lead") },
    steps: { title: t("key.steps.title"), lead: t("key.steps.lead") },
    verifying: { title: t("key.steps.title"), lead: t("key.steps.lead") },
    rejected: { title: t("key.rejected.title"), lead: t("key.rejected.lead") },
    verified: { title: t("key.verified.title"), lead: t("key.verified.lead") },
    saved: { title: t("key.saved.title"), lead: t("key.saved.lead") },
  }[view];

  const enter = (
    <SetupPrimaryButton trailingIcon={ArrowRight} onPress={onEnter}>
      {t(`enter.${mode}`, { app: tCommon("appName") })}
    </SetupPrimaryButton>
  );
  // The way out names what it costs (the third fact); a stored key has nothing to skip.
  const skip = !flow.configured && (
    <ActionButton tone="muted" onPress={onEnter}>
      {t("key.skip")}
    </ActionButton>
  );

  let secondary: ReactNode = null;
  let primary: ReactNode;
  switch (view) {
    case "intro":
      secondary = skip;
      primary = <SetupPrimaryButton onPress={flow.start}>{t("key.intro.action")}</SetupPrimaryButton>;
      break;
    case "steps":
    case "rejected":
      secondary = skip;
      primary = (
        <SetupPrimaryButton form={FORM_ID} isDisabled={flow.value.trim() === ""}>
          {t("key.verify")}
        </SetupPrimaryButton>
      );
      break;
    case "verifying":
      primary = <SetupPrimaryButton isPending>{t("key.verifying")}</SetupPrimaryButton>;
      break;
    case "verified":
      primary = enter;
      break;
    case "saved":
      secondary = (
        <ActionButton tone="muted" onPress={flow.change}>
          {t("key.saved.change")}
        </ActionButton>
      );
      primary = enter;
      break;
  }

  return (
    <>
      <SetupBody>
        <SetupHeader eyebrow={eyebrow} title={header.title} lead={header.lead} />

        {view === "intro" && (
          <>
            <FactList
              facts={[
                { icon: AudioLines, title: t("key.facts.sound.title"), text: t("key.facts.sound.text") },
                { icon: Clock, title: t("key.facts.free.title"), text: t("key.facts.free.text") },
                { icon: Tag, title: t("key.facts.guessed.title"), text: t("key.facts.guessed.text") },
              ]}
            />
            <ActionButton tone="accent" onPress={flow.skipToField} className="mt-[18px] ml-[50px] min-h-7">
              {t("key.intro.haveKey")}
            </ActionButton>
          </>
        )}

        {view === "saved" && <SavedKeyCard />}

        {view !== "intro" && view !== "saved" && <KeySteps flow={flow} />}
      </SetupBody>

      <SetupActionBar onBack={onBack} secondary={secondary} primary={primary} />
    </>
  );
}
