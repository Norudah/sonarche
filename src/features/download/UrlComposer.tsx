import { Button, InputGroup } from "@heroui/react";
import { ArrowDownToLine, AudioLines, Link2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { EnqueueRequest, ForcedAlbum, JobKind } from "@/features/download/api";
import { ComposerSettings } from "@/features/download/ComposerSettings";
import { readLastCategory, writeLastCategory } from "@/features/download/lastCategory";
import { detectUrlKind } from "@/features/download/urlKind";
import { Swap } from "@/shared/motion/Swap";
import { usePopOnActivate } from "@/shared/motion/usePopOnActivate";

interface UrlComposerProps {
  onSubmit: (request: EnqueueRequest) => void;
  isPending: boolean;
  /** Cleared by the page once the job is queued. */
  resetToken: number;
}

/**
 * The one control this page exists for.
 *
 * Everything that decides what a link becomes lives in this single panel — the
 * URL, whether it is a set or a track, and the tag it will be filed under —
 * because the alternative is a form whose consequences are scattered across the
 * screen. The panel is the hero: the heading above it is deliberately the same
 * size as every other page's, and the weight goes to the machine, not the copy.
 */
export function UrlComposer({ onSubmit, isPending, resetToken }: UrlComposerProps) {
  const { t } = useTranslation("download");
  const [url, setUrl] = useState("");
  // The kind choice is bound to the URL it was made for: editing the input
  // invalidates it, no effect needed.
  const [choice, setChoice] = useState<{ url: string; kind: JobKind } | null>(null);
  const [category, setCategory] = useState<string | null>(readLastCategory);
  // Deliberately not remembered across sessions, unlike the category: "this
  // playlist is the Inception soundtrack" is true of one download, where "I
  // file game music under Video Games" is a standing habit.
  const [forcedAlbum, setForcedAlbum] = useState<ForcedAlbum | null>(null);
  const [lastReset, setLastReset] = useState(resetToken);

  if (resetToken !== lastReset) {
    setLastReset(resetToken);
    setUrl("");
    setChoice(null);
    setForcedAlbum(null);
  }

  const detected = detectUrlKind(url);
  // A link that can only be read one way decides for itself; anything else
  // takes the user's answer, and failing that the album — a pasted playlist is
  // what people come here with, and picking the single loses the other eleven.
  const forced: JobKind | null = detected === "album" ? "album" : detected === "single" ? "single" : null;
  const kind: JobKind = forced ?? (choice?.url === url ? choice.kind : "album");

  const canSubmit = detected != null && !isPending;
  // On the wrapper rather than the Button: `usePopOnActivate` writes a
  // transform on the element it is handed, and HeroUI's Button owns its own.
  const submitRef = usePopOnActivate<HTMLDivElement>(canSubmit);

  return (
    <div className="relative -mx-8 -mt-5 overflow-hidden px-8 pt-10 pb-6">
      {/* The same accent wash every library hero sits on — `accent-soft` fading
       * to the page background — so this landing band reads as one family with
       * the album, artist and genre headers rather than a screen of its own.
       * Ending on the opaque background (not `transparent`) keeps the ramp in
       * one colour family and dissolves it with no seam; see the library's
       * `HeroWash` for the full reasoning. */}
      <div className="pointer-events-none absolute inset-0 hero-wash" />

      <div className="relative flex flex-col gap-5">
        <div>
          <p className="text-[0.6875rem] font-semibold tracking-wider text-accent uppercase">{t("eyebrow")}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance">{t("title")}</h1>
        </div>

        {/* Lifted by its shadow, never outlined at rest: a hairline ring around
         * a white card sitting on the accent wash draws the box before it draws
         * the field.
         *
         * Focus was answered with a 4px `accent-soft` halo, which at this size
         * read as a second, blurrier shadow bleeding out of the card rather than
         * as "you are typing here". It is now the card itself that reacts — it
         * lifts one step, under a hairline accent ring. Same signal, no glow. */}
        <form
          className="flex flex-col overflow-hidden rounded-2xl bg-surface shadow-sm transition-shadow focus-within:shadow-md focus-within:ring-1 focus-within:ring-accent/40"
          onSubmit={(event) => {
            event.preventDefault();
            // A single has no playlist to gather, and a title-less toggle is a
            // switch left on over an empty field — neither is a forced album.
            const title = forcedAlbum?.title.trim();
            const forced = kind === "album" && title ? { title, artist: forcedAlbum?.artist?.trim() || null } : null;
            if (canSubmit) onSubmit({ url: url.trim(), kind, category, forcedAlbum: forced });
          }}
        >
          {/* `items-stretch`, not `items-center`: the input's height comes from
           * its own padding and the button's from its size variant, and the two
           * never matched. Stretching makes the shorter one adopt the taller
           * one's box instead of sitting centred inside it. */}
          <div className="flex items-stretch gap-2 p-2">
            <InputGroup.Root fullWidth className="border-none bg-transparent shadow-none">
              {/* Recognising the link is the composer's first act, and it is
               * reported where the link is rather than on a badge elsewhere:
               * the neutral chain-link becomes the accent audio mark the
               * moment the paste lands. */}
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

            {/* The commit point of the page, so it gets the most feedback: it
             * swells the moment the form becomes submittable, and gives under
             * the press. */}
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
            forcedAlbum={forcedAlbum}
            onForcedAlbumChange={setForcedAlbum}
          />
        </form>
      </div>
    </div>
  );
}
