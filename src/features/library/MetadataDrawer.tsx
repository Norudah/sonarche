import { Drawer, useOverlayState } from "@heroui/react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { albumPath } from "@/app/routes";
import type { LibraryTrack } from "@/features/library/api";
import { findAlbum, groupAlbums } from "@/features/library/albums/albums";
import { CategoryTaxonomyChips } from "@/features/library/categories/CategoryTaxonomyChips";
import { CoverReplaceModal } from "@/features/library/covers/CoverReplaceModal";
import { useLibrary, useUpdateTracks } from "@/features/library/hooks";
import { DerivedField } from "@/features/library/metadata/DerivedField";
import { EditableField } from "@/features/library/metadata/EditableField";
import { ExitGuardDialog } from "@/features/library/metadata/ExitGuardDialog";
import { diffFields, fieldEdit, toFieldValues, type FieldValues } from "@/features/library/metadata/fields";
import { MetadataCompleteness } from "@/features/library/metadata/MetadataCompleteness";
import { MetadataFooter, type SaveFeedback } from "@/features/library/metadata/MetadataFooter";
import { MetadataHeader } from "@/features/library/metadata/MetadataHeader";
import { MetadataSuggestionsProvider } from "@/features/library/metadata/SuggestionsContext";
import { FieldHelp, FieldHelpPopover } from "@/shared/ui/FieldHelp";

/**
 * One track's metadata.
 *
 * Still a drawer, unlike the album panel: a single track's form fits on screen
 * whole, and a modal would cost the context behind it for nothing. What the two
 * share is the grammar — same labels, same help, same always-editable fields
 * marked when they move, same footer, same exit guard.
 *
 * The album artist is *not* editable here, and that is a fix rather than a
 * removal. Albums are grouped by (album artist, title); writing that field from
 * a single track used to move that one track into an album of its own, silently
 * splitting the record in two. It reads as context beside the artist instead.
 */
function MetadataForm({
  track,
  onClose,
  requestCloseRef,
}: {
  track: LibraryTrack;
  onClose: () => void;
  /** Where the Drawer's own dismiss gestures (backdrop, Escape) find the
   * guard-aware close — only this form knows whether a draft is at stake. */
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

  // The record this track belongs to — the cover is the album's, so that is
  // what the artwork affordance edits. A singleton resolves to none and the
  // affordance stays off.
  const album = useMemo(() => {
    if (!track.album.trim()) return null;
    const filedUnder = track.albumArtist.trim() || track.artist.trim();
    return findAlbum(groupAlbums(libraryTracks ?? []), filedUnder, track.album);
  }, [libraryTracks, track]);

  const patch = diffFields(live, draft);
  const changed = Object.keys(patch).length;

  // A re-enrich (or another surface's save) hands us a new track. Adopt it,
  // unless the user has something pending — a refetch must not eat an edit.
  const [synced, setSynced] = useState(track);
  if (track !== synced) {
    setSynced(track);
    if (changed === 0) setDraft(toFieldValues(track));
  }

  const setField = (key: keyof FieldValues) => (value: string) => setDraft((prev) => ({ ...prev, [key]: value }));
  const revert = (key: keyof FieldValues) => () => setDraft((prev) => ({ ...prev, [key]: live[key] }));
  // Same effective-edit rule as the save, so a "modified" mark can never point
  // at an edit the save would not write.
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

  // The backdrop click lands on the Drawer, outside this form; hand it the
  // current requestClose so that gesture meets the same guard as the ✕.
  // Escape rides the same wiring: on macOS a button click leaves focus on the
  // body — outside both this tree and react-aria's overlay — so an element
  // handler misses the key. One document listener owns it instead; overlays
  // that answer Escape themselves (help popovers, the guard) preventDefault
  // first, and `isKeyboardDismissDisabled` keeps react-aria from competing.
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

  // The album is keyed by its album artist (the identity shared across the
  // record), falling back to the track artist for a single that has none.
  const openAlbum = () => {
    navigate(albumPath(track.albumArtist || track.artist, track.album));
    onClose();
  };

  /** ⌘S writes without leaving. Escape lives on the document, above. */
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "s" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      save();
    }
  };

  return (
    // data-slot="drawer-body" opts the whole panel out of HeroUI's drag-to-dismiss
    // (it excludes pointer-downs inside a drawer-body), so text selection for
    // copy-paste works.
    <div data-slot="drawer-body" className="flex h-full flex-col" onKeyDown={onKeyDown}>
      <MetadataHeader
        track={track}
        pendingFields={changed}
        onClose={requestClose}
        onEditArtwork={album ? () => setIsCoverOpen(true) : undefined}
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

        <div className="flex flex-col gap-1">
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
          {/* Context, not a field: this is the name the record is filed under,
              and it only means anything at the album's scale. */}
          {live.albumArtist.trim() !== "" && (
            <p className="text-[0.6875rem] text-muted/85">{t("metadata.filedUnder", { artist: live.albumArtist })}</p>
          )}
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
          // Adopted bonus track: filed with the main album for convenience
          // (iTunes/Spotify-style) — keep the real origin explicit.
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
    </div>
  );
}

export function MetadataDrawer({ track, onClose }: { track: LibraryTrack | null; onClose: () => void }) {
  // `isOpen` is controlled, so react-aria can never close this on its own
  // terms: Escape and the backdrop click only *request* it, and the form
  // answers — straight close, or the exit guard when a draft is at stake.
  const requestCloseRef = useRef(onClose);
  const state = useOverlayState({
    isOpen: track != null,
    onOpenChange: (open) => {
      if (!open) requestCloseRef.current();
    },
  });

  return (
    <Drawer state={state}>
      {/* Keyboard dismiss stays off: Escape is handled by the form's own
          document listener (react-aria's would miss it whenever focus sits on
          the body, and would double-handle it whenever it does not). */}
      <Drawer.Backdrop isKeyboardDismissDisabled>
        <Drawer.Content placement="right">
          {/* Width belongs on the dialog, not the content (that one is the
              full-screen positioning layer). HeroUI's default sm:w-96 is too
              narrow for a two-column metadata form. */}
          <Drawer.Dialog className="flex h-full w-[85vw] flex-col overflow-hidden p-0! sm:w-[31rem]">
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
