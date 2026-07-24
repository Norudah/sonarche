import { motion } from "motion/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { TrackRowValues } from "@/features/library/albums/albumFields";
import { AlbumSectionHeading } from "@/features/library/albums/AlbumSectionHeading";
import type { LibraryTrack } from "@/features/library/api";
import { springs } from "@/shared/motion/tokens";

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
  onFocus,
  onBlur,
}: {
  value: string;
  isEditing: boolean;
  ariaLabel: string;
  align?: "left" | "center";
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const isEmpty = value.trim() === "";
  return (
    <input
      type="text"
      readOnly={!isEditing}
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      className={`${CELL} ${isEditing ? EDIT : READ} ${isEmpty ? "text-muted/50" : "text-foreground"} ${align === "center" ? "text-center tabular-nums" : ""}`}
    />
  );
}

/**
 * The floating offer to fan a row's genre edit out to the whole record.
 *
 * Pops to the *left* of the edited cell instead of expanding in the flow, so
 * the tracklist never jumps mid-edit. Visible only while the cell is focused;
 * its button acts on mousedown (before the input's blur) and letting the focus
 * leave is the implicit "this track only" — clicking Save never detours
 * through a question.
 */
function ApplyGenrePopover({
  value,
  count,
  onApplyAll,
  onDismiss,
}: {
  value: string;
  count: number;
  onApplyAll: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation("library");

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, x: 6 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      transition={springs.snappy}
      className="absolute top-1/2 right-[calc(100%+0.5rem)] z-10 w-60 -translate-y-1/2 rounded-xl border border-separator bg-surface p-3 shadow-lg"
    >
      <p className="text-[0.75rem] text-muted">{t("albumMetadata.applyGenre.prompt", { value })}</p>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          // Mousedown, not click: it must win against the input's blur, which
          // unmounts this card before a click could land. The blur then runs
          // its natural course and closes the card — the question is answered.
          onMouseDown={() => onApplyAll()}
          className="cursor-pointer rounded-full bg-accent px-3 py-1 text-[0.75rem] font-medium text-accent-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          {t("albumMetadata.applyGenre.all", { count })}
        </button>
        {/* Explicit twin of the implicit blur-dismiss, and the only one that
            works on macOS WebKit, where clicking a button never blurs the
            input. Keeps the edit on this row alone. */}
        <button
          type="button"
          onMouseDown={() => onDismiss()}
          className="cursor-pointer rounded-full px-3 py-1 text-[0.75rem] font-medium text-muted transition-colors hover:text-foreground"
        >
          {t("albumMetadata.applyGenre.one")}
        </button>
      </div>
    </motion.div>
  );
}

/**
 * The record's tracklist, its per-track tags (number, title, artist, genre)
 * editable in place. Number lives here, not in the common block, because it is
 * what orders the record; artist and genre stay per-track because featurings
 * and mixed-genre records mean an album's tracks legitimately differ on them.
 */
export function AlbumTrackFields({
  tracks,
  rows,
  isEditing,
  genreShared,
  onChange,
  onApplyGenreAll,
}: {
  tracks: LibraryTrack[];
  rows: Record<number, TrackRowValues>;
  isEditing: boolean;
  /** Whether the album's genre was uniform before this edit — the only case
   * where a row edit earns the "apply everywhere" offer. */
  genreShared: boolean;
  onChange: (id: number, field: keyof TrackRowValues, value: string) => void;
  onApplyGenreAll: (value: string) => void;
}) {
  const { t } = useTranslation("library");
  const [focusedGenreRow, setFocusedGenreRow] = useState<number | null>(null);

  const caption = "px-2.5 text-[0.625rem] font-semibold tracking-wider text-muted/70 uppercase";

  return (
    <section className="flex flex-col gap-4">
      <AlbumSectionHeading title={t("albumMetadata.specific")} description={t("albumMetadata.specificHint")} accent />

      <div className="grid grid-cols-[3rem_1.1fr_1fr_0.9fr] items-center gap-x-2 gap-y-1">
        <span className={`${caption} text-center`}>{t("columns.number")}</span>
        <span className={caption}>{t("columns.title")}</span>
        <span className={caption}>{t("columns.artist")}</span>
        <span className={caption}>{t("columns.genre")}</span>

        {tracks.map((track, index) => {
          const row = rows[track.id] ?? {
            track: track.track != null ? String(track.track) : "",
            title: track.title,
            artist: track.artist,
            genre: track.genre ?? "",
          };
          const offerFanOut =
            isEditing &&
            genreShared &&
            tracks.length > 1 &&
            focusedGenreRow === track.id &&
            row.genre.trim() !== "" &&
            row.genre !== (track.genre ?? "");
          return (
            <div key={track.id} className="col-span-4 grid grid-cols-subgrid items-center">
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
              <div className="relative">
                <RowCell
                  value={row.genre}
                  isEditing={isEditing}
                  ariaLabel={t("metadata.fields.genre")}
                  // Typing (re-)arms the offer even when focus never left the
                  // cell — after an apply-all, macOS WebKit leaves the input
                  // focused (buttons never take focus there), so focus events
                  // alone cannot bring the card back.
                  onChange={(value) => {
                    onChange(track.id, "genre", value);
                    setFocusedGenreRow(track.id);
                  }}
                  onFocus={() => setFocusedGenreRow(track.id)}
                  onBlur={() => setFocusedGenreRow((current) => (current === track.id ? null : current))}
                />
                {offerFanOut && (
                  <ApplyGenrePopover
                    value={row.genre}
                    count={tracks.length}
                    // Closing is explicit, not left to blur: on macOS WebKit
                    // the button's mousedown never blurs the input.
                    onApplyAll={() => {
                      setFocusedGenreRow(null);
                      onApplyGenreAll(row.genre);
                    }}
                    onDismiss={() => setFocusedGenreRow(null)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
