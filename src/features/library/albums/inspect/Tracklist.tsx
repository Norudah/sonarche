import { ListOrdered, UserRoundCheck, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";

import type { TrackRowValues } from "@/features/library/albums/albumFields";
import type { Offer } from "@/features/library/albums/albumOffers";
import { OfferCard } from "@/features/library/albums/inspect/OfferCard";
import { GRID } from "@/features/library/albums/inspect/tracklistGrid";
import { TracklistRow } from "@/features/library/albums/inspect/TracklistRow";
import type { TrackFilter } from "@/features/library/albums/inspect/trackFilter";
import type { LibraryTrack } from "@/features/library/api";
import { ActionHelp } from "@/shared/ui/FieldHelp";
import { springs } from "@/shared/motion/tokens";

const CAPTION = "text-[0.625rem] font-semibold tracking-wider text-muted uppercase";
const BULK_PILL =
  "flex size-7 cursor-pointer items-center justify-center rounded-full border border-separator bg-surface text-muted outline-none transition-colors hover:bg-default/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-default disabled:opacity-45";

/** Editable tracks. The album artist is shown above the Artist column to make
 * the difference with track artists obvious. */
export function Tracklist({
  tracks,
  allTracks,
  rows,
  originsOf,
  completeIds,
  albumArtist,
  offers,
  activeOffer,
  filter,
  totalCount,
  canCopyArtist,
  onChange,
  onOpenOffer,
  onApplyOffer,
  onDismissOffer,
  onClearFilter,
  onRenumber,
  onCopyArtist,
}: {
  /** Already narrowed when a filter is on. */
  tracks: LibraryTrack[];
  /** Every track, for offers reaching outside the filter. */
  allTracks: LibraryTrack[];
  rows: Record<number, TrackRowValues>;
  originsOf: (track: LibraryTrack) => Partial<TrackRowValues>;
  completeIds: ReadonlySet<number>;
  albumArtist: string;
  offers: Offer[];
  activeOffer: Offer | null;
  filter: TrackFilter | null;
  totalCount: number;
  /** False when every track already has the album artist, or there is none. */
  canCopyArtist: boolean;
  onChange: (id: number, field: keyof TrackRowValues, value: string) => void;
  onOpenOffer: (offer: Offer) => void;
  onApplyOffer: (ids: number[], offer: Offer) => void;
  onDismissOffer: (offer: Offer) => void;
  onClearFilter: () => void;
  onRenumber: () => void;
  onCopyArtist: () => void;
}) {
  const { t } = useTranslation("library");

  // Row -> anchored offer, for the gutter dots.
  const offerByTrack = new Map<number, Offer>();
  for (const offer of offers) {
    if (offer.trackId != null && !offerByTrack.has(offer.trackId)) offerByTrack.set(offer.trackId, offer);
  }

  return (
    <div className="relative flex min-w-0 flex-1 flex-col bg-surface">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-separator/70 px-5 pt-3.5 pb-2.5">
        <h3 className="text-[0.8125rem] font-semibold text-foreground">
          {t("albumMetadata.tracks.heading", { count: totalCount })}
        </h3>
        {albumArtist.trim() !== "" && (
          <p className="min-w-0 text-[0.75rem] text-muted">
            {t("albumMetadata.tracks.filedUnder", { artist: albumArtist })}
          </p>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {/* Reaches offers on rows scrolled or filtered away. */}
          {offers.length > 0 && (
            <button
              type="button"
              onClick={() => onOpenOffer(offers[0])}
              className="flex cursor-pointer items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[0.75rem] font-medium text-accent outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <span className="size-1.5 rounded-full bg-accent" />
              {t("albumMetadata.offers.pending", { count: offers.length })}
            </button>
          )}

          {/* Icon-only, explained on hover. */}
          <ActionHelp text={t("albumMetadata.bulk.renumberHelp", { count: totalCount })}>
            <button
              type="button"
              onClick={onRenumber}
              aria-label={t("albumMetadata.bulk.renumber", { count: totalCount })}
              className={BULK_PILL}
            >
              <ListOrdered className="size-3.5" />
            </button>
          </ActionHelp>
          {/* Opens the checklist with only empty rows ticked; never overwrites a featuring. */}
          <ActionHelp text={t("albumMetadata.bulk.copyArtistHelp")}>
            <button
              type="button"
              disabled={!canCopyArtist}
              onClick={onCopyArtist}
              aria-label={t("albumMetadata.bulk.copyArtist")}
              className={BULK_PILL}
            >
              <UserRoundCheck className="size-3.5" />
            </button>
          </ActionHelp>
        </div>
      </div>

      <AnimatePresence>
        {filter && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springs.snappy}
            className="shrink-0 overflow-hidden bg-warning-soft"
          >
            <div className="flex items-center gap-2 px-5 py-2 text-[0.75rem] text-warning">
              <span className="min-w-0 truncate">
                {t("albumMetadata.tracks.filtered", {
                  label: filter.label,
                  count: tracks.length,
                  total: totalCount,
                })}
              </span>
              <button
                type="button"
                onClick={onClearFilter}
                className="ml-auto flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 font-medium outline-none transition-colors hover:bg-warning/15 focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <X className="size-3" />
                {t("albumMetadata.tracks.clearFilter")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`${GRID} shrink-0 items-center border-b border-separator bg-panel px-5 py-2`}>
        <span />
        <span className={`${CAPTION} text-center`}>{t("columns.number")}</span>
        <span className={CAPTION}>{t("columns.title")}</span>
        <span className={CAPTION}>{t("columns.artist")}</span>
        <span className={`${CAPTION} text-center`}>{t("columns.year")}</span>
        <span className={CAPTION}>{t("columns.genre")}</span>
        <span />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-40">
        {tracks.map((track) => {
          const row = rows[track.id];
          const anchored = activeOffer?.trackId === track.id;
          const pending = offerByTrack.get(track.id);
          return (
            <div key={track.id} className="relative">
              <TracklistRow
                row={row}
                origins={originsOf(track)}
                isComplete={completeIds.has(track.id)}
                hasPendingOffer={pending != null && !anchored}
                isAnchor={anchored}
                onChange={(field, value) => onChange(track.id, field, value)}
                onOpenOffer={() => pending && onOpenOffer(pending)}
              />
              <AnimatePresence>
                {anchored && activeOffer && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={springs.snappy}
                    className="absolute top-full right-4 z-20 origin-top-right pt-1.5"
                  >
                    <OfferCard
                      key={activeOffer.key}
                      offer={activeOffer}
                      tracks={allTracks}
                      onApply={onApplyOffer}
                      onDismiss={onDismissOffer}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Belongs to no row, so it floats over the list. */}
      <AnimatePresence>
        {activeOffer && activeOffer.trackId == null && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={springs.snappy}
            className="absolute right-4 bottom-4 z-20 origin-bottom-right"
          >
            <OfferCard
              key={activeOffer.key}
              offer={activeOffer}
              tracks={allTracks}
              onApply={onApplyOffer}
              onDismiss={onDismissOffer}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
