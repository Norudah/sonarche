import { useTranslation } from "react-i18next";

import type { TrackRowValues } from "@/features/library/albums/albumFields";
import { AlbumSectionHeading } from "@/features/library/albums/AlbumSectionHeading";
import type { LibraryTrack } from "@/features/library/api";

// Same grammar as MetadataField's input — grey/flat when read-only, white with a
// real border when editable — at the denser scale a table row needs. Kept local:
// MetadataField owns the labelled block, this owns the bare cell, and forcing one
// component to be both would need a mode flag on every call.
const CELL = "w-full rounded-lg border px-2.5 py-1.5 text-[0.8125rem] outline-none transition-colors duration-300";
const READ = "cursor-default border-transparent bg-default";
const EDIT = "border-separator bg-surface focus:border-accent focus:ring-2 focus:ring-accent/25";

function RowCell({
  value,
  isEditing,
  ariaLabel,
  align = "left",
  onChange,
}: {
  value: string;
  isEditing: boolean;
  ariaLabel: string;
  align?: "left" | "center";
  onChange: (value: string) => void;
}) {
  const isEmpty = value.trim() === "";
  return (
    <input
      type="text"
      readOnly={!isEditing}
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`${CELL} ${isEditing ? EDIT : READ} ${isEmpty ? "text-muted/50" : "text-foreground"} ${align === "center" ? "text-center tabular-nums" : ""}`}
    />
  );
}

/**
 * The record's tracklist, its three per-track tags (number, title, artist)
 * editable in place. Number lives here, not in the common block, because it is
 * what orders the record; artist stays per-track because featurings mean an
 * album's tracks legitimately differ on it.
 */
export function AlbumTrackFields({
  tracks,
  rows,
  isEditing,
  onChange,
}: {
  tracks: LibraryTrack[];
  rows: Record<number, TrackRowValues>;
  isEditing: boolean;
  onChange: (id: number, field: keyof TrackRowValues, value: string) => void;
}) {
  const { t } = useTranslation("library");

  const caption = "px-2.5 text-[0.625rem] font-semibold tracking-wider text-muted/70 uppercase";

  return (
    <section className="flex flex-col gap-4">
      <AlbumSectionHeading title={t("albumMetadata.specific")} description={t("albumMetadata.specificHint")} accent />

      <div className="grid grid-cols-[3rem_1fr_1fr] items-center gap-x-2 gap-y-1">
        <span className={`${caption} text-center`}>{t("columns.number")}</span>
        <span className={caption}>{t("columns.title")}</span>
        <span className={caption}>{t("columns.artist")}</span>

        {tracks.map((track, index) => {
          const row = rows[track.id] ?? {
            track: track.track != null ? String(track.track) : "",
            title: track.title,
            artist: track.artist,
          };
          return (
            <div key={track.id} className="col-span-3 grid grid-cols-subgrid items-center">
              <RowCell
                // Read mode falls back to the position so a numberless track
                // still reads in order; edit mode shows exactly what was typed
                // (including empty) so clearing the field is visible.
                value={isEditing ? row.track : row.track || String(index + 1)}
                isEditing={isEditing}
                ariaLabel={t("columns.number")}
                align="center"
                onChange={(value) => onChange(track.id, "track", value)}
              />
              <RowCell
                value={row.title}
                isEditing={isEditing}
                ariaLabel={t("metadata.fields.title")}
                onChange={(value) => onChange(track.id, "title", value)}
              />
              <RowCell
                value={row.artist}
                isEditing={isEditing}
                ariaLabel={t("metadata.fields.artist")}
                onChange={(value) => onChange(track.id, "artist", value)}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
