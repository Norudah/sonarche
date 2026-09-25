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
  draftRowCell,
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
import {
  useArtistImages,
  useLibrary,
  useReenrichAlbum,
  useSetAlbumKind,
  useUpdateTracks,
} from "@/features/library/hooks";
import { ArtworkPlaceholder } from "@/features/library/metadata/ArtworkPlaceholder";

/** Album metadata in one modal: record fields, then tracks, left to right.
 * Always editable; moved fields and the footer count show what changed. */
function InspectBody({
  album,
  onClose,
  requestCloseRef,
}: {
  album: Album;
  onClose: () => void;
  /** Guard-aware close for the modal's backdrop and Escape. */
  requestCloseRef: RefObject<() => void>;
}) {
  const { t } = useTranslation("library");
  const update = useUpdateTracks();
  // Not a tag, so not part of the draft.
  const setKind = useSetAlbumKind();
  const rematch = useReenrichAlbum();

  const baseline = useMemo(() => commonBaseline(album.tracks), [album.tracks]);
  const completion = useMemo(() => albumCompletion(album.tracks), [album.tracks]);
  const [draft, setDraft] = useState<AlbumDraft>(() => toAlbumDraft(album.tracks, baseline));
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  // Anchored to the row: offer keys change with every keystroke.
  const [activeRow, setActiveRow] = useState<number | null>(null);
  /** An offer with no row (the album-artist fill). */
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<TrackFilter | null>(null);
  const [feedback, setFeedback] = useState<SaveFeedback>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isCoverOpen, setIsCoverOpen] = useState(false);
  const [isArtistOpen, setIsArtistOpen] = useState(false);
  const [isRematchConfirmOpen, setIsRematchConfirmOpen] = useState(false);

  const startRematch = () => rematch.mutate(album.tracks.map((track) => track.id));
  const requestRematch = () => {
    if (readRematchConfirm()) setIsRematchConfirmOpen(true);
    else startRematch();
  };

  const { data: libraryTracks } = useLibrary();
  const artistImages = useArtistImages();
  const artist = useMemo(
    () => findArtist(groupArtists(groupAlbums(libraryTracks ?? [])), album.artist),
    [libraryTracks, album.artist],
  );
  const artistImageUrl = (artist && artistImages.data?.get(artist.name)) ?? null;

  const summary = changeSummary(album.tracks, baseline, draft);

  // Re-seed from a refetch only when nothing is pending.
  const [syncedTracks, setSyncedTracks] = useState(album.tracks);
  if (album.tracks !== syncedTracks) {
    setSyncedTracks(album.tracks);
    if (summary.fields === 0) setDraft(toAlbumDraft(album.tracks, baseline));
  }

  const offers = useMemo(() => {
    const raised = pendingOffers(album.tracks, draft, dismissed);
    const fill = fillArtistOffer(album.tracks, draft, draft.common.albumartist);
    // The fill only shows once requested.
    return fill && pinnedKey === fill.key ? [fill, ...raised] : raised;
  }, [album.tracks, draft, dismissed, pinnedKey]);

  const activeOffer =
    (pinnedKey != null
      ? offers.find((offer) => offer.key === pinnedKey)
      : activeRow != null
        ? offers.find((offer) => offer.trackId === activeRow)
        : undefined) ?? null;

  // Read off the rows, so the common field and the column always agree.
  const genreCell = draftRowCell(album.tracks, draft, "genre");
  const yearCell = draftRowCell(album.tracks, draft, "year");
  const shownCommon: AlbumCommonValues = { ...draft.common, genre: genreCell.value, year: yearCell.value };
  const shownBaseline: AlbumCommonBaseline = {
    ...baseline,
    genre: { value: genreCell.value, mixed: genreCell.mixed },
    year: { value: yearCell.value, mixed: yearCell.mixed },
  };
  const distinctCounts: Partial<Record<AlbumCommonField, number>> = {
    genre: genreCell.distinct,
    year: yearCell.distinct,
    album: distinctCommonCount(album.tracks, "album"),
    albumartist: distinctCommonCount(album.tracks, "albumartist"),
    grouping: distinctCommonCount(album.tracks, "grouping"),
  };

  // A mixed family says nothing useful at album scale.
  const families = new Set(album.tracks.map((track) => track.genreBucket ?? "").filter(Boolean));
  const genreFamily = families.size === 1 ? [...families][0] : "";

  const origins = commonOrigins(album.tracks, baseline, draft);

  const setCommon = (field: AlbumCommonField, value: string) => {
    // Writing the shared genre or year writes every row.
    if (field === "genre" || field === "year") {
      setDraft((prev) => {
        const rows = { ...prev.rows };
        for (const id of Object.keys(rows)) rows[Number(id)] = { ...rows[Number(id)], [field]: value };
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
    // Show the offer this edit raised.
    setActiveRow(id);
    setPinnedKey(null);
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

  const answerOffer = (offer: Offer) => {
    setDismissed((prev) => new Set(prev).add(offer.key));
    setActiveRow(null);
    setPinnedKey(null);
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
        // A rename keeps the track ids, through which the record is found again.
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

  /** A pending draft raises the guard. */
  const requestClose = () => {
    if (summary.fields > 0) setIsLeaving(true);
    else onClose();
  };

  // A document-level Escape handler: on macOS a clicked button leaves focus on
  // the body, where element handlers miss it. Overlays handling Escape
  // themselves call preventDefault first.
  const escapeRef = useRef(() => {});
  useEffect(() => {
    requestCloseRef.current = requestClose;
    escapeRef.current = () => {
      // An open suggestion is innermost, so it closes first.
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

  /** ⌘S saves without closing. */
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "s" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      save();
    }
  };

  return (
    <div className="flex h-full flex-col" onKeyDown={onKeyDown}>
      <header className="flex shrink-0 items-center gap-4 border-b border-separator panel-wash px-5 py-3.5">
        {/* Opens the cover modal. */}
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
          kind={album.albumIds.length > 0 ? album.kind : null}
          isKindPending={setKind.isPending}
          onKindChange={(kind) => setKind.mutate({ albumIds: album.albumIds, kind })}
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
            // Reopen even if answered before.
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
        isCollection={album.kind === "collection"}
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
  // Controlled: Escape and backdrop only request a close; the body decides.
  const requestCloseRef = useRef(onClose);
  return (
    <Modal
      isOpen={album != null}
      onOpenChange={(open) => {
        if (!open) requestCloseRef.current();
      }}
    >
      {/* Escape is handled by the body's document listener. */}
      <Modal.Backdrop isKeyboardDismissDisabled>
        <Modal.Container>
          <Modal.Dialog className="flex h-[94vh] max-h-[58rem] w-[97vw] max-w-[80rem] flex-col overflow-hidden p-0!">
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
