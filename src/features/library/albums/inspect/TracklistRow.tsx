import { useTranslation } from "react-i18next";

import type { TrackRowValues } from "@/features/library/albums/albumFields";
import { EditableCell } from "@/features/library/albums/inspect/EditableCell";
import { GRID } from "@/features/library/albums/inspect/tracklistGrid";

/**
 * One editable row of the record.
 *
 * The leading gutter is where an unanswered suggestion waits: the popover can
 * only be anchored to one row at a time, so every other pending offer folds into
 * a dot on its own line rather than queueing somewhere the user will never look.
 */
export function TracklistRow({
  row,
  origins,
  isComplete,
  hasPendingOffer,
  isAnchor,
  onChange,
  onOpenOffer,
}: {
  row: TrackRowValues;
  origins: Partial<TrackRowValues>;
  isComplete: boolean;
  hasPendingOffer: boolean;
  isAnchor: boolean;
  onChange: (field: keyof TrackRowValues, value: string) => void;
  onOpenOffer: () => void;
}) {
  const { t } = useTranslation("library");
  const title = row.title || t("unknownTitle");
  const cell = (field: string) => t("albumMetadata.tracks.cell", { field, title });

  return (
    <div
      className={`${GRID} h-9 items-center border-b border-separator/50 px-5 transition-colors ${
        isAnchor ? "bg-accent-soft/60" : Object.keys(origins).length > 0 ? "bg-accent-soft/25" : ""
      }`}
    >
      <div className="flex justify-center">
        {hasPendingOffer && (
          <button
            type="button"
            onClick={onOpenOffer}
            aria-label={t("albumMetadata.offers.pending", { count: 1 })}
            className="size-2 cursor-pointer rounded-full bg-accent outline-none ring-offset-2 transition-transform hover:scale-125 focus-visible:ring-2 focus-visible:ring-accent/40"
          />
        )}
      </div>

      <EditableCell
        value={row.track}
        origin={origins.track}
        label={cell(t("columns.number"))}
        align="center"
        onChange={(value) => onChange("track", value)}
      />
      <EditableCell
        value={row.title}
        origin={origins.title}
        label={cell(t("metadata.fields.title"))}
        onChange={(value) => onChange("title", value)}
      />
      <EditableCell
        value={row.artist}
        origin={origins.artist}
        label={cell(t("metadata.fields.artist"))}
        suggest="artist"
        onChange={(value) => onChange("artist", value)}
      />
      <EditableCell
        value={row.year}
        origin={origins.year}
        label={cell(t("metadata.fields.year"))}
        align="center"
        missingLabel={t("albumMetadata.tracks.missingShort")}
        onChange={(value) => onChange("year", value)}
      />
      <EditableCell
        value={row.genre}
        origin={origins.genre}
        label={cell(t("metadata.fields.genre"))}
        missingLabel={t("albumMetadata.tracks.missing")}
        suggest="genre"
        onChange={(value) => onChange("genre", value)}
      />

      <div className="flex justify-center">
        <span
          role="img"
          aria-label={t(isComplete ? "albumMetadata.tracks.statusComplete" : "albumMetadata.tracks.statusIncomplete")}
          className={`size-1.5 rounded-full ${isComplete ? "bg-success" : "bg-warning"}`}
        />
      </div>
    </div>
  );
}
