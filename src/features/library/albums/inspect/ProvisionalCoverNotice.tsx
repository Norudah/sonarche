import { ImageOff } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * The album wears a video thumbnail, not a cover.
 *
 * A forced album has no MusicBrainz release behind it, so when the media's own
 * artwork can't be found there is nothing to fall back on but the first video's
 * frame. It fills the square and it is wrong, which is exactly the kind of thing
 * that goes unnoticed forever unless the panel says it out loud — the same amber
 * the tag dots use, because it is a thing to fix, not a thing that failed.
 */
export function ProvisionalCoverNotice() {
  const { t } = useTranslation("library");

  return (
    <p className="flex items-start gap-2 rounded-xl border border-dashed border-warning/45 bg-warning-soft px-3 py-2.5 text-[0.75rem] leading-snug text-warning">
      <ImageOff className="mt-px size-3.5 shrink-0" />
      {t("albumMetadata.provisionalCover")}
    </p>
  );
}
