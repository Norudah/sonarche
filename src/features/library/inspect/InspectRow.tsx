import { Copy, Pencil, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ATTENTION_LABEL } from "@/features/library/albums/attentionLabels";
import type { LibraryTrack } from "@/features/library/api";
import { useCategoryLabel } from "@/features/library/categories/useCategoryLabel";
import { rowPlayHandler } from "@/features/library/tracks/rowPlay";
import type { DoorKey } from "@/features/library/triage/queue";
import { formatDuration } from "@/shared/lib/format";
import { usePlayer } from "@/shared/player/PlayerContext";

const CELL = "px-2 py-1.5 text-[0.75rem] leading-4 text-muted";

/** A field the Metadata page is still asking about. The tint is on the cell and
 * not on the text: at this density a coloured word is one word among two
 * hundred, while a lit cell is a position in a grid — which is what makes a
 * column of holes visible without reading any of it. */
const HOLE = "bg-warning-soft font-medium text-warning";

interface InspectRowProps {
  track: LibraryTrack;
  /** Position in the list, for the zebra. Not shown: the "#" column carries the
   * track's own number here, which is the field being inspected. */
  index: number;
  /** The checks still naming this track. */
  flags: DoorKey[];
  /** Drops the Album cell — see `InspectTable`. */
  insideAlbum?: boolean;
  onPlay: () => void;
  onEdit: () => void;
}

export function InspectRow({ track, index, flags, insideAlbum = false, onPlay, onEdit }: InspectRowProps) {
  const { t } = useTranslation("library");
  const categoryLabelOf = useCategoryLabel();
  const { current } = usePlayer();
  const isCurrent = current?.id === track.id;

  // The zebra keys off the row's own position, not `nth-child`: when the list
  // is windowed a spacer row takes a slot and flips the parity of everything
  // below it as you scroll.
  const rowTone = isCurrent
    ? "bg-accent/10 text-accent"
    : `${index % 2 === 1 ? "bg-surface-secondary/40 " : ""}group-hover/row:bg-default/50`;

  const has = (door: DoorKey) => flags.includes(door);

  // Every background is composed here, on the cell, rather than half of it on
  // the row with a `[&>td]` variant: that selector is one element more specific
  // than a plain utility, so the zebra silently beat the amber and a hole on an
  // odd row simply did not light. One source per cell, no cascade to lose.
  const cell = (broken = false) => `${CELL} ${broken ? HOLE : rowTone}`;
  const label = (door: DoorKey) => {
    const key = ATTENTION_LABEL[door];
    return key ? t(key) : undefined;
  };

  const empty = t("metadata.emptyValue");

  return (
    <tr
      onDoubleClick={rowPlayHandler(onPlay)}
      className="group/row select-none [&>td:first-child]:rounded-l [&>td:last-child]:rounded-r"
    >
      <td
        className={`${cell(has("missingTrackNumber"))} w-12 text-right tabular-nums`}
        title={label("missingTrackNumber")}
      >
        {track.track != null && track.track > 0 ? track.track : empty}
      </td>

      {/* The colour is conditional rather than a second utility: two `text-`
       * classes on one cell are settled by stylesheet order, not by which one
       * was written last, so the playing row would have lost its accent. */}
      <td className={`${cell()} font-medium ${isCurrent ? "" : "text-foreground"}`}>
        <span className="block truncate">{track.title || t("unknownTitle")}</span>
      </td>

      <td className={`${cell()} ${insideAlbum ? "w-[24%]" : "w-[15%]"}`}>
        <span className="block truncate">{track.artist || empty}</span>
      </td>

      {!insideAlbum && (
        <td className={`${cell()} w-[15%]`}>
          <span className="block truncate">{track.album || empty}</span>
        </td>
      )}

      <td className={`${cell(has("missingYear"))} w-14 text-right tabular-nums`} title={label("missingYear")}>
        {track.year ?? empty}
      </td>

      <td
        className={`${cell(has("genreMissing") || has("genreOffTree"))} w-[13%]`}
        title={label(has("genreOffTree") ? "genreOffTree" : "genreMissing")}
      >
        <span className="block truncate">{track.genre || empty}</span>
      </td>

      {/* Never lit: a category is optional by nature — most music has no
       * context to declare — so an empty one is not a hole. */}
      <td className={`${cell()} w-[12%]`}>
        <span className="block truncate">{track.category ? categoryLabelOf(track.category) : empty}</span>
      </td>

      <td className={`${cell()} w-14 text-right tabular-nums`}>
        {track.length != null ? formatDuration(track.length) : empty}
      </td>

      {/* The two verdicts that are about the row rather than about a field: no
       * cell of theirs to light, so they get their own. */}
      <td className={`${cell()} w-10`}>
        <span className="flex items-center gap-1 text-warning">
          {has("suspectMatch") && <TriangleAlert className="size-3.5" aria-label={label("suspectMatch")} />}
          {has("duplicateRecording") && <Copy className="size-3.5" aria-label={label("duplicateRecording")} />}
        </span>
      </td>

      <td className={`${cell()} w-9`}>
        <button
          type="button"
          onClick={onEdit}
          aria-label={t("metadata.editMetadata")}
          title={t("metadata.editMetadata")}
          className="flex size-5 cursor-pointer items-center justify-center rounded text-muted opacity-0 outline-none transition-opacity group-hover/row:opacity-100 hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <Pencil className="size-3" />
        </button>
      </td>
    </tr>
  );
}
