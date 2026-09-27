import { Modal } from "@heroui/react";
import { useEffect, useEffectEvent, useMemo, useRef, useState, type RefObject } from "react";

import { groupAlbums, type Album } from "@/features/library/albums/albums";
import { albumCompletion } from "@/features/library/albums/albumCompletion";
import { buildAlbumUpdates, rowOrigins } from "@/features/library/albums/albumFields";
import { IdentityColumn } from "@/features/library/albums/inspect/IdentityColumn";
import { InspectFooter } from "@/features/library/albums/inspect/InspectFooter";
import type { SaveFeedback } from "@/features/library/metadata/EditorFooter";
import { InspectHeader } from "@/features/library/albums/inspect/InspectHeader";
import { Tracklist } from "@/features/library/albums/inspect/Tracklist";
import { applyTrackFilter, type TrackFilter } from "@/features/library/albums/inspect/trackFilter";
import { useAlbumDraft } from "@/features/library/albums/inspect/useAlbumDraft";
import { findArtist, groupArtists } from "@/features/library/artists/artists";
import { ArtistImageModal } from "@/features/library/artists/ArtistImageModal";
import { CoverReplaceModal } from "@/features/library/covers/CoverReplaceModal";
import {
  useArtistImages,
  useLibrary,
  useReenrichAlbum,
  useSetAlbumKind,
  useUpdateTracks,
} from "@/features/library/hooks";
import { ExitGuardDialog } from "@/features/library/metadata/ExitGuardDialog";
import { RematchConfirmDialog } from "@/features/library/metadata/RematchConfirmDialog";
import { MetadataSuggestionsProvider } from "@/features/library/metadata/SuggestionsContext";
import { readRematchConfirm } from "@/shared/lib/rematchConfirm";

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
  const update = useUpdateTracks();
  // Not a tag, so not part of the draft.
  const setKind = useSetAlbumKind();
  const rematch = useReenrichAlbum();
  const edit = useAlbumDraft(album.tracks);
  const { summary } = edit;

  const completion = useMemo(() => albumCompletion(album.tracks), [album.tracks]);
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

  const save = () => {
    const updates = buildAlbumUpdates(album.tracks, edit.baseline, edit.draft);
    if (updates.length === 0) return;
    setFeedback(null);
    update.mutate(updates, {
      onSuccess: () => {
        setFeedback({ kind: "saved", tracks: updates.length });
        edit.forgetAnswers();
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
    edit.reset();
    setIsLeaving(false);
  };

  /** A pending draft raises the guard. */
  const requestClose = () => {
    if (summary.fields > 0) setIsLeaving(true);
    else onClose();
  };

  useEffect(() => {
    requestCloseRef.current = requestClose;
  });
  // A document-level Escape handler: on macOS a clicked button leaves focus on
  // the body, where element handlers miss it. Overlays handling Escape
  // themselves call preventDefault first.
  const onEscape = useEffectEvent(() => {
    // An open suggestion is innermost, so it closes first.
    if (edit.activeOffer) edit.answerOffer(edit.activeOffer);
    else requestClose();
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) onEscape();
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
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
      <InspectHeader
        album={album}
        pending={summary}
        artistImage={artist ? { url: artistImageUrl } : undefined}
        onOpenCover={() => setIsCoverOpen(true)}
        onOpenArtistImage={() => setIsArtistOpen(true)}
        onClose={requestClose}
      />

      <div className="flex min-h-0 flex-1">
        <IdentityColumn
          completion={completion}
          baseline={edit.view.baseline}
          values={edit.view.values}
          origins={edit.view.origins}
          distinctCounts={edit.view.distinctCounts}
          genreFamily={edit.view.genreFamily}
          trackCount={album.tracks.length}
          soundtrack={album.tracks.some((track) => track.soundtrack)}
          kind={album.albumIds.length > 0 ? album.kind : null}
          isKindPending={setKind.isPending}
          onKindChange={(kind) => setKind.mutate({ albumIds: album.albumIds, kind })}
          hasProvisionalCover={album.tracks.some((track) => track.provisionalCover)}
          filter={filter}
          onFilter={setFilter}
          onChange={edit.setCommon}
          onRevert={(field) => edit.setCommon(field, edit.baseline[field].value)}
          onReplaceCover={() => setIsCoverOpen(true)}
        />

        <Tracklist
          tracks={shown}
          allTracks={album.tracks}
          rows={edit.draft.rows}
          originsOf={(track) => rowOrigins(track, edit.draft.rows[track.id])}
          completeIds={completeIds}
          albumArtist={edit.draft.common.albumartist}
          offers={edit.offers}
          activeOffer={edit.activeOffer}
          filter={filter}
          totalCount={album.tracks.length}
          canCopyArtist={edit.canCopyArtist}
          onChange={edit.setRow}
          onOpenOffer={edit.openOffer}
          onApplyOffer={edit.applyOffer}
          onDismissOffer={edit.answerOffer}
          onClearFilter={() => setFilter(null)}
          onRenumber={edit.renumber}
          onCopyArtist={edit.copyArtist}
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
