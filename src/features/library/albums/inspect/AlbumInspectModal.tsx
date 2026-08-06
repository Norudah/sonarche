import { Modal } from "@heroui/react";
import { ImagePlus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";

import { groupAlbums, type Album } from "@/features/library/albums/albums";
import { albumCompletion } from "@/features/library/albums/albumCompletion";
import {
  buildAlbumUpdates,
  changeSummary,
  commonBaseline,
  commonOrigins,
  distinctCommonCount,
  draftGenreCell,
  rowOrigins,
  toAlbumDraft,
  type AlbumCommonBaseline,
  type AlbumCommonField,
  type AlbumCommonValues,
  type AlbumDraft,
  type TrackRowValues,
} from "@/features/library/albums/albumFields";
import { fillArtistOffer, pendingOffers, renumbered, type Offer } from "@/features/library/albums/albumOffers";
import { findArtist, groupArtists } from "@/features/library/artists/artists";
import { ArtistImageButton } from "@/features/library/artists/ArtistImageButton";
import { ArtistImageModal } from "@/features/library/artists/ArtistImageModal";
import { ExitGuardDialog } from "@/features/library/metadata/ExitGuardDialog";
import { MetadataSuggestionsProvider } from "@/features/library/metadata/SuggestionsContext";
import { RematchConfirmDialog } from "@/features/library/metadata/RematchConfirmDialog";
import { readRematchConfirm } from "@/shared/lib/rematchConfirm";
import { IdentityColumn } from "@/features/library/albums/inspect/IdentityColumn";
import { InspectFooter, type SaveFeedback } from "@/features/library/albums/inspect/InspectFooter";
import { PendingBadge } from "@/features/library/metadata/PendingBadge";
import { Tracklist } from "@/features/library/albums/inspect/Tracklist";
import { applyTrackFilter, type TrackFilter } from "@/features/library/albums/inspect/trackFilter";
import { CoverReplaceModal } from "@/features/library/covers/CoverReplaceModal";
import { useArtistImages, useLibrary, useReenrichAlbum, useUpdateTracks } from "@/features/library/hooks";
import { ArtworkPlaceholder } from "@/features/library/metadata/ArtworkPlaceholder";

/**
 * Album metadata, edited in one place.
 *
 * A modal rather than the old 40rem drawer: the panel holds a block of shared
 * fields *and* a table of N rows *and* the consequences of editing them, which a
 * single 640 px column turned into three screens of scrolling with half the
 * window sitting unused behind it. Left to right it reads record → tracks, so
 * anything more specific than a track would open further right still.
 *
 * There is no read mode. Everything is editable, and what the panel makes
 * visible is not "can you type here" but "what have you changed" — the accent
 * rules on moved fields, and the count in the footer that adds them up.
 */
function InspectBody({
  album,
  onClose,
  requestCloseRef,
}: {
  album: Album;
  onClose: () => void;
  /** Where the Modal's own dismiss gestures (backdrop, Escape) find the
   * guard-aware close — only this body knows whether a draft is at stake. */
  requestCloseRef: RefObject<() => void>;
}) {
  const { t } = useTranslation("library");
  const update = useUpdateTracks();
  const rematch = useReenrichAlbum();

  const baseline = useMemo(() => commonBaseline(album.tracks), [album.tracks]);
  const completion = useMemo(() => albumCompletion(album.tracks), [album.tracks]);
  const [draft, setDraft] = useState<AlbumDraft>(() => toAlbumDraft(album.tracks, baseline));
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  // The row whose consequences are on screen. Anchored to the *row* rather than
  // to an offer's key on purpose: the key changes with every keystroke (it is
  // derived from the value being typed), so pinning the key would make the card
  // flicker in and out letter by letter.
  const [activeRow, setActiveRow] = useState<number | null>(null);
  /** An offer belonging to no row — the album-artist fill. */
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<TrackFilter | null>(null);
  const [feedback, setFeedback] = useState<SaveFeedback>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isCoverOpen, setIsCoverOpen] = useState(false);
  const [isArtistOpen, setIsArtistOpen] = useState(false);
  const [isRematchConfirmOpen, setIsRematchConfirmOpen] = useState(false);

  const startRematch = () => rematch.mutate(album.tracks.map((track) => track.id));
  // The dialog is the default; the preference (or its own switch) silences it.
  const requestRematch = () => {
    if (readRematchConfirm()) setIsRematchConfirmOpen(true);
    else startRematch();
  };

  // The record's artist, resolved on the shelf — their disc sits beside the
  // cover in the header and opens the same image modal as the artist page.
  const { data: libraryTracks } = useLibrary();
  const artistImages = useArtistImages();
  const artist = useMemo(
    () => findArtist(groupArtists(groupAlbums(libraryTracks ?? [])), album.artist),
    [libraryTracks, album.artist],
  );
  const artistImageUrl = (artist && artistImages.data?.get(artist.name)) ?? null;

  const summary = changeSummary(album.tracks, baseline, draft);

  // The library refetches after a save (and after a re-match), handing us a new
  // tracks array. Re-seed the draft from it — but only when nothing is pending,
  // so a refetch can never swallow an edit in progress.
  const [syncedTracks, setSyncedTracks] = useState(album.tracks);
  if (album.tracks !== syncedTracks) {
    setSyncedTracks(album.tracks);
    if (summary.fields === 0) setDraft(toAlbumDraft(album.tracks, baseline));
  }

  const offers = useMemo(() => {
    const raised = pendingOffers(album.tracks, draft, dismissed);
    const fill = fillArtistOffer(album.tracks, draft, draft.common.albumartist);
    // The fill only shows once asked for: it is a bulk action, not something the
    // record raises on its own.
    return fill && pinnedKey === fill.key ? [fill, ...raised] : raised;
  }, [album.tracks, draft, dismissed, pinnedKey]);

  const activeOffer =
    (pinnedKey != null
      ? offers.find((offer) => offer.key === pinnedKey)
      : activeRow != null
        ? offers.find((offer) => offer.trackId === activeRow)
        : undefined) ?? null;

  // Genre is read off the rows rather than held beside them, so the common field
  // and the column can never show two different answers.
  const genreCell = draftGenreCell(album.tracks, draft);
  const shownCommon: AlbumCommonValues = { ...draft.common, genre: genreCell.value };
  const shownBaseline: AlbumCommonBaseline = { ...baseline, genre: { value: genreCell.value, mixed: genreCell.mixed } };
  const distinctCounts: Partial<Record<AlbumCommonField, number>> = {
    genre: genreCell.distinct,
    album: distinctCommonCount(album.tracks, "album"),
    albumartist: distinctCommonCount(album.tracks, "albumartist"),
    year: distinctCommonCount(album.tracks, "year"),
    grouping: distinctCommonCount(album.tracks, "grouping"),
  };

  // One family, or none stated: at the album's scale a mixed family says
  // nothing actionable, since the genre it derives from is right above it.
  const families = new Set(album.tracks.map((track) => track.genreBucket ?? "").filter(Boolean));
  const genreFamily = families.size === 1 ? [...families][0] : "";

  const origins = commonOrigins(album.tracks, baseline, draft);

  const setCommon = (field: AlbumCommonField, value: string) => {
    // Writing the shared genre *is* writing every row's genre — the field is a
    // shortcut into the column, not a value of its own.
    if (field === "genre") {
      setDraft((prev) => {
        const rows = { ...prev.rows };
        for (const id of Object.keys(rows)) rows[Number(id)] = { ...rows[Number(id)], genre: value };
        return { ...prev, rows };
      });
      setActiveRow(null);
      setPinnedKey(null);
      return;
    }
    setDraft((prev) => ({ ...prev, common: { ...prev.common, [field]: value } }));
  };

  const setRow = (id: number, field: keyof TrackRowValues, value: string) => {
    setDraft((prev) => ({ ...prev, rows: { ...prev.rows, [id]: { ...prev.rows[id], [field]: value } } }));
    // Typing here is what raises a consequence, so this is where it gets shown —
    // the user should not have to go looking for the offer their own edit made.
    setActiveRow(id);
    setPinnedKey(null);
  };

  const applyOffer = (ids: number[], offer: Offer) => {
    const field = offer.kind === "genre" ? "genre" : "artist";
    setDraft((prev) => {
      const rows = { ...prev.rows };
      for (const id of ids) rows[id] = { ...rows[id], [field]: offer.to };
      // Nothing to mirror into the common block: the shared genre is read off
      // these very rows, so it already says whatever they now say.
      return { ...prev, rows };
    });
    answerOffer(offer);
  };

  const answerOffer = (offer: Offer) => {
    setDismissed((prev) => new Set(prev).add(offer.key));
    setActiveRow(null);
    setPinnedKey(null);
  };

  /** Bring an offer back on screen — from a row's dot, or the header counter. */
  const openOffer = (offer: Offer) => {
    if (offer.trackId != null) {
      setActiveRow(offer.trackId);
      setPinnedKey(null);
    } else {
      setPinnedKey(offer.key);
    }
  };

  const renumber = () =>
    setDraft((prev) => {
      const rows = { ...prev.rows };
      for (const [id, number] of Object.entries(renumbered(album.tracks))) {
        rows[Number(id)] = { ...rows[Number(id)], track: number };
      }
      return { ...prev, rows };
    });

  const save = () => {
    const updates = buildAlbumUpdates(album.tracks, baseline, draft);
    if (updates.length === 0) return;
    setFeedback(null);
    update.mutate(updates, {
      onSuccess: () => {
        setFeedback({ kind: "saved", tracks: updates.length });
        setDismissed(new Set());
        // Nothing to do about a rename here: the record keeps its track ids, and
        // the surfaces that hold it (the album route, the shelf's open panel)
        // find it again through those.
        if (isLeaving) onClose();
      },
      onError: () => {
        setFeedback({ kind: "failed" });
        setIsLeaving(false);
      },
    });
  };

  const discard = () => {
    setDraft(toAlbumDraft(album.tracks, baseline));
    setDismissed(new Set());
    setActiveRow(null);
    setPinnedKey(null);
    setIsLeaving(false);
  };

  /** Closing with a pending draft raises the guard instead of dropping it. */
  const requestClose = () => {
    if (summary.fields > 0) setIsLeaving(true);
    else onClose();
  };

  // The backdrop click lands on the Modal, outside this body; hand it the
  // current requestClose so that gesture meets the same guard as the ✕.
  // Escape rides the same effect: on macOS a button click leaves focus on the
  // body — outside both this tree and react-aria's overlay — so an element
  // handler misses the key. One document listener owns it instead; overlays
  // that answer Escape themselves (help popovers, the guard) preventDefault
  // first, and `isKeyboardDismissDisabled` keeps react-aria from competing.
  const escapeRef = useRef(() => {});
  useEffect(() => {
    requestCloseRef.current = requestClose;
    escapeRef.current = () => {
      // An open suggestion is the innermost thing on screen, so it goes first.
      if (activeOffer) answerOffer(activeOffer);
      else requestClose();
    };
  });
  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) escapeRef.current();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, []);

  const shown = applyTrackFilter(album.tracks, filter);
  const completeIds = useMemo(() => {
    const incomplete = new Set(completion.incompleteIds);
    return new Set(album.tracks.map((track) => track.id).filter((id) => !incomplete.has(id)));
  }, [album.tracks, completion.incompleteIds]);

  /** ⌘S writes without leaving. Escape lives on the document, above. */
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "s" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      save();
    }
  };

  return (
    <div className="flex h-full flex-col" onKeyDown={onKeyDown}>
      <header className="flex shrink-0 items-center gap-4 border-b border-separator panel-wash px-5 py-3.5">
        {/* The cover is the way to the cover: hover says so, and the same
            modal is reachable from the provisional-cover notice below. */}
        <button
          type="button"
          onClick={() => setIsCoverOpen(true)}
          aria-label={t("albumMetadata.cover.title")}
          className="group relative size-11 shrink-0 cursor-pointer overflow-hidden rounded-lg outline-none ring-1 ring-artwork-edge focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          {album.artUrl ? (
            <img src={album.artUrl} alt="" className="size-full object-cover" />
          ) : (
            <ArtworkPlaceholder className="size-full" />
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <ImagePlus className="size-4 text-white" />
          </span>
        </button>
        {artist && (
          <ArtistImageButton
            family={artist.family}
            imageUrl={artistImageUrl}
            label={t("artists.image.title")}
            onClick={() => setIsArtistOpen(true)}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[0.625rem] font-semibold tracking-wider text-accent uppercase">
            {t("albumMetadata.eyebrow")}
          </p>
          <h2 className="mt-0.5 truncate text-[1.0625rem] leading-tight font-semibold tracking-tight text-foreground">
            {album.title}
            <span className="ml-2 text-[0.8125rem] font-normal text-muted">
              {t("trackCount", { count: album.tracks.length })}
              {album.year != null && ` · ${album.year}`}
            </span>
          </h2>
        </div>
        <PendingBadge fields={summary.fields} tracks={summary.tracks} />
        <button
          type="button"
          onClick={requestClose}
          aria-label={t("metadata.close")}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-default/60 text-muted outline-none transition-colors hover:bg-default hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <IdentityColumn
          completion={completion}
          baseline={shownBaseline}
          values={shownCommon}
          origins={origins}
          distinctCounts={distinctCounts}
          genreFamily={genreFamily}
          trackCount={album.tracks.length}
          soundtrack={album.tracks.some((track) => track.soundtrack)}
          hasProvisionalCover={album.tracks.some((track) => track.provisionalCover)}
          filter={filter}
          onFilter={setFilter}
          onChange={setCommon}
          onRevert={(field) => setCommon(field, baseline[field].value)}
          onReplaceCover={() => setIsCoverOpen(true)}
        />

        <Tracklist
          tracks={shown}
          allTracks={album.tracks}
          rows={draft.rows}
          originsOf={(track) => rowOrigins(track, draft.rows[track.id])}
          completeIds={completeIds}
          albumArtist={draft.common.albumartist}
          offers={offers}
          activeOffer={activeOffer}
          filter={filter}
          totalCount={album.tracks.length}
          canCopyArtist={fillArtistOffer(album.tracks, draft, draft.common.albumartist) != null}
          onChange={setRow}
          onOpenOffer={openOffer}
          onApplyOffer={applyOffer}
          onDismissOffer={answerOffer}
          onClearFilter={() => setFilter(null)}
          onRenumber={renumber}
          onCopyArtist={() => {
            const fill = fillArtistOffer(album.tracks, draft, draft.common.albumartist);
            if (!fill) return;
            // Re-open it even if it was answered earlier: asking again is the
            // whole point of pressing the button a second time.
            setDismissed((prev) => {
              const next = new Set(prev);
              next.delete(fill.key);
              return next;
            });
            setPinnedKey(fill.key);
          }}
        />
      </div>

      <InspectFooter
        summary={summary}
        feedback={feedback}
        isSaving={update.isPending}
        rematchProgress={rematch.progress}
        rematchOutcome={
          rematch.isError ? { kind: "failed" } : rematch.isSuccess ? { kind: "finished", ...rematch.data } : null
        }
        isCancellingRematch={rematch.isCancelling}
        onRematch={requestRematch}
        onCancelRematch={rematch.cancel}
        onDiscard={discard}
        onSave={save}
        onDismissFeedback={() => setFeedback(null)}
      />

      <ExitGuardDialog
        pendingFields={isLeaving ? summary.fields : 0}
        isSaving={update.isPending}
        onKeepEditing={() => setIsLeaving(false)}
        onDiscard={() => {
          discard();
          onClose();
        }}
        onSave={save}
      />

      <RematchConfirmDialog
        scope="album"
        isOpen={isRematchConfirmOpen}
        onClose={() => setIsRematchConfirmOpen(false)}
        onConfirm={() => {
          setIsRematchConfirmOpen(false);
          startRematch();
        }}
      />

      <CoverReplaceModal album={album} isOpen={isCoverOpen} onClose={() => setIsCoverOpen(false)} />
      {artist && (
        <ArtistImageModal
          artist={artist}
          imageUrl={artistImageUrl}
          isOpen={isArtistOpen}
          onClose={() => setIsArtistOpen(false)}
        />
      )}
    </div>
  );
}

export function AlbumInspectModal({ album, onClose }: { album: Album | null; onClose: () => void }) {
  // `isOpen` is controlled, so react-aria can never close this on its own
  // terms: Escape and the backdrop click only *request* it, and the body
  // answers — straight close, or the exit guard when a draft is at stake.
  const requestCloseRef = useRef(onClose);
  return (
    <Modal
      isOpen={album != null}
      onOpenChange={(open) => {
        if (!open) requestCloseRef.current();
      }}
    >
      {/* Keyboard dismiss stays off: Escape is handled by the body's own
          document listener (react-aria's would miss it whenever focus sits on
          the body, and would double-handle it whenever it does not). */}
      <Modal.Backdrop isKeyboardDismissDisabled>
        <Modal.Container>
          <Modal.Dialog className="flex h-[92vh] max-h-[54rem] w-[96vw] max-w-[74rem] flex-col overflow-hidden p-0!">
            {album && (
              <MetadataSuggestionsProvider>
                <InspectBody key={album.key} album={album} onClose={onClose} requestCloseRef={requestCloseRef} />
              </MetadataSuggestionsProvider>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
