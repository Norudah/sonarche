import { useTranslation } from "react-i18next";

/** YouTube's wordmark glyph — the rounded rect + play triangle. Nominative use
 * on the badge that says which sources we can fetch from. */
function YouTubeGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="currentColor">
      <path d="M23.5 6.5a3 3 0 0 0-2.1-2.1C19.5 3.9 12 3.9 12 3.9s-7.5 0-9.4.5A3 3 0 0 0 .5 6.5C0 8.4 0 12 0 12s0 3.6.5 5.5a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.5.5-5.5s0-3.6-.5-5.5ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z" />
    </svg>
  );
}

/** Which sources the composer accepts, and whether the pasted link matched one. */
export function SourceBadges({ isYouTubeDetected }: { isYouTubeDetected: boolean }) {
  const { t } = useTranslation("download");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 rounded-full bg-youtube-soft px-3 py-1 text-xs font-semibold text-youtube">
        <YouTubeGlyph />
        {t("sources.youtube")} ·{" "}
        {isYouTubeDetected ? t("sources.detected") : t("sources.supported")}
      </span>
      <span className="rounded-full bg-default/50 px-3 py-1 text-xs font-medium text-muted">
        {t("sources.soundcloud")} · {t("sources.soon")}
      </span>
    </div>
  );
}
