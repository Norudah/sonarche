import { useMemo, useState } from "react";

import type { LibraryTrack } from "@/features/library/api";
import {
  changeSummary,
  commonBaseline,
  commonOrigins,
  distinctCommonCount,
  draftRowCell,
  toAlbumDraft,
  type AlbumCommonBaseline,
  type AlbumCommonField,
  type AlbumCommonValues,
  type AlbumDraft,
  type TrackRowValues,
} from "@/features/library/albums/albumFields";
import { fillArtistOffer, pendingOffers, renumbered, type Offer } from "@/features/library/albums/albumOffers";

/** The album inspector's editable state: the draft over the tracks, and the
 * suggestions ("offers") its edits raise. */
export function useAlbumDraft(tracks: LibraryTrack[]) {
  const baseline = useMemo(() => commonBaseline(tracks), [tracks]);
  const [draft, setDraft] = useState<AlbumDraft>(() => toAlbumDraft(tracks, baseline));
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  // Anchored to the row: offer keys change with every keystroke.
  const [activeRow, setActiveRow] = useState<number | null>(null);
  /** An offer with no row (the album-artist fill). */
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);

  const summary = changeSummary(tracks, baseline, draft);

  // Re-seed from a refetch only when nothing is pending. "Pending" is judged
  // against the tracks the draft came from: against the refetched ones, a
  // re-match's new values would read as edits and saving would revert them.
  const [synced, setSynced] = useState({ tracks, baseline });
  if (tracks !== synced.tracks) {
    const wasClean = changeSummary(synced.tracks, synced.baseline, draft).fields === 0;
    setSynced({ tracks, baseline });
    if (wasClean) setDraft(toAlbumDraft(tracks, baseline));
  }

  const offers = useMemo(() => {
    const raised = pendingOffers(tracks, draft, dismissed);
    const fill = fillArtistOffer(tracks, draft, draft.common.albumartist);
    // The fill only shows once requested.
    return fill && pinnedKey === fill.key ? [fill, ...raised] : raised;
  }, [tracks, draft, dismissed, pinnedKey]);
  const artistFill = fillArtistOffer(tracks, draft, draft.common.albumartist);

  const activeOffer =
    (pinnedKey != null
      ? offers.find((offer) => offer.key === pinnedKey)
      : activeRow != null
        ? offers.find((offer) => offer.trackId === activeRow)
        : undefined) ?? null;

  const closeOffer = () => {
    setActiveRow(null);
    setPinnedKey(null);
  };

  const setCommon = (field: AlbumCommonField, value: string) => {
    // Writing the shared genre or year writes every row.
    if (field === "genre" || field === "year") {
      setDraft((prev) => {
        const rows = { ...prev.rows };
        for (const id of Object.keys(rows)) rows[Number(id)] = { ...rows[Number(id)], [field]: value };
        return { ...prev, rows };
      });
      closeOffer();
      return;
    }
    setDraft((prev) => ({ ...prev, common: { ...prev.common, [field]: value } }));
  };

  const setRow = (id: number, field: keyof TrackRowValues, value: string) => {
    setDraft((prev) => ({ ...prev, rows: { ...prev.rows, [id]: { ...prev.rows[id], [field]: value } } }));
    // Show the offer this edit raised.
    setActiveRow(id);
    setPinnedKey(null);
  };

  const answerOffer = (offer: Offer) => {
    setDismissed((prev) => new Set(prev).add(offer.key));
    closeOffer();
  };

  const applyOffer = (ids: number[], offer: Offer) => {
    const field = offer.kind === "genre" ? "genre" : "artist";
    setDraft((prev) => {
      const rows = { ...prev.rows };
      for (const id of ids) rows[id] = { ...rows[id], [field]: offer.to };
      return { ...prev, rows };
    });
    answerOffer(offer);
  };

  /** From a row's dot or the header counter. */
  const openOffer = (offer: Offer) => {
    if (offer.trackId != null) {
      setActiveRow(offer.trackId);
      setPinnedKey(null);
    } else {
      setPinnedKey(offer.key);
    }
  };

  const copyArtist = () => {
    if (!artistFill) return;
    // Reopen even if answered before.
    setDismissed((prev) => {
      const next = new Set(prev);
      next.delete(artistFill.key);
      return next;
    });
    setPinnedKey(artistFill.key);
  };

  const renumber = () =>
    setDraft((prev) => {
      const rows = { ...prev.rows };
      for (const [id, number] of Object.entries(renumbered(tracks))) {
        rows[Number(id)] = { ...rows[Number(id)], track: number };
      }
      return { ...prev, rows };
    });

  const reset = () => {
    setDraft(toAlbumDraft(tracks, baseline));
    setDismissed(new Set());
    closeOffer();
  };

  return {
    baseline,
    draft,
    summary,
    view: commonView(tracks, baseline, draft),
    offers,
    activeOffer,
    canCopyArtist: artistFill != null,
    setCommon,
    setRow,
    applyOffer,
    answerOffer,
    openOffer,
    copyArtist,
    renumber,
    reset,
    /** After a save, answered offers may be raised again. */
    forgetAnswers: () => setDismissed(new Set()),
  };
}

/** What the identity column shows. Genre and year are read off the rows, so
 * the common field and the column always agree. */
function commonView(tracks: LibraryTrack[], baseline: AlbumCommonBaseline, draft: AlbumDraft) {
  const genreCell = draftRowCell(tracks, draft, "genre");
  const yearCell = draftRowCell(tracks, draft, "year");
  const values: AlbumCommonValues = { ...draft.common, genre: genreCell.value, year: yearCell.value };
  const shownBaseline: AlbumCommonBaseline = {
    ...baseline,
    genre: { value: genreCell.value, mixed: genreCell.mixed },
    year: { value: yearCell.value, mixed: yearCell.mixed },
  };
  const distinctCounts: Partial<Record<AlbumCommonField, number>> = {
    genre: genreCell.distinct,
    year: yearCell.distinct,
    album: distinctCommonCount(tracks, "album"),
    albumartist: distinctCommonCount(tracks, "albumartist"),
    grouping: distinctCommonCount(tracks, "grouping"),
  };
  // A mixed family says nothing useful at album scale.
  const families = new Set(tracks.map((track) => track.genreBucket ?? "").filter(Boolean));
  const genreFamily = families.size === 1 ? [...families][0] : "";

  return {
    values,
    baseline: shownBaseline,
    origins: commonOrigins(tracks, baseline, draft),
    distinctCounts,
    genreFamily,
  };
}
