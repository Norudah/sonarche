import { Copy, Pencil, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { ATTENTION_LABEL } from "@/features/library/albums/attentionLabels";
import type { LibraryTrack } from "@/features/library/api";
import { useCategoryLabel } from "@/features/library/categories/useCategoryLabel";
import { familyKeyOf } from "@/features/library/genres/genres";
import { useFamilyLabel } from "@/features/library/genres/useFamilyLabel";
import { CellNote } from "@/features/library/inspect/CellNote";
import { rowPlayHandler } from "@/features/library/tracks/rowPlay";
import { NUMERIC, PAD } from "@/features/library/tracks/tableGrid";
import type { DoorKey } from "@/features/library/triage/queue";
import { formatDuration } from "@/shared/lib/format";
import { usePlayer } from "@/shared/player/PlayerContext";

const CELL = `${PAD} py-1.5 text-[0.75rem] leading-4 text-muted`;

/** A field that is *empty* and that the Metadata page is still asking about. The
 * tint is on the cell and not on the text: at this density a coloured word is
 * one word among two hundred, while a lit cell is a position in a grid — which
 * is what makes a column of holes visible without reading any of it.
 *
 * The hairline is what keeps it a *cell*. A track missing both its year and its
 * genre lit two columns that share an edge, and a fill alone fused them into one
 * pavé spanning two headers — one problem where there are two. */
const HOLE = "bg-warning-soft inset-ring inset-ring-warning/20 font-medium text-warning";

/** A field that is *filled* but whose value the app could not place — today only
 * a genre the tree does not know.
 *
 * Deliberately not `HOLE`. Filling a cell amber says "nothing here", and saying
 * that over a genre somebody typed on purpose is simply false: the value is
 * fine, it is our classification that has no room for it. So the value stays
 * plain and legible, and only a hairline underneath says there is something to
 * read about it — the tooltip. A remark, not a verdict. */
const UNPLACED = "underline decoration-warning/70 decoration-dotted underline-offset-[3px]";

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
  const familyLabelOf = useFamilyLabel();
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

  /** A marked cell says why, on hover — an unmarked one is handed back
   * untouched, so the table renders one tooltip per lit cell and not one per
   * cell on screen. */
  const noted = (text: string | undefined, content: ReactNode) =>
    text ? <CellNote text={text}>{content}</CellNote> : content;

  const empty = t("metadata.emptyValue");
  const noGenre = has("genreMissing");
  const unplacedGenre = has("genreOffTree");

  return (
    <tr
      onDoubleClick={rowPlayHandler(onPlay)}
      className="group/row select-none [&>td:first-child]:rounded-l [&>td:last-child]:rounded-r"
    >
      <td className={`${cell(has("missingTrackNumber"))} w-14 ${NUMERIC} text-right`}>
        {noted(
          has("missingTrackNumber") ? label("missingTrackNumber") : undefined,
          track.track != null && track.track > 0 ? track.track : empty,
        )}
      </td>

      {/* The colour is conditional rather than a second utility: two `text-`
       * classes on one cell are settled by stylesheet order, not by which one
       * was written last, so the playing row would have lost its accent. */}
      <td className={`${cell()} font-medium ${isCurrent ? "" : "text-foreground"}`}>
        <span className="block truncate">{track.title || t("unknownTitle")}</span>
      </td>

      <td className={`${cell()} ${insideAlbum ? "w-[20%]" : "w-[14%]"}`}>
        <span className="block truncate">{track.artist || empty}</span>
      </td>

      {!insideAlbum && (
        <td className={`${cell()} w-[14%]`}>
          <span className="block truncate">{track.album || empty}</span>
        </td>
      )}

      <td className={`${cell(has("missingYear"))} w-20 ${NUMERIC} text-right`}>
        {noted(has("missingYear") ? label("missingYear") : undefined, track.year ?? empty)}
      </td>

      {/* Two very different verdicts share this column, and only one of them is
          a hole — see `UNPLACED`. The genre is interpolated into the off-tree
          sentence rather than described in the abstract: "unknown to the tree"
          over a cell reading "Psycho" is a riddle until it names Psycho. */}
      <td className={`${cell(noGenre)} w-[12%]`}>
        {noted(
          noGenre ? label("genreMissing") : unplacedGenre ? t("inspect.offTree", { genre: track.genre }) : undefined,
          <span className={`block truncate ${unplacedGenre ? UNPLACED : ""}`}>{track.genre || empty}</span>,
        )}
      </td>

      {/* Never lit either, and for a different reason from the category's: this
       * cell holds no stored field at all. It is what the tree made of the genre
       * to its left, shown so the off-tree remark can be checked rather than
       * believed. A track with no genre has no family to name — the hole is one
       * column over, and repeating it here would count one gap as two. */}
      <td className={`${cell()} w-[10%]`}>
        <span className="block truncate">{track.genre ? familyLabelOf(familyKeyOf(track)) : empty}</span>
      </td>

      {/* Never lit: a category is optional by nature — most music has no
       * context to declare — so an empty one is not a hole. */}
      <td className={`${cell()} w-[12%]`}>
        <span className="block truncate">{track.category ? categoryLabelOf(track.category) : empty}</span>
      </td>

      <td className={`${cell()} w-20 ${NUMERIC} text-right`}>
        {track.length != null ? formatDuration(track.length) : empty}
      </td>

      {/* The two verdicts that are about the row rather than about a field: no
       * cell of theirs to light, so they get their own. Both are pictograms,
       * which is the case where the name has to be one hover away. */}
      <td className={`${cell()} w-10`}>
        <span className="flex items-center gap-1 text-warning">
          {has("suspectMatch") && noted(label("suspectMatch"), <TriangleAlert className="size-3.5" />)}
          {has("duplicateRecording") && noted(label("duplicateRecording"), <Copy className="size-3.5" />)}
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
