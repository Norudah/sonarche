import type { LibraryTrack, TrackFieldPatch, TrackUpdate } from "@/features/library/api";
import { effectiveEdit } from "@/features/library/metadata/fields";

/**
 * Album inspection edits two shapes at once: tags the whole record shares
 * (edited once, written to every track) and per-track title/artist. This module
 * is the pure core — no React — so the fan-out that turns "set the album's
 * genre" into one write per track is unit-testable on its own.
 */

/** Album-common tags, in panel order. Keys are beets' wire names, so a common
 * value drops straight into a `TrackFieldPatch`. Track total is deliberately
 * absent: it is bookkeeping the user does not care about, and the tracklist
 * order below is the real answer to "how many, in what order". */
export interface AlbumCommonValues {
  album: string;
  albumartist: string;
  year: string;
  genre: string;
  /** The category axis (grouping tag) — album-level in practice (a record is a
   * game OST or it is not), so it rides the common fan-out. Optional by
   * nature: absent from every completeness count. */
  grouping: string;
}

export type AlbumCommonField = keyof AlbumCommonValues;

export const ALBUM_COMMON_FIELDS: readonly AlbumCommonField[] = ["album", "albumartist", "year", "genre", "grouping"];

/** One common field's baseline: the value the tracks agree on, and whether they
 * actually disagree. A mixed field carries an empty value — the panel shows a
 * "multiple values" placeholder rather than pretending one track speaks for all. */
export interface CommonCell {
  value: string;
  mixed: boolean;
}

export type AlbumCommonBaseline = Record<AlbumCommonField, CommonCell>;

/** The string a track contributes to a given common field. Ints and the
 * nullable genre are normalized to the same string form the inputs edit. */
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

/** The per-track editable cells shown in the tracklist. Track number rides here
 * (not a common field) because it is what actually orders the record. Genre and
 * year are in *both* places on purpose: edited here when the record genuinely
 * mixes values, read back into the common field by `draftRowCell` — the Spirit
 * case showed an album's tracks legitimately disagreeing, and a collection
 * gathers releases from different years by nature. */
export interface TrackRowValues {
  track: string;
  title: string;
  artist: string;
  year: string;
  genre: string;
}

/** The common tags that actually live on the rows: their common field is a
 * *reading* of the column, and writing to it fans out to every row. */
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
  /** Keyed by track id — the tracklist edits title/artist per row. */
  rows: Record<number, TrackRowValues>;
}

export function toAlbumDraft(tracks: LibraryTrack[], baseline: AlbumCommonBaseline): AlbumDraft {
  const common = {} as AlbumCommonValues;
  for (const field of ALBUM_COMMON_FIELDS) common[field] = baseline[field].value;
  const rows: Record<number, TrackRowValues> = {};
  for (const track of tracks) rows[track.id] = trackRowValues(track);
  return { common, rows };
}

/** Which common fields the edit actually moves, and to what.
 *
 * A uniform field counts as changed when its value differs from the baseline
 * (clearing included). A *mixed* field counts only once the user gives it a
 * value: an untouched "multiple values" field must never blanket-wipe the album,
 * so an empty mixed field is left alone.
 *
 * Row-carried fields (genre, year) never diff here. Their common field is a
 * *reading* of the rows (`draftRowCell`), and editing it fans out to the rows,
 * so the row diffs already carry every change; the common seed is mount-time
 * only, which nothing updates. Diffing that seed against a baseline that moves
 * with every save manufactured a phantom pending change right after a
 * successful save — and re-saving the phantom wiped the album's genres. */
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

/**
 * Assemble the whole album's edits into one batch. Common-field changes fan out
 * to every track; title/artist ride their own row. Only tracks with a real
 * change ship — and the batch is one call, never one per track (the sidecar
 * itself skips any field that lands unchanged).
 */
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
 * A row-carried tag as the record currently reads it — derived from the rows,
 * never stored twice.
 *
 * Genre and year live in both views, and holding them as their own common
 * value let the two disagree: fan a row's genre out to the record and the
 * common field would still show the old word until something wrote it too. Here
 * the common field is a *reading* of the rows (their shared value, or how many
 * they hold), and writing to it fans out. Nothing left to contradict.
 *
 * Each row contributes what a save would actually store — an edit the sidecar
 * would skip (whitespace, a non-numeric year) reads as the stored value — so
 * the cell can never claim a change the save would not write.
 *
 * That settled reading decides *whether* the rows agree, never what the field
 * shows while it is being typed in: it is trimmed, and the common field is a
 * controlled input reading straight off it. Handing back the trimmed text ate
 * the space at the caret on every keystroke — "Hip Hop" could not be typed.
 * So when every row carries the same draft text, that raw text is what comes
 * back, spaces and all.
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

/** The common fields the draft has moved, mapped to the value each left —
 * feeds the revert chips. Row-carried fields are judged on their derived cell
 * (the rows' shared reading), the rest on the same effective-edit rule as the
 * save, so a chip can never point at an edit the save would not write. */
export function commonOrigins(
  tracks: LibraryTrack[],
  baseline: AlbumCommonBaseline,
  draft: AlbumDraft,
): Partial<AlbumCommonValues> {
  const origins: Partial<AlbumCommonValues> = {};
  for (const field of ROW_CARRIED_FIELDS) {
    const cell = draftRowCell(tracks, draft, field);
    // Moved when the rows no longer read as they did — including into "mixed".
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

/** How many distinct values a mixed field actually holds — "4 different values"
 * is a fact about the tags, where the track count would only restate the size of
 * the record. */
export function distinctCommonCount(tracks: LibraryTrack[], field: AlbumCommonField): number {
  return new Set(tracks.map((track) => fieldOf(track, field).trim())).size;
}

/** The per-row cells that moved, each mapped to the value it moved away from.
 * Feeds the "modified" marks and their one-click revert: the panel is always
 * editable now, so what has to read at a glance is not "can I type here" but
 * "what have I changed". */
export function rowOrigins(track: LibraryTrack, row: TrackRowValues | undefined): Partial<TrackRowValues> {
  if (!row) return {};
  const live = trackRowValues(track);
  const origins: Partial<TrackRowValues> = {};
  for (const key of Object.keys(live) as (keyof TrackRowValues)[]) {
    // Same effective-edit rule as the save, so a "modified" mark can never
    // point at an edit the save would not write.
    if (effectiveEdit(key, row[key], live[key]) != null) origins[key] = live[key];
  }
  return origins;
}

/** What the footer counts.
 *
 * `fields` is how many *tags* the edit touches, counted once each however many
 * rows carry them: setting the genre on a 29-track record is one change, not 29,
 * and the same genre reached from the common field and from a row is still one.
 * `tracks` is how many files the save would rewrite. Two different numbers, both
 * worth stating — "3 changes on 2 tracks" is the sentence the footer makes. */
export interface ChangeSummary {
  fields: number;
  tracks: number;
}

export function changeSummary(tracks: LibraryTrack[], baseline: AlbumCommonBaseline, draft: AlbumDraft): ChangeSummary {
  const touched = new Set<string>(Object.keys(changedCommon(baseline, draft)));
  for (const track of tracks) {
    // `albumartist` is the common field's wire name; a row's `artist` is its own
    // tag, so the two never collapse into each other.
    for (const key of Object.keys(rowOrigins(track, draft.rows[track.id]))) touched.add(key);
  }
  return { fields: touched.size, tracks: buildAlbumUpdates(tracks, baseline, draft).length };
}
