import type { LibraryTrack, TrackFieldPatch, TrackUpdate } from "@/features/library/api";

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

/** The album's parent genre (the browse family), derived per track by the
 * sidecar and surfaced read-only: uniform → the shared family, disagreeing →
 * mixed. Not a common field because it is computed, never written. */
export function commonGenreBucket(tracks: LibraryTrack[]): CommonCell {
  return cellOf(tracks.map((track) => track.genreBucket ?? ""));
}

/** The per-track editable cells shown in the tracklist. Track number rides here
 * (not a common field) because it is what actually orders the record. Genre is
 * in *both* places on purpose: edited here when the record genuinely mixes
 * genres, from the common field when it does not — the Spirit case showed an
 * album's tracks legitimately disagreeing. */
export interface TrackRowValues {
  track: string;
  title: string;
  artist: string;
  genre: string;
}

export function trackRowValues(track: LibraryTrack): TrackRowValues {
  return {
    track: track.track != null ? String(track.track) : "",
    title: track.title,
    artist: track.artist,
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
 * so an empty mixed field is left alone. */
function changedCommon(baseline: AlbumCommonBaseline, draft: AlbumDraft): Partial<AlbumCommonValues> {
  const patch: Partial<AlbumCommonValues> = {};
  for (const field of ALBUM_COMMON_FIELDS) {
    const cell = baseline[field];
    const next = draft.common[field];
    if (cell.mixed) {
      if (next.trim() !== "") patch[field] = next;
    } else if (next !== cell.value) {
      patch[field] = next;
    }
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
      const liveTrack = track.track != null ? String(track.track) : "";
      if (row.track !== liveTrack) fields.track = row.track;
      if (row.title !== track.title) fields.title = row.title;
      if (row.artist !== track.artist) fields.artist = row.artist;
      // A row's genre edit wins over the common fan-out for that track — the
      // row is the more specific intent.
      if (row.genre !== (track.genre ?? "")) fields.genre = row.genre;
    }
    if (Object.keys(fields).length > 0) updates.push({ id: track.id, fields });
  }
  return updates;
}

/** An artist edit the user might want to repeat elsewhere on the record. */
export interface ArtistPropagation {
  from: string;
  to: string;
  /** Tracks still showing `from` in the draft — candidates, never auto-applied. */
  candidateIds: number[];
}

/**
 * Artist edits worth offering to propagate.
 *
 * For each row whose artist moved `from` → `to`, the *other* rows still sitting
 * at `from` are collected as candidates. Deliberately never auto-applied: `from`
 * may be legitimately correct on some of them (the non-featuring tracks of an
 * album where a few gained an "feat. Y"), so blanket "replace every occurrence"
 * is wrong on exactly the case this feature exists for. The caller presents the
 * candidates as a checklist; the user picks which ones actually change.
 */
export function artistPropagations(tracks: LibraryTrack[], draft: AlbumDraft): ArtistPropagation[] {
  // De-dupe by (from → to): several edited rows can share the same rename.
  const moves = new Map<string, { from: string; to: string }>();
  for (const track of tracks) {
    const to = draft.rows[track.id]?.artist;
    if (to == null || to === track.artist || track.artist.trim() === "") continue;
    moves.set(`${track.artist}\u0000${to}`, { from: track.artist, to });
  }

  const result: ArtistPropagation[] = [];
  for (const { from, to } of moves.values()) {
    const candidateIds = tracks
      .filter((track) => track.artist === from && (draft.rows[track.id]?.artist ?? track.artist) === from)
      .map((track) => track.id);
    if (candidateIds.length > 0) result.push({ from, to, candidateIds });
  }
  return result;
}
