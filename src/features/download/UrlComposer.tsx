import { Button, InputGroup } from "@heroui/react";
import { Download, Link2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { JobKind } from "@/features/download/api";
import { KindChoice } from "@/features/download/KindChoice";
import { SourceBadges } from "@/features/download/SourceBadges";
import { detectUrlKind } from "@/features/download/urlKind";

interface UrlComposerProps {
  onSubmit: (url: string, kind: JobKind) => void;
  isPending: boolean;
  /** Cleared by the page once the job is queued. */
  resetToken: number;
}

export function UrlComposer({ onSubmit, isPending, resetToken }: UrlComposerProps) {
  const { t } = useTranslation("download");
  const [url, setUrl] = useState("");
  // The mixed-URL choice is bound to the URL it was made for: editing the
  // input invalidates it, no effect needed.
  const [mixedChoice, setMixedChoice] = useState<{ url: string; kind: JobKind } | null>(null);
  const [lastReset, setLastReset] = useState(resetToken);

  if (resetToken !== lastReset) {
    setLastReset(resetToken);
    setUrl("");
    setMixedChoice(null);
  }

  const detected = detectUrlKind(url);
  const chosenKind = mixedChoice?.url === url ? mixedChoice.kind : null;
  const kind: JobKind | null =
    detected === "album" ? "album" : detected === "mixed" ? chosenKind : "single";
  const canSubmit = url.trim() !== "" && kind != null && !isPending;

  return (
    <div className="relative -mx-8 -mt-8 overflow-hidden px-8 pt-10 pb-4">
      {/* Vertical fade so the hero dissolves into the page instead of ending on
       * a hard edge; the amber halo keeps the panel from reading duo-tone. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-accent/12 via-accent/5 to-transparent" />
      <div className="pointer-events-none absolute -top-32 -right-24 size-96 rounded-full bg-warning/12 blur-3xl" />

      <div className="relative flex flex-col gap-4">
        <p className="text-xs font-semibold tracking-widest text-accent uppercase">{t("eyebrow")}</p>
        <h1 className="text-4xl font-bold tracking-tight text-balance whitespace-pre-line">
          {t("title")}
        </h1>

        <SourceBadges isYouTubeDetected={detected != null} />

        <form
          className="flex items-center gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) onSubmit(url.trim(), kind);
          }}
        >
          <InputGroup.Root
            fullWidth
            className="rounded-xl border-separator bg-surface shadow-xs focus-within:ring-2 focus-within:ring-accent/30"
          >
            <InputGroup.Prefix className="rounded-l-xl px-4 text-muted">
              <Link2 className="size-4" />
            </InputGroup.Prefix>
            <InputGroup.Input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder={t("urlPlaceholder")}
              aria-label={t("urlLabel")}
              className="py-3"
            />
          </InputGroup.Root>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="rounded-xl px-7 shadow-md shadow-accent/25"
            isDisabled={!canSubmit}
          >
            <Download className="size-4" />
            {t("download")}
          </Button>
        </form>

        {detected === "mixed" && (
          <KindChoice
            value={chosenKind}
            onChange={(next) => setMixedChoice({ url, kind: next })}
          />
        )}
      </div>
    </div>
  );
}
