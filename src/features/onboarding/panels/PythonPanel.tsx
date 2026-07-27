import { Button } from "@heroui/react";
import { Copy, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { PythonInfo } from "@/features/onboarding/api";

/**
 * The one step the app cannot take for the user — for now.
 *
 * Written to be deleted: once a standalone interpreter ships inside the bundle,
 * this panel goes and its step is simply always satisfied.
 */
export interface PythonPanelProps {
  /** The interpreter that was found, or null while there is none. */
  python: PythonInfo | null;
  onRecheck: () => void;
  isChecking: boolean;
}

export function PythonPanel({ python, onRecheck, isChecking }: PythonPanelProps) {
  const { t } = useTranslation("onboarding");
  const [copied, setCopied] = useState(false);
  const command = "brew install python";

  const copy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-sm">
      <p className="max-w-prose text-[0.8125rem] leading-relaxed text-muted">{t("steps.python.body")}</p>

      {/* Re-read after the fact, the question is no longer "how do I install it"
          but "which one did it pick" — a machine can carry four interpreters,
          and the path is the only answer that settles it. */}
      {python ? (
        <div className="rounded-xl bg-panel px-3.5 py-2.5">
          <code className="font-mono text-[0.8125rem] break-all">{python.path}</code>
          <p className="mt-0.5 text-xs text-muted">{t("steps.python.found", { version: python.version })}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 rounded-xl bg-panel p-1.5 pl-3.5">
            <code className="flex-1 font-mono text-[0.8125rem]">{command}</code>
            <button
              type="button"
              onClick={copy}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition-colors outline-none hover:bg-default/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <Copy className="size-3.5" />
              {copied ? t("steps.python.copied") : t("steps.python.copy")}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="secondary" onPress={onRecheck} isDisabled={isChecking}>
              <RefreshCw className={"size-4 " + (isChecking ? "animate-spin" : "")} />
              {t("steps.python.recheck")}
            </Button>
            <p className="text-xs text-muted">{t("steps.python.recheckHint")}</p>
          </div>
        </>
      )}
    </div>
  );
}
