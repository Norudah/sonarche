import { useTranslation } from "react-i18next";

import type { AlbumCommonBaseline, AlbumCommonField, AlbumCommonValues } from "@/features/library/albums/albumFields";
import { DerivedField } from "@/features/library/metadata/DerivedField";
import { EditableField } from "@/features/library/metadata/EditableField";
import type { SuggestKind } from "@/features/library/metadata/suggestions";
import { CategoryTaxonomyChips } from "@/features/library/categories/CategoryTaxonomyChips";
import { FieldHelp, FieldHelpPopover } from "@/shared/ui/FieldHelp";

/** i18n key under `metadata.fields`. */
const FIELD_LABEL: Record<AlbumCommonField, string> = {
  album: "album",
  albumartist: "albumArtist",
  year: "year",
  genre: "genre",
  grouping: "category",
};

/** The album artist shares the name pool with track artists. */
const FIELD_SUGGEST: Partial<Record<AlbumCommonField, SuggestKind>> = {
  album: "album",
  albumartist: "artist",
  genre: "genre",
};

/** Record-wide tags, edited once and written to every track. The album
 * artist's explanation is a popover, to keep it open while reading. */
export function CommonFields({
  baseline,
  values,
  origins,
  distinctCounts,
  genreFamily,
  trackCount,
  soundtrack,
  onChange,
  onRevert,
}: {
  baseline: AlbumCommonBaseline;
  values: AlbumCommonValues;
  /** Original values of moved fields. */
  origins: Partial<AlbumCommonValues>;
  /** Distinct values of mixed fields, for the placeholder. */
  distinctCounts: Partial<Record<AlbumCommonField, number>>;
  /** Derived from the genre; read-only. */
  genreFamily: string;
  trackCount: number;
  /** MusicBrainz soundtrack: cue for the category nudge. */
  soundtrack: boolean;
  onChange: (field: AlbumCommonField, value: string) => void;
  onRevert: (field: AlbumCommonField) => void;
}) {
  const { t } = useTranslation("library");

  const field = (name: AlbumCommonField, extra?: { help?: React.ReactNode; className?: string }) => {
    const label = t(`metadata.fields.${FIELD_LABEL[name]}`);
    return (
      <EditableField
        label={label}
        value={values[name]}
        origin={origins[name]}
        help={extra?.help}
        suggest={FIELD_SUGGEST[name]}
        mixedCount={baseline[name].mixed ? (distinctCounts[name] ?? trackCount) : undefined}
        onChange={(value) => onChange(name, value)}
        onRevert={() => onRevert(name)}
        className={extra?.className}
      />
    );
  };

  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[0.6875rem] font-semibold tracking-wider text-muted uppercase">
          {t("albumMetadata.common.heading")}
        </h3>
        <span className="shrink-0 text-[0.6875rem] text-muted/70">
          {t("albumMetadata.common.scope", { count: trackCount })}
        </span>
      </div>

      {field("album")}

      {field("albumartist", {
        help: (
          <FieldHelpPopover
            label={t("metadata.help.open", { field: t("metadata.fields.albumArtist") })}
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
            {values.albumartist.trim() !== "" && (
              <div className="flex flex-col gap-1 rounded-lg border border-separator bg-panel px-3 py-2">
                <span className="text-[0.6875rem] text-muted/80">{t("metadata.help.artistPair.exampleLabel")}</span>
                <span className="text-[0.75rem] leading-snug text-foreground">
                  {t("metadata.help.artistPair.example", { artist: values.albumartist })}
                </span>
              </div>
            )}
          </FieldHelpPopover>
        ),
      })}

      <div className="flex gap-2.5">
        {field("year", { className: "flex-1" })}
        {field("genre", {
          className: "flex-[1.3]",
          help: (
            <FieldHelp
              label={t("metadata.help.open", { field: t("metadata.fields.genre") })}
              text={t("metadata.help.genre")}
            />
          ),
        })}
      </div>

      {((baseline.genre.mixed && values.genre.trim() === "") || (baseline.year.mixed && values.year.trim() === "")) && (
        <p className="-mt-1.5 text-[0.6875rem] leading-snug text-muted/85">
          {t("albumMetadata.mixed.hint", { count: trackCount })}
        </p>
      )}

      <DerivedField
        label={t("metadata.fields.genreBucket")}
        value={genreFamily}
        help={
          <FieldHelp
            label={t("metadata.help.open", { field: t("metadata.fields.genreBucket") })}
            text={t("metadata.help.genreBucket")}
          />
        }
      />

      {/* Chips only: the stored values are canonical English under translated labels. */}
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
          value={values.grouping}
          soundtrack={soundtrack}
          onSelect={(canonical) => onChange("grouping", canonical)}
        />
      </div>
    </section>
  );
}
