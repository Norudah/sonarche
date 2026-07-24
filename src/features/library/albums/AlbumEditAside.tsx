import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";

import type { ArtistPropagation } from "@/features/library/albums/albumFields";
import { AlbumArtistPropagation } from "@/features/library/albums/AlbumArtistPropagation";
import { EDIT_ASIDE_CARD } from "@/features/library/albums/editAside";
import type { LibraryTrack } from "@/features/library/api";
import { springs } from "@/shared/motion/tokens";

/** A row's genre edit, and what applying it everywhere would mean. */
export interface GenreOffer {
  trackId: number;
  trackTitle: string;
  from: string;
  to: string;
  /** Tracks the album holds — what "apply everywhere" would touch. */
  count: number;
}

/**
 * The offer to fan a row's genre edit out to the whole record.
 *
 * The buttons act on mousedown, not click: the edited input is still focused,
 * and its blur unmounts this card before a click could ever land.
 */
function GenreCard({
  offer,
  onApplyAll,
  onDismiss,
}: {
  offer: GenreOffer;
  onApplyAll: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation("library");

  return (
    <div className={EDIT_ASIDE_CARD}>
      <div className="flex flex-col gap-1">
        <p className="text-[0.625rem] font-semibold tracking-wider text-accent uppercase">
          {t("metadata.fields.genre")}
        </p>
        <p className="truncate text-[0.8125rem] font-medium text-foreground">{offer.trackTitle}</p>
      </div>

      {/* The change itself, spelled out: what the track carried, what it would
          carry. An empty side reads as the em-dash the fields use. */}
      <p className="text-[0.8125rem] leading-snug text-muted">
        <span className="text-foreground">{offer.from.trim() === "" ? t("metadata.emptyValue") : offer.from}</span>
        {" → "}
        <span className="font-medium text-foreground">{offer.to}</span>
      </p>

      <p className="text-[0.75rem] leading-snug text-muted">{t("albumMetadata.applyGenre.prompt")}</p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onMouseDown={onApplyAll}
          className="cursor-pointer rounded-full bg-accent px-3 py-1 text-[0.75rem] font-medium text-accent-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          {t("albumMetadata.applyGenre.all", { count: offer.count })}
        </button>
        {/* Explicit twin of the implicit blur-dismiss, and the only one that
            works on macOS WebKit, where clicking a button never blurs the
            input. Keeps the edit on this row alone. */}
        <button
          type="button"
          onMouseDown={onDismiss}
          className="cursor-pointer rounded-full px-3 py-1 text-[0.75rem] font-medium text-muted transition-colors hover:text-foreground"
        >
          {t("albumMetadata.applyGenre.one")}
        </button>
      </div>
    </div>
  );
}

/**
 * The drawer's side panel: everything the current edit *could* also change,
 * floating clear of the panel's left edge.
 *
 * It sits outside the drawer on purpose. These offers used to live in the flow
 * — the artist checklist at the bottom of the scroller, the genre prompt inside
 * the tracklist — where they either pushed the tracklist around mid-edit or
 * needed scrolling to be seen at all. Out here they cost the form no layout,
 * stay put while the tracklist scrolls, and read as commentary on the edit
 * rather than as another field to fill.
 *
 * Hidden below `sm`, where the drawer takes the whole width and there is no
 * "beside" to float into.
 */
export function AlbumEditAside({
  genreOffer,
  propagations,
  tracks,
  onApplyGenreAll,
  onDismissGenre,
  onApplyPropagation,
}: {
  genreOffer: GenreOffer | null;
  propagations: ArtistPropagation[];
  tracks: LibraryTrack[];
  onApplyGenreAll: (genre: string) => void;
  onDismissGenre: () => void;
  onApplyPropagation: (ids: number[], artist: string) => void;
}) {
  const hasContent = genreOffer != null || propagations.length > 0;

  return (
    <div className="pointer-events-none absolute top-28 right-[calc(100%+1rem)] hidden w-[19rem] flex-col gap-3 sm:flex">
      <AnimatePresence>
        {hasContent && (
          <motion.div
            initial={{ opacity: 0, x: 12, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 12, scale: 0.96 }}
            transition={springs.snappy}
            className="pointer-events-auto flex flex-col gap-3"
          >
            {genreOffer && (
              <GenreCard
                offer={genreOffer}
                onApplyAll={() => onApplyGenreAll(genreOffer.to)}
                onDismiss={onDismissGenre}
              />
            )}
            <AlbumArtistPropagation propagations={propagations} tracks={tracks} onApply={onApplyPropagation} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
