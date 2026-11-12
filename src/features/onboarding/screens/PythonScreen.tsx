import { Button } from "@heroui/react";
import { ArrowRight, Copy, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { PythonInfo } from "@/features/onboarding/api";
import { SetupActionBar, SetupPrimaryButton } from "@/features/onboarding/layout/SetupActionBar";
import { SetupHeader } from "@/features/onboarding/layout/SetupHeader";
import { SetupBody } from "@/features/onboarding/layout/SetupLayout";
import { StageCard } from "@/features/onboarding/layout/StageCard";
import type { SetupMode } from "@/features/onboarding/steps";

const COMMAND = "brew install python";

function CommandBox() {
  const { t } = useTranslation("onboarding");
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(COMMAND);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="flex items-center gap-2 rounded-[10px] bg-panel p-1.5 pl-3.5">
      <code className="flex-1 font-mono text-[0.8125rem]">{COMMAND}</code>
      <button
        type="button"
        onClick={() => void copy()}
        className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition-colors outline-none hover:bg-default/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <Copy className="size-3.5" />
        {copied ? t("python.copied") : t("python.copy")}
      </button>
    </div>
  );
}

interface PythonScreenProps {
  mode: SetupMode;
  python: PythonInfo | null;
  onRecheck: () => void;
  isChecking: boolean;
  onBack: (() => void) | null;
  onNext: () => void;
}

/** Only without a bundled interpreter: a degraded case, kept to one stage. */
export function PythonScreen({ mode, python, onRecheck, isChecking, onBack, onNext }: PythonScreenProps) {
  const { t } = useTranslation("onboarding");

  return (
    <>
      <SetupBody>
        <SetupHeader
          eyebrow={t(mode === "repair" ? "eyebrow.repair" : "eyebrow.welcome")}
          title={t("python.title")}
          lead={t("python.lead")}
        />
        <StageCard
          footer={
            !python && (
              <div className="flex flex-col items-start gap-3">
                <CommandBox />
                <Button variant="secondary" onPress={onRecheck} isDisabled={isChecking} className="rounded-xl">
                  <RefreshCw className={"size-4 " + (isChecking ? "animate-spin" : "")} />
                  {t("python.recheck")}
                </Button>
              </div>
            )
          }
        >
          <StageCard.Stage
            number={1}
            state={python ? "done" : "active"}
            title={t("python.stage")}
            text={python ? t("python.found", { version: python.version }) : t("python.hint")}
          />
        </StageCard>
      </SetupBody>

      <SetupActionBar
        onBack={onBack}
        primary={
          <SetupPrimaryButton trailingIcon={ArrowRight} isDisabled={!python} onPress={onNext}>
            {t("continue")}
          </SetupPrimaryButton>
        }
      />
    </>
  );
}
