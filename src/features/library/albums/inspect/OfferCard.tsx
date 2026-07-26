import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { ArtistOffer, GenreOffer, Offer } from "@/features/library/albums/albumOffers";
import type { LibraryTrack } from "@/features/library/api";

/**
 * What an edit could also change, stated where it happened.
 *
 * The card lives against the row it comments on, and it does not go away when
 * focus moves — the previous panel tied the genre prompt to the cell's focus, so
 * clicking anything at all destroyed the offer while keeping the edit. An offer
 * leaves when it is answered, and only then.
 */

const PRIMARY =
  "cursor-pointer rounded-full bg-accent px-3 py-1.5 text-[0.75rem] font-medium text-accent-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-default disabled:opacity-45";
const SECONDARY =
  "cursor-pointer rounded-full border border-separator px-3 py-1.5 text-[0.75rem] font-medium text-foreground outline-none transition-colors hover:bg-default/60 focus-visible:ring-2 focus-visible:ring-accent/40";
const GHOST =
  "cursor-pointer rounded-full px-2.5 py-1.5 text-[0.75rem] font-medium text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40";

function Eyebrow({ children }: { children: string }) {
  return <p className="text-[0.625rem] font-semibold tracking-wider text-accent uppercase">{children}</p>;
}

function Move({ from, to }: { from: string; to: string }) {
  const { t } = useTranslation("library");
  return (
    <p className="text-[0.8125rem] leading-snug break-words text-muted">
      <span className="text-foreground">{from.trim() === "" ? t("metadata.emptyValue") : from}</span>
      {" → "}
      <span className="font-medium text-foreground">{to}</span>
    </p>
  );
}

function GenreBody({
  offer,
  title,
  onApply,
  onDismiss,
}: {
  offer: GenreOffer;
  title: string;
  onApply: (ids: number[]) => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation("library");

  return (
    <>
      <Eyebrow>{t("albumMetadata.offers.genre.eyebrow", { title })}</Eyebrow>
      <Move from={offer.from} to={offer.to} />
      <p className="text-[0.75rem] leading-snug text-muted">
        {t("albumMetadata.offers.genre.prompt", {
          count: offer.candidateIds.length,
          from: offer.from.trim() === "" ? t("metadata.emptyValue") : offer.from,
        })}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => onApply(offer.candidateIds)} className={PRIMARY}>
          {t("albumMetadata.offers.genre.applySame", { count: offer.candidateIds.length, from: offer.from })}
        </button>
        {/* Only worth offering when it would reach further than the rows already
            sharing the old value. */}
        {offer.allIds.length > offer.candidateIds.length + 1 && (
          <button type="button" onClick={() => onApply(offer.allIds)} className={SECONDARY}>
            {t("albumMetadata.offers.genre.applyAll", { count: offer.allIds.length })}
          </button>
        )}
        <button type="button" onClick={onDismiss} className={GHOST}>
          {t("albumMetadata.offers.genre.dismiss")}
        </button>
      </div>
    </>
  );
}

function ArtistBody({
  offer,
  title,
  tracks,
  onApply,
  onDismiss,
}: {
  offer: ArtistOffer;
  title: string;
  tracks: LibraryTrack[];
  onApply: (ids: number[]) => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation("library");
  const byId = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks]);
  const [selected, setSelected] = useState<Set<number>>(() => new Set(offer.preselectedIds));

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const isFill = offer.kind === "fillArtist";

  return (
    <>
      <Eyebrow>
        {isFill ? t("albumMetadata.offers.artist.fillEyebrow") : t("albumMetadata.offers.artist.eyebrow", { title })}
      </Eyebrow>
      <p className="text-[0.8125rem] leading-snug text-muted">
        {isFill
          ? t("albumMetadata.offers.artist.fillPrompt", { to: offer.to })
          : t("albumMetadata.offers.artist.prompt", { from: offer.from, to: offer.to })}
      </p>

      <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
        {offer.candidateIds.map((id) => {
          const track = byId.get(id);
          return (
            <li key={id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-[0.75rem] hover:bg-default/50">
                <input
                  type="checkbox"
                  checked={selected.has(id)}
                  onChange={() => toggle(id)}
                  className="size-3.5 shrink-0 accent-accent"
                />
                <span className="w-4 shrink-0 text-right tabular-nums text-muted/70">{track?.track ?? ""}</span>
                <span className="min-w-0 flex-1 truncate text-foreground">{track?.title}</span>
                {/* What that row carries today — the reason to leave it alone. */}
                <span className="max-w-28 shrink-0 truncate text-muted/70">{track?.artist}</span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" disabled={selected.size === 0} onClick={() => onApply([...selected])} className={PRIMARY}>
          {t("albumMetadata.offers.artist.apply", { count: selected.size })}
        </button>
        <button type="button" onClick={onDismiss} className={GHOST}>
          {t("albumMetadata.offers.artist.dismiss")}
        </button>
      </div>
    </>
  );
}

export function OfferCard({
  offer,
  tracks,
  onApply,
  onDismiss,
}: {
  offer: Offer;
  tracks: LibraryTrack[];
  /** The rows that take the new value — folded into the same draft, so the whole
   * panel still ships as one save. */
  onApply: (ids: number[], offer: Offer) => void;
  onDismiss: (offer: Offer) => void;
}) {
  const { t } = useTranslation("library");
  const title = tracks.find((track) => track.id === offer.trackId)?.title ?? "";

  return (
    <div className="flex w-[21rem] flex-col gap-2.5 rounded-2xl bg-surface p-4 shadow-xl ring-1 ring-separator">
      {offer.kind === "genre" ? (
        <GenreBody
          offer={offer}
          title={title}
          onApply={(ids) => onApply(ids, offer)}
          onDismiss={() => onDismiss(offer)}
        />
      ) : (
        <ArtistBody
          offer={offer}
          title={title}
          tracks={tracks}
          onApply={(ids) => onApply(ids, offer)}
          onDismiss={() => onDismiss(offer)}
        />
      )}
      <p className="text-[0.6875rem] text-muted/70">{t("albumMetadata.offers.sticky")}</p>
    </div>
  );
}
