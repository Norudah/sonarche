import { useTranslation } from "react-i18next";

import type { LibraryTrack } from "@/features/library/api";
import { CategoryTaxonomyChips } from "@/features/library/categories/CategoryTaxonomyChips";
import { DerivedField } from "@/features/library/metadata/DerivedField";
import { EditableField } from "@/features/library/metadata/EditableField";
import type { FieldValues } from "@/features/library/metadata/fields";
import { MetadataCompleteness } from "@/features/library/metadata/MetadataCompleteness";
import { FieldHelp, FieldHelpPopover } from "@/shared/ui/FieldHelp";

interface MetadataFieldsProps {
  track: LibraryTrack;
  /** The stored values; `draft` is what the form shows. */
  live: FieldValues;
  draft: FieldValues;
  /** The stored value of a field the draft moved, else undefined. */
  originOf: (key: keyof FieldValues) => string | undefined;
  onChange: (key: keyof FieldValues, value: string) => void;
  onRevert: (key: keyof FieldValues) => void;
  onOpenAlbum?: () => void;
}

/** The drawer's scrolling body: completeness, then the editable tags. */
export function MetadataFields({ track, live, draft, originOf, onChange, onRevert, onOpenAlbum }: MetadataFieldsProps) {
  const { t } = useTranslation("library");
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto px-7 py-5">
      <MetadataCompleteness values={live} onOpenAlbum={onOpenAlbum} />

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
          onChange={(value) => onChange("track", value)}
          onRevert={() => onRevert("track")}
          className="w-24 shrink-0"
        />
        <EditableField
          label={t("metadata.fields.title")}
          value={draft.title}
          origin={originOf("title")}
          isMissing={live.title.trim() === ""}
          onChange={(value) => onChange("title", value)}
          onRevert={() => onRevert("title")}
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
          onChange={(value) => onChange("artist", value)}
          onRevert={() => onRevert("artist")}
        />
        <EditableField
          label={t("metadata.fields.albumArtist")}
          value={draft.albumArtist}
          origin={originOf("albumArtist")}
          isMissing={live.albumArtist.trim() === ""}
          suggest="artist"
          onChange={(value) => onChange("albumArtist", value)}
          onRevert={() => onRevert("albumArtist")}
        />
      </div>

      <EditableField
        label={t("metadata.fields.album")}
        value={draft.album}
        origin={originOf("album")}
        isMissing={live.album.trim() === ""}
        suggest="album"
        onChange={(value) => onChange("album", value)}
        onRevert={() => onRevert("album")}
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
          onChange={(value) => onChange("year", value)}
          onRevert={() => onRevert("year")}
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
          onChange={(value) => onChange("genre", value)}
          onRevert={() => onRevert("genre")}
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
        <CategoryTaxonomyChips
          value={draft.category}
          soundtrack={track.soundtrack}
          onSelect={(value) => onChange("category", value)}
        />
      </div>
    </div>
  );
}
