import type { LibraryTrack, TrackFieldPatch, TrackUpdate } from "@/features/library/api";
import { effectiveEdit } from "@/features/library/metadata/fields";

/** Pure core of album editing: record-wide tags (written to every track) and
 * per-track cells. */

/** Record-wide tags in panel order, keyed by beets wire names. No track total:
 * the tracklist order answers it. */
export interface AlbumCommonValues {
  album: string;
  albumartist: string;
  year: string;
  genre: string;
  /** The category (grouping tag), album-level in practice. Not counted in completeness. */
  grouping: string;
}

export type AlbumCommonField = keyof AlbumCommonValues;

export const ALBUM_COMMON_FIELDS: readonly AlbumCommonField[] = ["album", "albumartist", "year", "genre", "grouping"];

/** The value the tracks agree on, or `mixed` with an empty value. */
export interface CommonCell {
  value: string;
  mixed: boolean;
}

export type AlbumCommonBaseline = Record<AlbumCommonField, CommonCell>;

/** A track's value as the input's string form. */
function fieldOf(track: LibraryTrack, field: AlbumCommonField): string {
  switch (field) {
    case "album":
      return track.album;
    case "albumartist":
      return track.albumArtist;
    case "year":
      return track.year != null ? String(track.year) : "";
    case "genre":
      return track.genre ?? "";
    case "grouping":
      return track.category ?? "";
  }
}

function cellOf(values: string[]): CommonCell {
  const distinct = new Set(values.map((value) => value.trim()));
  if (distinct.size <= 1) return { value: values[0]?.trim() ?? "", mixed: false };
  return { value: "", mixed: true };
}

export function commonBaseline(tracks: LibraryTrack[]): AlbumCommonBaseline {
  const baseline = {} as AlbumCommonBaseline;
  for (const field of ALBUM_COMMON_FIELDS) {
    baseline[field] = cellOf(tracks.map((track) => fieldOf(track, field)));
  }
  return baseline;
}

/** Per-track editable cells. Genre and year appear here and as common fields,
 * since an album's tracks can legitimately differ (see `draftRowCell`). */
export interface TrackRowValues {
  track: string;
  title: string;
  artist: string;
  year: string;
  genre: string;
}

/** Common fields that are a reading of the rows; editing them fans out. */
export type RowCarriedField = "genre" | "year";
export const ROW_CARRIED_FIELDS: readonly RowCarriedField[] = ["genre", "year"];

export function trackRowValues(track: LibraryTrack): TrackRowValues {
  return {
    track: track.track != null ? String(track.track) : "",
    title: track.title,
    artist: track.artist,
    year: track.year != null ? String(track.year) : "",
    genre: track.genre ?? "",
  };
}

export interface AlbumDraft {
  common: AlbumCommonValues;
  /** Keyed by track id. */
  rows: Record<number, TrackRowValues>;
}

export function toAlbumDraft(tracks: LibraryTrack[], baseline: AlbumCommonBaseline): AlbumDraft {
  const common = {} as AlbumCommonValues;
  for (const field of ALBUM_COMMON_FIELDS) common[field] = baseline[field].value;
  const rows: Record<number, TrackRowValues> = {};
  for (const track of tracks) rows[track.id] = trackRowValues(track);
  return { common, rows };
}

/**
 * Common fields the edit changes. A mixed field only counts once given a
 * value, so it never wipes the album. Row-carried fields are diffed on the
 * rows instead: diffing their stale seed caused phantom changes after a save.
 */
export function changedCommon(baseline: AlbumCommonBaseline, draft: AlbumDraft): Partial<AlbumCommonValues> {
  const patch: Partial<AlbumCommonValues> = {};
  for (const field of ALBUM_COMMON_FIELDS) {
    if ((ROW_CARRIED_FIELDS as readonly AlbumCommonField[]).includes(field)) continue;
    const cell = baseline[field];
    const value = effectiveEdit(field, draft.common[field], cell.mixed ? "" : cell.value);
    if (value != null) patch[field] = value;
  }
  return patch;
}

/** One batch for the whole album: common changes fan out, rows carry their
 * own, and only tracks with a real change are included. */
export function buildAlbumUpdates(
  tracks: LibraryTrack[],
  baseline: AlbumCommonBaseline,
  draft: AlbumDraft,
): TrackUpdate[] {
  const common = changedCommon(baseline, draft);
  const updates: TrackUpdate[] = [];

  for (const track of tracks) {
    const fields: TrackFieldPatch = { ...common };
    const row = draft.rows[track.id];
    if (row) {
      const live = trackRowValues(track);
      for (const key of Object.keys(live) as (keyof TrackRowValues)[]) {
        const value = effectiveEdit(key, row[key], live[key]);
        if (value != null) fields[key] = value;
      }
    }
    if (Object.keys(fields).length > 0) updates.push({ id: track.id, fields });
  }
  return updates;
}

/**
 * A row-carried tag as the rows currently read (shared value or mixed),
 * using what a save would actually store. While every row holds the same
 * draft text, that raw text is returned so typing keeps its spaces.
 */
export function draftRowCell(
  tracks: LibraryTrack[],
  draft: AlbumDraft,
  field: RowCarriedField,
): CommonCell & { distinct: number } {
  const raw = tracks.map((track) => draft.rows[track.id]?.[field] ?? fieldOf(track, field));
  const values = new Set(
    tracks.map((track) => {
      const live = fieldOf(track, field);
      const row = draft.rows[track.id]?.[field] ?? live;
      return (effectiveEdit(field, row, live) ?? live).trim();
    }),
  );
  if (values.size <= 1) {
    const typed = new Set(raw);
    return { value: (typed.size === 1 ? [...typed][0] : [...values][0]) ?? "", mixed: false, distinct: values.size };
  }
  return { value: "", mixed: true, distinct: values.size };
}

/** Moved common fields and their previous values, for the revert chips. Same
 * effective-edit rule as the save. */
export function commonOrigins(
  tracks: LibraryTrack[],
  baseline: AlbumCommonBaseline,
  draft: AlbumDraft,
): Partial<AlbumCommonValues> {
  const origins: Partial<AlbumCommonValues> = {};
  for (const field of ROW_CARRIED_FIELDS) {
    const cell = draftRowCell(tracks, draft, field);
    // Including a move into "mixed".
    if (!baseline[field].mixed && (cell.mixed || cell.value !== baseline[field].value)) {
      origins[field] = baseline[field].value;
    }
  }
  for (const field of ALBUM_COMMON_FIELDS) {
    if ((ROW_CARRIED_FIELDS as readonly AlbumCommonField[]).includes(field) || baseline[field].mixed) continue;
    if (effectiveEdit(field, draft.common[field], baseline[field].value) != null) {
      origins[field] = baseline[field].value;
    }
  }
  return origins;
}

/** Distinct values of a mixed field. */
export function distinctCommonCount(tracks: LibraryTrack[], field: AlbumCommonField): number {
  return new Set(tracks.map((track) => fieldOf(track, field).trim())).size;
}

/** Moved row cells and their previous values, for the "modified" marks. */
export function rowOrigins(track: LibraryTrack, row: TrackRowValues | undefined): Partial<TrackRowValues> {
  if (!row) return {};
  const live = trackRowValues(track);
  const origins: Partial<TrackRowValues> = {};
  for (const key of Object.keys(live) as (keyof TrackRowValues)[]) {
    // Same rule as the save.
    if (effectiveEdit(key, row[key], live[key]) != null) origins[key] = live[key];
  }
  return origins;
}

/** `fields`: distinct tags touched (once each). `tracks`: files rewritten. */
export interface ChangeSummary {
  fields: number;
  tracks: number;
}

export function changeSummary(tracks: LibraryTrack[], baseline: AlbumCommonBaseline, draft: AlbumDraft): ChangeSummary {
  const touched = new Set<string>(Object.keys(changedCommon(baseline, draft)));
  for (const track of tracks) {
    // A row's `artist` and the common `albumartist` stay distinct.
    for (const key of Object.keys(rowOrigins(track, draft.rows[track.id]))) touched.add(key);
  }
  return { fields: touched.size, tracks: buildAlbumUpdates(tracks, baseline, draft).length };
}
