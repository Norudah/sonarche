import { useTranslation } from "react-i18next";

import {
  type AlbumCommonBaseline,
  type AlbumCommonField,
  type AlbumCommonValues,
  type CommonCell,
} from "@/features/library/albums/albumFields";
import { AlbumSectionHeading } from "@/features/library/albums/AlbumSectionHeading";
import { MetadataField } from "@/features/library/metadata/MetadataField";

/** i18n key under `metadata.fields` for each common tag. */
const FIELD_LABEL: Record<AlbumCommonField, string> = {
  album: "album",
  albumartist: "albumArtist",
  year: "year",
  genre: "genre",
};

/**
 * The tags every track on the record shares — edited once here, written to all
 * of them. A field the tracks disagree on shows a "multiple values" ghost while
 * editing and stays untouched unless the user actually fills it, so inspecting a
 * half-tagged album can never silently flatten it.
 */
export function AlbumCommonFields({
  baseline,
  values,
  genreBucket,
  isEditing,
  onChange,
}: {
  baseline: AlbumCommonBaseline;
  values: AlbumCommonValues;
  /** Derived parent genre, shown read-only beside the editable genre. */
  genreBucket: CommonCell;
  isEditing: boolean;
  onChange: (field: AlbumCommonField, value: string) => void;
}) {
  const { t } = useTranslation("library");

  const field = (name: AlbumCommonField, className?: string) => (
    <MetadataField
      label={t(`metadata.fields.${FIELD_LABEL[name]}`)}
      value={values[name]}
      isEditing={isEditing}
      onChange={(value) => onChange(name, value)}
      placeholder={baseline[name].mixed ? t("albumMetadata.multipleValues") : undefined}
      hint={baseline[name].mixed ? t("albumMetadata.varied") : undefined}
      className={className}
    />
  );

  return (
    <section className="flex flex-col gap-5">
      <AlbumSectionHeading title={t("albumMetadata.common")} description={t("albumMetadata.commonHint")} accent />

      {field("album")}
      {field("albumartist")}
      {field("year")}
      <div className="flex gap-3">
        {field("genre", "min-w-0 flex-1")}
        {/* Derived from the genre, never editable: greyed even while editing,
            "varies" when the tracks resolve to different families. */}
        <MetadataField
          label={t("metadata.fields.genreBucket")}
          value={genreBucket.value}
          isEditing={false}
          onChange={() => {}}
          hint={genreBucket.mixed ? t("albumMetadata.varied") : t("metadata.derived")}
          className="min-w-0 flex-1"
        />
      </div>
    </section>
  );
}
