import { useTranslation } from "react-i18next";

import {
  type AlbumCommonBaseline,
  type AlbumCommonField,
  type AlbumCommonValues,
  type CommonCell,
} from "@/features/library/albums/albumFields";
import { AlbumSectionHeading } from "@/features/library/albums/AlbumSectionHeading";
import { CategoryTaxonomyChips } from "@/features/library/categories/CategoryTaxonomyChips";
import { useCategoryLabel } from "@/features/library/categories/useCategoryLabel";
import { MetadataField } from "@/features/library/metadata/MetadataField";

/** i18n key under `metadata.fields` for each common tag. */
const FIELD_LABEL: Record<AlbumCommonField, string> = {
  album: "album",
  albumartist: "albumArtist",
  year: "year",
  genre: "genre",
  grouping: "category",
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
  soundtrack,
  isEditing,
  onChange,
}: {
  baseline: AlbumCommonBaseline;
  values: AlbumCommonValues;
  /** Derived parent genre, shown read-only beside the editable genre. */
  genreBucket: CommonCell;
  /** MusicBrainz typed the release a soundtrack — the category nudge's cue. */
  soundtrack: boolean;
  isEditing: boolean;
  onChange: (field: AlbumCommonField, value: string) => void;
}) {
  const { t } = useTranslation("library");
  const categoryLabelOf = useCategoryLabel();

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
            "varies" when the tracks resolve to different families. Marked as
            outside the tag count, like the optional category below. */}
        <MetadataField
          label={t("metadata.fields.genreBucket")}
          value={genreBucket.value}
          isEditing={false}
          onChange={() => {}}
          hint={genreBucket.mixed ? t("albumMetadata.varied") : t("metadata.derived")}
          className="min-w-0 flex-1"
        />
      </div>
      <div className="flex flex-col gap-2">
        {/* The category stores the canonical English tag value; read mode shows
            its translation, the chips below write the canonical form. */}
        <MetadataField
          label={t(`metadata.fields.${FIELD_LABEL.grouping}`)}
          value={isEditing ? values.grouping : categoryLabelOf(values.grouping)}
          isEditing={isEditing}
          onChange={(value) => onChange("grouping", value)}
          placeholder={baseline.grouping.mixed ? t("albumMetadata.multipleValues") : undefined}
          hint={baseline.grouping.mixed ? t("albumMetadata.varied") : t("metadata.optional")}
        />
        {isEditing && (
          <CategoryTaxonomyChips
            value={values.grouping}
            soundtrack={soundtrack}
            onSelect={(canonical) => onChange("grouping", canonical)}
          />
        )}
      </div>
    </section>
  );
}
