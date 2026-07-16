import { Button, Drawer, Input, Label, TextField, useOverlayState } from "@heroui/react";
import { FileText, Loader2, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { LibraryTrack } from "@/features/library/api";
import { useReenrichTrack } from "@/features/library/hooks";

interface FieldValues {
  title: string;
  artist: string;
  album: string;
  year: string;
  track: string;
  genre: string;
}

function toFieldValues(track: LibraryTrack): FieldValues {
  const trackNumber =
    track.track != null
      ? track.trackTotal != null
        ? `${track.track} / ${track.trackTotal}`
        : String(track.track)
      : "";
  return {
    title: track.title,
    artist: track.artist,
    album: track.album,
    year: track.year != null ? String(track.year) : "",
    track: trackNumber,
    genre: track.genre ?? "",
  };
}

function Field({
  label,
  value,
  isEditing,
  onChange,
  className,
}: {
  label: string;
  value: string;
  isEditing: boolean;
  onChange: (value: string) => void;
  className?: string;
}) {
  const { t } = useTranslation("library");
  return (
    <TextField
      value={isEditing ? value : value || t("metadata.emptyValue")}
      onChange={onChange}
      isReadOnly={!isEditing}
      className={"flex flex-col" + (className ? ` ${className}` : "")}
    >
      <Label className="text-sm font-medium text-muted">{label}</Label>
      <Input className="mt-1.5 w-full rounded-xl" />
    </TextField>
  );
}

function ReenrichCard({ track }: { track: LibraryTrack }) {
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
    <div className="flex flex-col gap-2 rounded-xl bg-accent/10 px-4 py-3">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{t("metadata.matchTitle")}</p>
          <p className="text-sm text-muted">{t("metadata.reenrichHint")}</p>
        </div>
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="self-start rounded-xl"
        isDisabled={reenrich.isPending}
        onPress={() => reenrich.mutate(track.id)}
      >
        {reenrich.isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {t("metadata.reenriching")}
          </>
        ) : (
          t("metadata.reenrich")
        )}
      </Button>
      {feedback && <p className={`text-sm ${feedback.tone}`}>{feedback.text}</p>}
    </div>
  );
}

function MetadataForm({ track, onClose }: { track: LibraryTrack; onClose: () => void }) {
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
  const cancel = () => setIsEditing(false);

  return (
    // data-slot="drawer-body" opts the whole panel out of HeroUI's drag-to-dismiss
    // (it excludes pointer-downs inside a drawer-body), so text selection for
    // copy-paste works; the backdrop click and the ✕ still close the drawer.
    <div data-slot="drawer-body" className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-separator px-5 py-4">
        <div className="flex items-center gap-2.5">
          <FileText className="size-5 shrink-0 text-accent" />
          <h2 className="text-lg font-semibold">{t("metadata.title")}</h2>
        </div>
        <Button
          isIconOnly
          variant="tertiary"
          size="sm"
          onPress={onClose}
          aria-label={t("metadata.close")}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-x-hidden overflow-y-auto px-5 py-5">
        <div className="flex items-center gap-4">
          {track.artUrl ? (
            <img src={track.artUrl} alt="" className="size-20 shrink-0 rounded-xl object-cover" />
          ) : (
            <div className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-default/60 text-2xl">
              ♪
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium">{t("metadata.artwork")}</p>
            <button
              type="button"
              disabled
              className="mt-0.5 text-sm text-accent/60"
              title={t("metadata.comingSoon")}
            >
              {t("metadata.changeArtwork")}
            </button>
          </div>
        </div>

        <ReenrichCard track={track} />

        <Field
          label={t("metadata.fields.title")}
          value={shown.title}
          isEditing={isEditing}
          onChange={setField("title")}
        />
        <Field
          label={t("metadata.fields.artist")}
          value={shown.artist}
          isEditing={isEditing}
          onChange={setField("artist")}
        />
        <Field
          label={t("metadata.fields.album")}
          value={shown.album}
          isEditing={isEditing}
          onChange={setField("album")}
        />
        <div className="flex gap-3">
          <Field
            label={t("metadata.fields.year")}
            value={shown.year}
            isEditing={isEditing}
            onChange={setField("year")}
            className="min-w-0 flex-1"
          />
          <Field
            label={t("metadata.fields.track")}
            value={shown.track}
            isEditing={isEditing}
            onChange={setField("track")}
            className="min-w-0 flex-1"
          />
        </div>
        <Field
          label={t("metadata.fields.genre")}
          value={shown.genre}
          isEditing={isEditing}
          onChange={setField("genre")}
        />
        {/* Derived from the genre, not an editable tag: read-only even while editing. */}
        <Field
          label={t("metadata.fields.genreBucket")}
          value={track.genreBucket ?? ""}
          isEditing={false}
          onChange={() => {}}
        />
      </div>

      <div className="flex justify-end gap-3 border-t border-separator px-5 py-4">
        {isEditing ? (
          <>
            <Button variant="secondary" className="rounded-xl px-6" onPress={cancel}>
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
    </div>
  );
}

export function MetadataDrawer({
  track,
  onClose,
}: {
  track: LibraryTrack | null;
  onClose: () => void;
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
          <Drawer.Dialog className="flex h-full flex-col overflow-hidden p-0!">
            {track && <MetadataForm key={track.id} track={track} onClose={onClose} />}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}
