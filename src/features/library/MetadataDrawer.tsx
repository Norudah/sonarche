import { Button, Drawer, useOverlayState } from "@heroui/react";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { LibraryTrack } from "@/features/library/api";
import { useReenrichTrack } from "@/features/library/hooks";
import { countFilled, toFieldValues, type FieldValues } from "@/features/library/metadata/fields";
import { MetadataCompleteness } from "@/features/library/metadata/MetadataCompleteness";
import { MetadataField } from "@/features/library/metadata/MetadataField";
import { MetadataHeader } from "@/features/library/metadata/MetadataHeader";

/** Discreet re-run of the acoustic match — a text action rather than a card, so
 * the panel stays a metadata sheet and not a status dashboard. */
function ReenrichAction({ track }: { track: LibraryTrack }) {
  const { t } = useTranslation("library");
  const reenrich = useReenrichTrack();

  const feedback = reenrich.isError
    ? { text: t("metadata.reenrichFailed"), tone: "text-danger" }
    : reenrich.isSuccess
      ? reenrich.data.matched
        ? { text: t("metadata.reenrichMatched"), tone: "text-success" }
        : { text: t("metadata.reenrichUnmatched"), tone: "text-muted" }
      : null;

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={reenrich.isPending}
        onClick={() => reenrich.mutate(track.id)}
        className="flex cursor-pointer items-center gap-1.5 text-[0.8125rem] font-medium text-accent hover:underline disabled:cursor-default disabled:opacity-60 disabled:hover:no-underline"
      >
        {reenrich.isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Sparkles className="size-3.5" />
        )}
        {reenrich.isPending ? t("metadata.reenriching") : t("metadata.reenrich")}
      </button>
      {feedback && <p className={`text-[0.8125rem] ${feedback.tone}`}>{feedback.text}</p>}
    </div>
  );
}

function MetadataForm({
  track,
  onClose,
  onDelete,
}: {
  track: LibraryTrack;
  onClose: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("library");
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<FieldValues>(() => toFieldValues(track));

  // Read mode shows the live track (so a re-enrich refetch updates the drawer in
  // place — the form isn't remounted since its key/id is unchanged); the draft is
  // only the editing buffer, reseeded from the track each time editing starts.
  const live = toFieldValues(track);
  const shown = isEditing ? draft : live;

  const setField = (key: keyof FieldValues) => (value: string) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const startEditing = () => {
    setDraft(toFieldValues(track));
    setIsEditing(true);
  };

  return (
    // data-slot="drawer-body" opts the whole panel out of HeroUI's drag-to-dismiss
    // (it excludes pointer-downs inside a drawer-body), so text selection for
    // copy-paste works; the backdrop click and the ✕ still close the drawer.
    <div data-slot="drawer-body" className="flex h-full flex-col">
      <MetadataHeader track={track} onClose={onClose} />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto px-7 py-6">
        <ReenrichAction track={track} />
        <MetadataCompleteness filled={countFilled(live)} />

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
          {/* Album-level field (shared by every track on the album): read-only here. */}
          <MetadataField
            label={t("metadata.fields.albumArtist")}
            value={live.albumArtist}
            isEditing={false}
            onChange={() => {}}
            className="min-w-0 flex-1"
          />
        </div>
        <MetadataField
          label={t("metadata.fields.album")}
          value={shown.album}
          isEditing={isEditing}
          onChange={setField("album")}
          action={
            <button
              type="button"
              disabled
              // title would otherwise become the accessible name and hide the label.
              aria-label={t("metadata.viewAlbum")}
              title={t("metadata.comingSoon")}
              className="flex cursor-pointer items-center gap-1 text-[0.75rem] font-medium text-accent/60"
            >
              {t("metadata.viewAlbum")}
              <ArrowRight className="size-3.5" />
            </button>
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
          {/* Derived from the genre, not an editable tag: read-only even while editing. */}
          <MetadataField
            label={t("metadata.fields.genreBucket")}
            value={track.genreBucket ?? ""}
            isEditing={false}
            onChange={() => {}}
            hint={t("metadata.derived")}
            className="min-w-0 flex-1"
          />
        </div>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-separator px-7 py-3.5">
        {/* Bare text, no button chrome: destructive actions shouldn't compete
            with the primary action for weight. */}
        <button
          type="button"
          onClick={onDelete}
          className="cursor-pointer text-[0.8125rem] font-medium text-danger hover:underline"
        >
          {t("delete.confirm")}
        </button>
        <div className="flex gap-2.5">
          {isEditing ? (
            <>
              <Button
                variant="secondary"
                className="rounded-xl px-6"
                onPress={() => setIsEditing(false)}
              >
                {t("metadata.cancel")}
              </Button>
              <Button
                variant="primary"
                className="rounded-xl px-6"
                onPress={() => setIsEditing(false)}
              >
                {t("metadata.save")}
              </Button>
            </>
          ) : (
            <Button variant="primary" className="rounded-xl px-6" onPress={startEditing}>
              {t("metadata.edit")}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

export function MetadataDrawer({
  track,
  onClose,
  onDelete,
}: {
  track: LibraryTrack | null;
  onClose: () => void;
  onDelete: (track: LibraryTrack) => void;
}) {
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
            {track && (
              <MetadataForm
                key={track.id}
                track={track}
                onClose={onClose}
                onDelete={() => onDelete(track)}
              />
            )}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}
