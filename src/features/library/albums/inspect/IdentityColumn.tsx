import type { AlbumCompletion } from "@/features/library/albums/albumCompletion";
import type { AlbumCommonBaseline, AlbumCommonField, AlbumCommonValues } from "@/features/library/albums/albumFields";
import { CommonFields } from "@/features/library/albums/inspect/CommonFields";
import { CompletionCard } from "@/features/library/albums/inspect/CompletionCard";
import { ProvisionalCoverNotice } from "@/features/library/albums/inspect/ProvisionalCoverNotice";
import { RecordKindChoice } from "@/features/library/albums/inspect/RecordKindChoice";
import type { TrackFilter } from "@/features/library/albums/inspect/trackFilter";
import type { AlbumKind } from "@/features/library/api";

/** The record's completion, shared fields and kind; general before specific.
 * Bulk row actions live above the rows instead. */
export function IdentityColumn({
  completion,
  baseline,
  values,
  origins,
  distinctCounts,
  genreFamily,
  trackCount,
  soundtrack,
  kind,
  isKindPending,
  onKindChange,
  hasProvisionalCover,
  filter,
  onFilter,
  onChange,
  onRevert,
  onReplaceCover,
}: {
  completion: AlbumCompletion;
  baseline: AlbumCommonBaseline;
  values: AlbumCommonValues;
  origins: Partial<AlbumCommonValues>;
  distinctCounts: Partial<Record<AlbumCommonField, number>>;
  genreFamily: string;
  trackCount: number;
  soundtrack: boolean;
  /** Null for singletons: no record to set a kind on. */
  kind: AlbumKind | null;
  isKindPending: boolean;
  onKindChange: (kind: AlbumKind) => void;
  /** The cover is a placeholder to replace. */
  hasProvisionalCover: boolean;
  filter: TrackFilter | null;
  onFilter: (filter: TrackFilter | null) => void;
  onChange: (field: AlbumCommonField, value: string) => void;
  onRevert: (field: AlbumCommonField) => void;
  onReplaceCover: () => void;
}) {
  return (
    <div className="flex w-[21rem] shrink-0 flex-col gap-4 overflow-y-auto border-r border-separator bg-panel px-5 py-4 xl:w-[23rem]">
      <CompletionCard completion={completion} filter={filter} onFilter={onFilter} />

      {hasProvisionalCover && <ProvisionalCoverNotice onReplace={onReplaceCover} />}

      <hr className="border-separator" />

      {kind != null && (
        <>
          <RecordKindChoice kind={kind} isPending={isKindPending} onChange={onKindChange} />
          <hr className="border-separator" />
        </>
      )}

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
