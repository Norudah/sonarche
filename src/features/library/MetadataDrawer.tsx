import { Button, Drawer, Input, Label, TextField, useOverlayState } from "@heroui/react";
import { FileText, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { LibraryTrack } from "@/features/library/api";

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

function MetadataForm({ track, onClose }: { track: LibraryTrack; onClose: () => void }) {
  const { t } = useTranslation("library");
  const [isEditing, setIsEditing] = useState(false);
  const [values, setValues] = useState<FieldValues>(() => toFieldValues(track));

  const setField = (key: keyof FieldValues) => (value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const cancel = () => {
    setValues(toFieldValues(track));
    setIsEditing(false);
  };

  return (
    <>
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

        <div className="flex items-start gap-3 rounded-xl bg-accent/10 px-4 py-3">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" />
          <div className="min-w-0">
            <p className="text-sm font-medium">{t("metadata.matchTitle")}</p>
            <button
              type="button"
              disabled
              className="text-sm text-accent/60"
              title={t("metadata.comingSoon")}
            >
              {t("metadata.applyTags")}
            </button>
          </div>
        </div>

        <Field
          label={t("metadata.fields.title")}
          value={values.title}
          isEditing={isEditing}
          onChange={setField("title")}
        />
        <Field
          label={t("metadata.fields.artist")}
          value={values.artist}
          isEditing={isEditing}
          onChange={setField("artist")}
        />
        <Field
          label={t("metadata.fields.album")}
          value={values.album}
          isEditing={isEditing}
          onChange={setField("album")}
        />
        <div className="flex gap-3">
          <Field
            label={t("metadata.fields.year")}
            value={values.year}
            isEditing={isEditing}
            onChange={setField("year")}
            className="min-w-0 flex-1"
          />
          <Field
            label={t("metadata.fields.track")}
            value={values.track}
            isEditing={isEditing}
            onChange={setField("track")}
            className="min-w-0 flex-1"
          />
        </div>
        <Field
          label={t("metadata.fields.genre")}
          value={values.genre}
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
          <Button
            variant="primary"
            className="rounded-xl px-6"
            onPress={() => setIsEditing(true)}
          >
            {t("metadata.edit")}
          </Button>
        )}
      </div>
    </>
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
