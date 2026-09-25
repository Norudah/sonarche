import { Button, InputGroup } from "@heroui/react";
import { ArrowDownToLine, AudioLines, Link2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { EnqueueRequest, JobKind } from "@/features/download/api";
import { ComposerSettings } from "@/features/download/ComposerSettings";
import { AUTO_DESTINATION, toForcedAlbum, type Destination } from "@/features/download/DestinationChoice";
import { readLastCategory, writeLastCategory } from "@/features/download/lastCategory";
import { detectUrlKind } from "@/features/download/urlKind";
import { Swap } from "@/shared/motion/Swap";
import { usePopOnActivate } from "@/shared/motion/usePopOnActivate";

interface UrlComposerProps {
  onSubmit: (request: EnqueueRequest) => void;
  isPending: boolean;
  resetToken: number;
}

/** The download form: URL, kind and options in one panel. */
export function UrlComposer({ onSubmit, isPending, resetToken }: UrlComposerProps) {
  const { t } = useTranslation("download");
  const [url, setUrl] = useState("");
  // Bound to the URL it was made for, so editing the input resets it.
  const [choice, setChoice] = useState<{ url: string; kind: JobKind } | null>(null);
  const [category, setCategory] = useState<string | null>(readLastCategory);
  // Not remembered across sessions: a destination is about one link.
  const [destination, setDestination] = useState<Destination>(AUTO_DESTINATION);
  const [singleAlbum, setSingleAlbum] = useState(true);
  const [lastReset, setLastReset] = useState(resetToken);

  if (resetToken !== lastReset) {
    setLastReset(resetToken);
    setUrl("");
    setChoice(null);
    setDestination(AUTO_DESTINATION);
    setSingleAlbum(true);
  }

  const detected = detectUrlKind(url);
  // Ambiguous links default to the album: picking the single drops the rest.
  const forced: JobKind | null = detected === "album" ? "album" : detected === "single" ? "single" : null;
  const kind: JobKind = forced ?? (choice?.url === url ? choice.kind : "album");

  const canSubmit = detected != null && !isPending;
  // On the wrapper: HeroUI's Button owns its transform.
  const submitRef = usePopOnActivate<HTMLDivElement>(canSubmit);

  return (
    <div className="relative -mx-8 -mt-5 overflow-hidden px-8 pt-10 pb-6">
      {/* Same wash as the library heroes (see `HeroWash`). */}
      <div className="pointer-events-none absolute inset-0 hero-wash" />

      <div className="relative flex flex-col gap-5">
        <div>
          <p className="text-[0.6875rem] font-semibold tracking-wider text-accent uppercase">{t("eyebrow")}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance">{t("title")}</h1>
        </div>

        {/* Shadow at rest, lifted with an accent ring on focus. */}
        <form
          className="flex flex-col overflow-hidden rounded-2xl bg-surface shadow-sm transition-shadow focus-within:shadow-md focus-within:ring-1 focus-within:ring-accent/40"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit)
              onSubmit({ url: url.trim(), kind, category, forcedAlbum: toForcedAlbum(destination), singleAlbum });
          }}
        >
          {/* `items-stretch` aligns the input and button heights. */}
          <div className="flex items-stretch gap-2 p-2">
            <InputGroup.Root fullWidth className="border-none bg-transparent shadow-none">
              {/* The link icon turns into the audio mark once a link is recognised. */}
              <InputGroup.Prefix className="pr-3 pl-4 text-muted">
                <Swap swapKey={detected != null ? "recognised" : "idle"} mode="cross" className="flex">
                  {detected != null ? (
                    <AudioLines className="size-[1.125rem] text-accent" />
                  ) : (
                    <Link2 className="size-4" />
                  )}
                </Swap>
              </InputGroup.Prefix>
              <InputGroup.Input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder={t("urlPlaceholder")}
                aria-label={t("urlLabel")}
                className="py-2.5"
              />
            </InputGroup.Root>

            {/* Pops when the form becomes submittable. */}
            <div ref={submitRef} className="flex shrink-0">
              <Button
                type="submit"
                variant="primary"
                className="h-full rounded-xl px-5 transition-transform active:scale-[0.97]"
                isDisabled={!canSubmit}
              >
                <ArrowDownToLine className="size-4" />
                {t("download")}
              </Button>
            </div>
          </div>

          <ComposerSettings
            kind={kind}
            detected={detected}
            onKindChange={(next) => setChoice({ url, kind: next })}
            category={category}
            onCategoryChange={(next) => {
              setCategory(next);
              writeLastCategory(next);
            }}
            destination={destination}
            onDestinationChange={setDestination}
            singleAlbum={singleAlbum}
            onSingleAlbumChange={setSingleAlbum}
          />
        </form>
      </div>
    </div>
  );
}
