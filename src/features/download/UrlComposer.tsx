import { Button, InputGroup } from "@heroui/react";
import { Download, Link2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { JobKind } from "@/features/download/api";
import { KindChoice } from "@/features/download/KindChoice";
import { SourceBadges } from "@/features/download/SourceBadges";
import { detectUrlKind } from "@/features/download/urlKind";
import { springs } from "@/shared/motion/tokens";
import { usePopOnActivate } from "@/shared/motion/usePopOnActivate";

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
  const kind: JobKind | null = detected === "album" ? "album" : detected === "mixed" ? chosenKind : "single";
  const canSubmit = url.trim() !== "" && kind != null && !isPending;
  const submitRef = usePopOnActivate<HTMLDivElement>(canSubmit);

  return (
    <div className="relative -mx-8 -mt-8 overflow-hidden px-8 pt-10 pb-4">
      {/* The same accent wash every library hero sits on — `accent-soft` fading
       * to the page background — so this landing band reads as one family with
       * the album, artist and genre headers rather than a screen of its own.
       * Ending on the opaque background (not `transparent`) keeps the ramp in
       * one colour family and dissolves it with no seam; see the library's
       * `HeroWash` for the full reasoning. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-accent-soft/80 via-accent-soft/25 to-background" />

      <div className="relative flex flex-col gap-4">
        <p className="text-[0.6875rem] font-semibold tracking-wider text-accent uppercase">{t("eyebrow")}</p>
        <h1 className="text-4xl font-semibold tracking-tight text-balance whitespace-pre-line">{t("title")}</h1>

        <SourceBadges isYouTubeDetected={detected != null} />

        {/* `items-stretch`, not `items-center`: the input's height comes from its
         * own padding and the button's from its size variant, and the two never
         * matched. Stretching makes the shorter one adopt the taller one's box
         * instead of sitting centred inside it. */}
        <form
          className="flex items-stretch gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) onSubmit(url.trim(), kind);
          }}
        >
          <InputGroup.Root
            fullWidth
            className="rounded-full border-separator bg-surface shadow-xs focus-within:ring-2 focus-within:ring-accent/30"
          >
            <InputGroup.Prefix className="rounded-l-full pr-1 pl-5 text-muted">
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
          {/* The button is the commit point of the whole page, so it gets the
           * most feedback: it swells the moment the form becomes submittable,
           * and gives under the press. */}
          <motion.div
            ref={submitRef}
            whileTap={canSubmit ? { scale: 0.95 } : undefined}
            transition={springs.snappy}
            className="flex"
          >
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="h-full rounded-full px-7 shadow-md shadow-accent/25"
              isDisabled={!canSubmit}
            >
              <Download className="size-4" />
              {t("download")}
            </Button>
          </motion.div>
        </form>

        {/* The choice is a question the page asks; it should arrive rather than
         * appear, and leave rather than vanish, or the form jumps. */}
        <AnimatePresence>
          {detected === "mixed" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={springs.soft}
              className="overflow-hidden"
            >
              <KindChoice value={chosenKind} onChange={(next) => setMixedChoice({ url, kind: next })} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
