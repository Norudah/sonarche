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
export function ProvisionalCoverNotice({ onReplace }: { onReplace: () => void }) {
  const { t } = useTranslation("library");

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-warning/45 bg-warning-soft px-3 py-2.5 text-[0.75rem] leading-snug text-warning">
      <p className="flex items-start gap-2">
        <ImageOff className="mt-px size-3.5 shrink-0" />
        {t("albumMetadata.provisionalCover")}
      </p>
      <button
        type="button"
        onClick={onReplace}
        className="self-start cursor-pointer rounded-full border border-warning/40 px-2.5 py-1 font-medium outline-none transition-colors hover:bg-warning/15 focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        {t("albumMetadata.cover.title")}
      </button>
    </div>
  );
}
