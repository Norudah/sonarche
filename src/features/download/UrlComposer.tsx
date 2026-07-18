import { Button, InputGroup, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { Download, Link2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { JobKind } from "@/features/download/api";
import { detectUrlKind } from "@/features/download/urlKind";

function SourceBadge({
  label,
  state,
  isAvailable,
  isActive,
}: {
  label: string;
  state: string;
  isAvailable: boolean;
  isActive?: boolean;
}) {
  return (
    <span
      className={
        "flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
        (isAvailable
          ? "border-separator bg-surface text-foreground shadow-xs"
          : "border-transparent bg-default/50 text-muted")
      }
    >
      {isAvailable && (
        <span className={`size-2 rounded-full ${isActive ? "bg-danger" : "bg-muted/60"}`} />
      )}
      {label} · {state}
    </span>
  );
}

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
    <div className="relative -mx-8 -mt-8 overflow-hidden px-8 pt-10 pb-12">
      {/* Vertical fade so the hero dissolves into the page instead of ending on
       * a hard edge; the amber halo keeps the panel from reading duo-tone. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-accent/12 via-accent/5 to-transparent" />
      <div className="pointer-events-none absolute -top-32 -right-24 size-96 rounded-full bg-warning/12 blur-3xl" />

      <div className="relative flex flex-col gap-5">
        <p className="text-xs font-semibold tracking-widest text-accent uppercase">{t("eyebrow")}</p>
        <h1 className="text-4xl font-bold tracking-tight text-balance whitespace-pre-line">
          {t("title")}
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          <SourceBadge
            label={t("sources.youtube")}
            state={detected ? t("sources.detected") : t("sources.supported")}
            isAvailable
            isActive={detected != null}
          />
          <SourceBadge
            label={t("sources.soundcloud")}
            state={t("sources.soon")}
            isAvailable={false}
          />
        </div>

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
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted">{t("detected.mixed")}</span>
            <ToggleButtonGroup
              size="sm"
              selectionMode="single"
              selectedKeys={chosenKind ? [chosenKind] : []}
              onSelectionChange={(keys) => {
                const [next] = [...keys];
                if (next) setMixedChoice({ url, kind: next as JobKind });
              }}
              className="rounded-lg border border-separator bg-surface p-0.5"
            >
              <ToggleButton id="album">{t("detected.choicePlaylist")}</ToggleButton>
              <ToggleButton id="single">{t("detected.choiceTrack")}</ToggleButton>
            </ToggleButtonGroup>
            {chosenKind == null && <span className="text-xs text-muted">{t("detected.hint")}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
