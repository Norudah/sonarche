import type { AlbumCompletion } from "@/features/library/albums/albumCompletion";
import type { AlbumCommonBaseline, AlbumCommonField, AlbumCommonValues } from "@/features/library/albums/albumFields";
import { CommonFields } from "@/features/library/albums/inspect/CommonFields";
import { CompletionCard } from "@/features/library/albums/inspect/CompletionCard";
import type { TrackFilter } from "@/features/library/albums/inspect/trackFilter";

/**
 * The record itself: how whole it is, and what it shares.
 *
 * Left column on purpose — the panel reads general to specific from left to
 * right, so the record's identity comes before its tracks, and anything more
 * specific than a track would open further right still.
 *
 * The bulk actions are deliberately *not* here. Renumbering and filling the
 * artist act on the rows, so they sit above the rows; keeping them in this
 * column pushed it past its own height on a two-track record.
 */
export function IdentityColumn({
  completion,
  baseline,
  values,
  origins,
  distinctCounts,
  genreFamily,
  trackCount,
  soundtrack,
  filter,
  onFilter,
  onChange,
  onRevert,
}: {
  completion: AlbumCompletion;
  baseline: AlbumCommonBaseline;
  values: AlbumCommonValues;
  origins: Partial<AlbumCommonValues>;
  distinctCounts: Partial<Record<AlbumCommonField, number>>;
  genreFamily: string;
  trackCount: number;
  soundtrack: boolean;
  filter: TrackFilter | null;
  onFilter: (filter: TrackFilter | null) => void;
  onChange: (field: AlbumCommonField, value: string) => void;
  onRevert: (field: AlbumCommonField) => void;
}) {
  return (
    <div className="flex w-[21rem] shrink-0 flex-col gap-4 overflow-y-auto border-r border-separator bg-panel px-5 py-4 xl:w-[23rem]">
      <CompletionCard completion={completion} filter={filter} onFilter={onFilter} />

      <hr className="border-separator" />

      <CommonFields
        baseline={baseline}
        values={values}
        origins={origins}
        distinctCounts={distinctCounts}
        genreFamily={genreFamily}
        trackCount={trackCount}
        soundtrack={soundtrack}
        onChange={onChange}
        onRevert={onRevert}
      />
    </div>
  );
}
