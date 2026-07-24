import { Drawer, useOverlayState } from "@heroui/react";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { albumPath } from "@/app/routes";
import type { LibraryTrack } from "@/features/library/api";
import { CategoryTaxonomyChips } from "@/features/library/categories/CategoryTaxonomyChips";
import { useCategoryLabel } from "@/features/library/categories/useCategoryLabel";
import { useUpdateTracks } from "@/features/library/hooks";
import { countFilled, diffFields, toFieldValues, type FieldValues } from "@/features/library/metadata/fields";
import { MetadataCompleteness } from "@/features/library/metadata/MetadataCompleteness";
import { MetadataField } from "@/features/library/metadata/MetadataField";
import { MetadataFooter } from "@/features/library/metadata/MetadataFooter";
import { MetadataHeader } from "@/features/library/metadata/MetadataHeader";

function MetadataForm({ track, onClose }: { track: LibraryTrack; onClose: () => void }) {
  const { t } = useTranslation("library");
  const categoryLabelOf = useCategoryLabel();
  const navigate = useNavigate();
  const update = useUpdateTracks();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<FieldValues>(() => toFieldValues(track));

  // The album is keyed by its album artist (the identity shared across the
  // record), falling back to the track artist for a single that has none.
  const openAlbum = () => {
    navigate(albumPath(track.albumArtist || track.artist, track.album));
    onClose();
  };

  // Read mode shows the live track (so a re-enrich refetch updates the drawer in
  // place — the form isn't remounted since its key/id is unchanged); the draft is
  // only the editing buffer, reseeded from the track each time editing starts.
  const live = toFieldValues(track);
  const shown = isEditing ? draft : live;

  const setField = (key: keyof FieldValues) => (value: string) => setDraft((prev) => ({ ...prev, [key]: value }));

  const startEditing = () => {
    setDraft(toFieldValues(track));
    update.reset();
    setIsEditing(true);
  };

  const save = () => {
    const patch = diffFields(live, draft);
    if (Object.keys(patch).length === 0) {
      setIsEditing(false);
      return;
    }
    update.mutate([{ id: track.id, fields: patch }], {
      onSuccess: () => setIsEditing(false),
    });
  };

  return (
    // data-slot="drawer-body" opts the whole panel out of HeroUI's drag-to-dismiss
    // (it excludes pointer-downs inside a drawer-body), so text selection for
    // copy-paste works; the backdrop click and the ✕ still close the drawer.
    <div data-slot="drawer-body" className="flex h-full flex-col">
      <MetadataHeader track={track} isEditing={isEditing} onClose={onClose} />

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-x-hidden overflow-y-auto px-7 py-6">
        <MetadataCompleteness filled={countFilled(live)} />

        <div className="flex flex-col gap-5">
          <MetadataField
            label={t("metadata.fields.title")}
            value={shown.title}
            isEditing={isEditing}
            onChange={setField("title")}
          />
          <div className="flex gap-3">
            <MetadataField
              label={t("metadata.fields.artist")}
              value={shown.artist}
              isEditing={isEditing}
              onChange={setField("artist")}
              className="min-w-0 flex-1"
            />
            <MetadataField
              label={t("metadata.fields.albumArtist")}
              value={shown.albumArtist}
              isEditing={isEditing}
              onChange={setField("albumArtist")}
              className="min-w-0 flex-1"
            />
          </div>
          <MetadataField
            label={t("metadata.fields.album")}
            value={shown.album}
            isEditing={isEditing}
            onChange={setField("album")}
            action={
              track.album ? (
                <button
                  type="button"
                  onClick={openAlbum}
                  className="group/album flex shrink-0 cursor-pointer items-center gap-1 text-[0.75rem] font-medium text-accent outline-none transition-colors hover:text-accent/80 focus-visible:underline"
                >
                  {t("metadata.viewAlbum")}
                  <ArrowRight className="size-3.5 transition-transform duration-200 ease-out group-hover/album:translate-x-0.5 motion-reduce:transition-none" />
                </button>
              ) : undefined
            }
          />
          {track.bonusSource && (
            // Adopted bonus track: filed with the main album for convenience
            // (iTunes/Spotify-style) — keep the real origin explicit.
            <p className="rounded-xl bg-default/40 px-3.5 py-2.5 text-[0.75rem] text-muted">
              {t("metadata.bonusFrom", { source: track.bonusSource })}
            </p>
          )}
          <div className="flex gap-3">
            <MetadataField
              label={t("metadata.fields.year")}
              value={shown.year}
              isEditing={isEditing}
              onChange={setField("year")}
              className="min-w-0 flex-1"
            />
            <MetadataField
              label={t("metadata.fields.track")}
              value={shown.track}
              isEditing={isEditing}
              onChange={setField("track")}
              className="min-w-0 flex-1"
            />
          </div>
          <div className="flex gap-3">
            <MetadataField
              label={t("metadata.fields.genre")}
              value={shown.genre}
              isEditing={isEditing}
              onChange={setField("genre")}
              className="min-w-0 flex-1"
            />
            {/* Derived from the genre, not an editable tag: read-only even
                while editing, and marked as outside the tag count. */}
            <MetadataField
              label={t("metadata.fields.genreBucket")}
              value={track.genreBucket ?? ""}
              isEditing={false}
              onChange={() => {}}
              hint={t("metadata.derived")}
              className="min-w-0 flex-1"
            />
          </div>
          <div className="flex flex-col gap-2">
            {/* The stored value is the canonical English tag; read mode shows
                its translation, the chips write the canonical form. */}
            <MetadataField
              label={t("metadata.fields.category")}
              value={isEditing ? shown.category : categoryLabelOf(shown.category)}
              isEditing={isEditing}
              onChange={setField("category")}
              hint={t("metadata.optional")}
            />
            {isEditing && (
              <CategoryTaxonomyChips
                value={shown.category}
                soundtrack={track.soundtrack}
                onSelect={(canonical) => setField("category")(canonical)}
              />
            )}
          </div>
        </div>
      </div>

      <MetadataFooter
        track={track}
        isEditing={isEditing}
        isSaving={update.isPending}
        saveFailed={update.isError}
        onEdit={startEditing}
        onCancel={() => setIsEditing(false)}
        onSave={save}
      />
    </div>
  );
}

export function MetadataDrawer({ track, onClose }: { track: LibraryTrack | null; onClose: () => void }) {
  const state = useOverlayState({
    isOpen: track != null,
    onOpenChange: (open) => {
      if (!open) onClose();
    },
  });

  return (
    <Drawer state={state}>
      <Drawer.Backdrop>
        <Drawer.Content placement="right">
          {/* Width belongs on the dialog, not the content (that one is the
              full-screen positioning layer). HeroUI's default sm:w-96 is too
              narrow for a two-column metadata form. */}
          <Drawer.Dialog className="flex h-full w-[85vw] flex-col overflow-hidden p-0! sm:w-[30rem]">
            {track && <MetadataForm key={track.id} track={track} onClose={onClose} />}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}
