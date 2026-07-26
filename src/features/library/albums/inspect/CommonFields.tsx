import { useTranslation } from "react-i18next";

import type { AlbumCommonBaseline, AlbumCommonField, AlbumCommonValues } from "@/features/library/albums/albumFields";
import { EditableField } from "@/features/library/metadata/EditableField";
import { CategoryTaxonomyChips } from "@/features/library/categories/CategoryTaxonomyChips";
import { FieldHelp, FieldHelpPopover } from "@/shared/ui/FieldHelp";

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
 * of them.
 *
 * The album artist carries the panel's one heavy explanation, as a popover
 * rather than a tooltip: the difference between filing a record and describing a
 * track needs a paragraph and an example, and the user should be able to keep it
 * open while looking at the tracklist beside it.
 */
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
  /** Original value of each common field the user has moved. */
  origins: Partial<AlbumCommonValues>;
  /** How many distinct values a mixed field holds, for its placeholder. */
  distinctCounts: Partial<Record<AlbumCommonField, number>>;
  /** The browse family the genre resolves to — computed, shown, never edited. */
  genreFamily: string;
  trackCount: number;
  /** MusicBrainz typed the release a soundtrack — the category nudge's cue. */
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

      {baseline.genre.mixed && values.genre.trim() === "" && (
        <p className="-mt-1.5 text-[0.6875rem] leading-snug text-muted/85">
          {t("albumMetadata.mixed.hint", { count: trackCount })}
        </p>
      )}

      {/* Derived from the genre, never written — flat and grey so it reads as a
          consequence rather than as a field someone forgot to fill. */}
      <div className="-mt-2 flex items-center gap-1.5 text-[0.6875rem] text-muted/85">
        <span>
          {t("metadata.fields.genreBucket")} ·{" "}
          <span className="font-medium text-muted">{genreFamily || t("metadata.emptyValue")}</span>
        </span>
        <FieldHelp
          label={t("metadata.help.open", { field: t("metadata.fields.genreBucket") })}
          text={t("metadata.help.genreBucket")}
        />
      </div>

      {/* Chips only, no free-text input: the taxonomy writes canonical English
          values while showing translated labels, and a typed value would break
          that pairing. Revisited the day the app shows the canonical words. */}
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
