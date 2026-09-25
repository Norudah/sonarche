import { Drawer, useOverlayState } from "@heroui/react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { albumPath } from "@/app/routes";
import type { LibraryTrack } from "@/features/library/api";
import { findAlbum, groupAlbums } from "@/features/library/albums/albums";
import { findArtist, groupArtists } from "@/features/library/artists/artists";
import { ArtistImageButton } from "@/features/library/artists/ArtistImageButton";
import { ArtistImageModal } from "@/features/library/artists/ArtistImageModal";
import { CategoryTaxonomyChips } from "@/features/library/categories/CategoryTaxonomyChips";
import { CoverReplaceModal } from "@/features/library/covers/CoverReplaceModal";
import { useArtistImages, useLibrary, useUpdateTracks } from "@/features/library/hooks";
import { DerivedField } from "@/features/library/metadata/DerivedField";
import { EditableField } from "@/features/library/metadata/EditableField";
import { ExitGuardDialog } from "@/features/library/metadata/ExitGuardDialog";
import { diffFields, fieldEdit, toFieldValues, type FieldValues } from "@/features/library/metadata/fields";
import { MetadataCompleteness } from "@/features/library/metadata/MetadataCompleteness";
import { MetadataFooter, type SaveFeedback } from "@/features/library/metadata/MetadataFooter";
import { MetadataHeader } from "@/features/library/metadata/MetadataHeader";
import { MetadataSuggestionsProvider } from "@/features/library/metadata/SuggestionsContext";
import { FieldHelp, FieldHelpPopover } from "@/shared/ui/FieldHelp";

/** One track's metadata in a drawer. Editing the album artist renames the
 * whole record (the write fans out to the album row). */
function MetadataForm({
  track,
  onClose,
  requestCloseRef,
}: {
  track: LibraryTrack;
  onClose: () => void;
  /** Guard-aware close for the drawer's backdrop and Escape. */
  requestCloseRef: RefObject<() => void>;
}) {
  const { t } = useTranslation("library");
  const navigate = useNavigate();
  const update = useUpdateTracks();
  const { data: libraryTracks } = useLibrary();

  const live = toFieldValues(track);
  const [draft, setDraft] = useState<FieldValues>(live);
  const [feedback, setFeedback] = useState<SaveFeedback>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isCoverOpen, setIsCoverOpen] = useState(false);
  const [isArtistOpen, setIsArtistOpen] = useState(false);

  // The cover belongs to the album; singletons have none to edit.
  const albums = useMemo(() => groupAlbums(libraryTracks ?? []), [libraryTracks]);
  const album = useMemo(() => {
    if (!track.album.trim()) return null;
    const filedUnder = track.albumArtist.trim() || track.artist.trim();
    return findAlbum(albums, filedUnder, track.album);
  }, [albums, track]);

  const artistImages = useArtistImages();
  const artist = useMemo(
    () => findArtist(groupArtists(albums), track.albumArtist.trim() || track.artist.trim()),
    [albums, track],
  );
  const artistImageUrl = (artist && artistImages.data?.get(artist.name)) ?? null;

  const patch = diffFields(live, draft);
  const changed = Object.keys(patch).length;

  // Adopt a refreshed track unless an edit is pending.
  const [synced, setSynced] = useState(track);
  if (track !== synced) {
    setSynced(track);
    if (changed === 0) setDraft(toFieldValues(track));
  }

  const setField = (key: keyof FieldValues) => (value: string) => setDraft((prev) => ({ ...prev, [key]: value }));
  const revert = (key: keyof FieldValues) => () => setDraft((prev) => ({ ...prev, [key]: live[key] }));
  // Same rule as the save, so "modified" marks match what gets written.
  const originOf = (key: keyof FieldValues) => (fieldEdit(key, live, draft) != null ? live[key] : undefined);

  const save = () => {
    if (changed === 0) return;
    setFeedback(null);
    update.mutate([{ id: track.id, fields: patch }], {
      onSuccess: () => {
        setFeedback({ kind: "saved", tracks: 1 });
        if (isLeaving) onClose();
      },
      onError: () => {
        setFeedback({ kind: "failed" });
        setIsLeaving(false);
      },
    });
  };

  const discard = () => {
    setDraft(toFieldValues(track));
    setIsLeaving(false);
  };

  const requestClose = () => {
    if (changed > 0) setIsLeaving(true);
    else onClose();
  };

  // A document-level Escape handler: on macOS a clicked button leaves focus on
  // the body, where element handlers miss it. Overlays handling Escape
  // themselves call preventDefault first.
  useEffect(() => {
    requestCloseRef.current = requestClose;
  });
  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) requestCloseRef.current();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [requestCloseRef]);

  // Keyed by album artist, falling back to the track artist.
  const openAlbum = () => {
    navigate(albumPath(track.albumArtist || track.artist, track.album));
    onClose();
  };

  /** ⌘S saves without closing. */
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "s" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      save();
    }
  };

  return (
    // data-slot="drawer-body" disables HeroUI's drag-to-dismiss here, so text can be selected.
    <div data-slot="drawer-body" className="flex h-full flex-col" onKeyDown={onKeyDown}>
      <MetadataHeader
        track={track}
        pendingFields={changed}
        onClose={requestClose}
        onEditArtwork={album ? () => setIsCoverOpen(true) : undefined}
        artistBadge={
          artist && (
            <ArtistImageButton
              imageUrl={artistImageUrl}
              label={t("artists.image.title")}
              onClick={() => setIsArtistOpen(true)}
            />
          )
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto px-7 py-5">
        <MetadataCompleteness values={live} onOpenAlbum={track.album ? openAlbum : undefined} />

        <div className="flex gap-2.5">
          <EditableField
            label={t("metadata.fields.track")}
            value={draft.track}
            origin={originOf("track")}
            isMissing={live.track.trim() === ""}
            help={
              <FieldHelp
                label={t("metadata.help.open", { field: t("metadata.fields.track") })}
                text={t("metadata.help.track")}
              />
            }
            onChange={setField("track")}
            onRevert={revert("track")}
            className="w-24 shrink-0"
          />
          <EditableField
            label={t("metadata.fields.title")}
            value={draft.title}
            origin={originOf("title")}
            isMissing={live.title.trim() === ""}
            onChange={setField("title")}
            onRevert={revert("title")}
            className="flex-1"
          />
        </div>

        <div className="flex flex-col gap-2.5">
          <EditableField
            label={t("metadata.fields.artist")}
            value={draft.artist}
            origin={originOf("artist")}
            isMissing={live.artist.trim() === ""}
            suggest="artist"
            help={
              <FieldHelpPopover
                label={t("metadata.help.open", { field: t("metadata.fields.artist") })}
                title={t("metadata.help.artistPair.title")}
              >
                <p className="text-[0.75rem] leading-relaxed text-muted">
                  <span className="font-semibold text-foreground">{t("metadata.fields.albumArtist")}</span> —{" "}
                  {t("metadata.help.artistPair.albumArtist")}
                </p>
                <p className="text-[0.75rem] leading-relaxed text-muted">
                  <span className="font-semibold text-foreground">{t("metadata.fields.artist")}</span> —{" "}
                  {t("metadata.help.artistPair.artist")}
                </p>
              </FieldHelpPopover>
            }
            onChange={setField("artist")}
            onRevert={revert("artist")}
          />
          <EditableField
            label={t("metadata.fields.albumArtist")}
            value={draft.albumArtist}
            origin={originOf("albumArtist")}
            isMissing={live.albumArtist.trim() === ""}
            suggest="artist"
            onChange={setField("albumArtist")}
            onRevert={revert("albumArtist")}
          />
        </div>

        <EditableField
          label={t("metadata.fields.album")}
          value={draft.album}
          origin={originOf("album")}
          isMissing={live.album.trim() === ""}
          suggest="album"
          onChange={setField("album")}
          onRevert={revert("album")}
        />

        {track.bonusSource && (
          // Adopted bonus track: show its real origin.
          <p className="rounded-xl bg-default/40 px-3.5 py-2.5 text-[0.75rem] text-muted">
            {t("metadata.bonusFrom", { source: track.bonusSource })}
          </p>
        )}

        <div className="flex gap-2.5">
          <EditableField
            label={t("metadata.fields.year")}
            value={draft.year}
            origin={originOf("year")}
            isMissing={live.year.trim() === ""}
            onChange={setField("year")}
            onRevert={revert("year")}
            className="flex-1"
          />
          <EditableField
            label={t("metadata.fields.genre")}
            value={draft.genre}
            origin={originOf("genre")}
            isMissing={live.genre.trim() === ""}
            suggest="genre"
            help={
              <FieldHelp
                label={t("metadata.help.open", { field: t("metadata.fields.genre") })}
                text={t("metadata.help.genre")}
              />
            }
            onChange={setField("genre")}
            onRevert={revert("genre")}
            className="flex-[1.2]"
          />
        </div>

        <DerivedField
          label={t("metadata.fields.genreBucket")}
          value={track.genreBucket ?? ""}
          help={
            <FieldHelp
              label={t("metadata.help.open", { field: t("metadata.fields.genreBucket") })}
              text={t("metadata.help.genreBucket")}
            />
          }
        />

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[0.75rem] font-medium text-muted">
              {t("metadata.fields.category")}
              <span className="ml-1.5 font-normal opacity-70">· {t("metadata.optional")}</span>
            </span>
            <FieldHelp
              label={t("metadata.help.open", { field: t("metadata.fields.category") })}
              text={t("metadata.help.category")}
            />
          </div>
          <CategoryTaxonomyChips value={draft.category} soundtrack={track.soundtrack} onSelect={setField("category")} />
        </div>
      </div>

      <MetadataFooter
        track={track}
        changed={changed}
        feedback={feedback}
        isSaving={update.isPending}
        onDiscard={discard}
        onSave={save}
        onDismissFeedback={() => setFeedback(null)}
      />

      <ExitGuardDialog
        pendingFields={isLeaving ? changed : 0}
        isSaving={update.isPending}
        onKeepEditing={() => setIsLeaving(false)}
        onDiscard={() => {
          discard();
          onClose();
        }}
        onSave={save}
      />

      {album && <CoverReplaceModal album={album} isOpen={isCoverOpen} onClose={() => setIsCoverOpen(false)} />}
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

export function MetadataDrawer({ track, onClose }: { track: LibraryTrack | null; onClose: () => void }) {
  // Controlled: Escape and backdrop only request a close; the form decides.
  const requestCloseRef = useRef(onClose);
  const state = useOverlayState({
    isOpen: track != null,
    onOpenChange: (open) => {
      if (!open) requestCloseRef.current();
    },
  });

  return (
    <Drawer state={state}>
      {/* Escape is handled by the form's document listener. */}
      <Drawer.Backdrop isKeyboardDismissDisabled>
        <Drawer.Content placement="right">
          {/* Width on the dialog (the content is the positioning layer). Drag-to-dismiss
              is disabled: portaled overlays bubble pointer events here, so selecting
              text in them dragged the drawer. */}
          <Drawer.Dialog
            className="flex h-full w-[85vw] flex-col overflow-hidden p-0! sm:w-[31rem]"
            onPointerDown={undefined}
            onPointerMove={undefined}
            onPointerUp={undefined}
          >
            {track && (
              <MetadataSuggestionsProvider>
                <MetadataForm key={track.id} track={track} onClose={onClose} requestCloseRef={requestCloseRef} />
              </MetadataSuggestionsProvider>
            )}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}
