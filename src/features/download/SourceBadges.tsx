import { cn } from "@heroui/react";
import { useTranslation } from "react-i18next";

import { usePopOnActivate } from "@/shared/motion/usePopOnActivate";

/** YouTube's wordmark glyph — the rounded rect + play triangle. Nominative use
 * on the badge that says which sources we can fetch from. */
function YouTubeGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="currentColor">
      <path d="M23.5 6.5a3 3 0 0 0-2.1-2.1C19.5 3.9 12 3.9 12 3.9s-7.5 0-9.4.5A3 3 0 0 0 .5 6.5C0 8.4 0 12 0 12s0 3.6.5 5.5a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.5.5-5.5s0-3.6-.5-5.5ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z" />
    </svg>
  );
}

/** Which sources the composer accepts, and whether the pasted link matched one.
 *
 * Idle, the YouTube badge is as neutral as the SoundCloud one: it is only
 * stating a capability, and colouring it red permanently spent the signal for
 * nothing. The brand colour is the *reward* for pasting a link we recognise —
 * so it lands with a pop the moment detection flips. */
export function SourceBadges({ isYouTubeDetected }: { isYouTubeDetected: boolean }) {
  const { t } = useTranslation("download");
  const badgeRef = usePopOnActivate<HTMLSpanElement>(isYouTubeDetected);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        ref={badgeRef}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors",
          isYouTubeDetected ? "bg-youtube-soft font-semibold text-youtube" : "bg-default/50 font-medium text-muted",
        )}
      >
        <YouTubeGlyph />
        {t("sources.youtube")} · {isYouTubeDetected ? t("sources.detected") : t("sources.supported")}
      </span>
      <span className="rounded-full bg-default/50 px-3 py-1 text-xs font-medium text-muted">
        {t("sources.soundcloud")} · {t("sources.soon")}
      </span>
    </div>
  );
}
