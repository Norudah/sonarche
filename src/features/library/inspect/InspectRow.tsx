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

/** An empty field the Metadata page still asks about. The tint is on the cell
 * (visible in a dense grid); the inset ring keeps adjacent holes separate. */
const HOLE = "bg-warning-soft inset-ring inset-ring-warning/20 font-medium text-warning";

/** A filled field the app couldn't classify (an off-tree genre): a dotted
 * underline, not a fill, since the value itself is fine. */
const UNPLACED = "underline decoration-warning/70 decoration-dotted underline-offset-[3px]";

interface InspectRowProps {
  track: LibraryTrack;
  /** For the zebra; "#" shows the track's own number here. */
  index: number;
  /** Checks still naming this track. */
  flags: DoorKey[];
  /** See `InspectTable`. */
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

  // Zebra by position, not `nth-child`: windowing spacers would flip the parity.
  const rowTone = isCurrent
    ? "bg-accent/10 text-accent"
    : `${index % 2 === 1 ? "bg-surface-secondary/40 " : ""}group-hover/row:bg-default/50`;

  const has = (door: DoorKey) => flags.includes(door);

  // Every background set on the cell: a `[&>td]` row variant would out-specify the amber.
  const cell = (broken = false) => `${CELL} ${broken ? HOLE : rowTone}`;
  const label = (door: DoorKey) => {
    const key = ATTENTION_LABEL[door];
    return key ? t(key) : undefined;
  };

  /** Wraps only marked cells, so there's one tooltip per lit cell. */
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

      {/* One conditional class: two `text-` utilities resolve by stylesheet order. */}
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

      {/* Missing (a hole) or off-tree (see `UNPLACED`); the note names the genre. */}
      <td className={`${cell(noGenre)} w-[12%]`}>
        {noted(
          noGenre ? label("genreMissing") : unplacedGenre ? t("inspect.offTree", { genre: track.genre }) : undefined,
          <span className={`block truncate ${unplacedGenre ? UNPLACED : ""}`}>{track.genre || empty}</span>,
        )}
      </td>

      {/* Never lit: the family derives from the genre, so a missing genre isn't
          counted twice. */}
      <td className={`${cell()} w-[10%]`}>
        <span className="block truncate">{track.genre ? familyLabelOf(familyKeyOf(track)) : empty}</span>
      </td>

      {/* Never lit: a category is optional. */}
      <td className={`${cell()} w-[12%]`}>
        <span className="block truncate">{track.category ? categoryLabelOf(track.category) : empty}</span>
      </td>

      <td className={`${cell()} w-20 ${NUMERIC} text-right`}>
        {track.length != null ? formatDuration(track.length) : empty}
      </td>

      {/* Row-level verdicts (suspect match, duplicate) as pictograms. */}
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
