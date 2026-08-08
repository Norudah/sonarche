//! User-curated playlists.
//!
//! A playlist is pure app/user state: an ordered list of beets item ids under a
//! name the user chose. It lives in sonarche.db (see the boundary rule in
//! `jobs_store`) and never copies a tag out of the library — the front joins
//! the ids back against the listing it already holds.
//!
//! Membership order is a dense `position` column, rewritten wholesale by every
//! reorder or removal inside one transaction. A playlist tops out at a few
//! thousand rows, where a full rewrite is a hair slower than a gap scheme and
//! immune to the drift those schemes invite.

use std::time::Duration;

use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::artist_images::remove_orphan;
use crate::commands::{checked_cover_source, CoverCrop};
use crate::error::{AppError, AppResult};
use crate::jobs::JobsState;
use crate::python_env::AppPaths;
use crate::sidecar::SidecarState;

/// Longest name a playlist may wear. Anything past this is a pasted paragraph,
/// not a title.
const MAX_NAME_CHARS: usize = 120;

/// Cap on one addition batch. The biggest legitimate batch is "add this whole
/// album" or a filtered view — thousands, not millions.
const MAX_BATCH: usize = 10_000;

/// The one built-in playlist. Stored under a stable English name (the front
/// shows a localized label keyed on `kind`, never this string).
const FAVORITES_KIND: &str = "favorites";
const FAVORITES_NAME: &str = "Favorites";

/// One playlist with its membership, in playing order. The item ids are all
/// the front needs: covers, durations and titles come from the library listing
/// it already holds, so nothing here can go stale against beets.
pub struct PlaylistRow {
    pub id: i64,
    pub name: String,
    /// `user`, or `favorites` for the seeded list rename/delete refuse.
    pub kind: String,
    /// User-chosen tile filename under app data's `playlists/`, if any.
    pub cover: Option<String>,
    /// What the list wears in the navigation — see `checked_marker`.
    pub marker: Option<String>,
    pub created_at: u64,
    pub updated_at: u64,
    pub item_ids: Vec<i64>,
}

impl PlaylistRow {
    fn to_json(&self, covers_dir: &std::path::Path) -> Value {
        json!({
            "id": self.id,
            "name": self.name,
            "kind": self.kind,
            "cover_path": self.cover.as_ref().map(|f| covers_dir.join(f).to_string_lossy().into_owned()),
            "marker": self.marker,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "item_ids": self.item_ids,
        })
    }
}

fn checked_name(name: &str) -> AppResult<String> {
    let name = name.trim();
    if name.is_empty() {
        return Err(AppError::InvalidInput("empty playlist name".into()));
    }
    if name.chars().count() > MAX_NAME_CHARS {
        return Err(AppError::InvalidInput("playlist name too long".into()));
    }
    Ok(name.to_string())
}

/// The navigation marker, validated by *shape* only: `cover`, `icon:<key>` or
/// `color:<key>` with a short lowercase key. The keys themselves belong to the
/// front's curated sets — checking them here would mean shipping a migration
/// every time an icon is added, and the front already falls back to its default
/// glyph for anything it does not know. An empty string clears it.
fn checked_marker(marker: &str) -> AppResult<Option<String>> {
    let marker = marker.trim();
    if marker.is_empty() {
        return Ok(None);
    }
    let key = match marker.split_once(':') {
        None if marker == "cover" => return Ok(Some(marker.to_string())),
        Some(("icon" | "color", key)) => key,
        _ => return Err(AppError::InvalidInput("unknown playlist marker".into())),
    };
    let valid = !key.is_empty()
        && key.len() <= 32
        && key
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-');
    if !valid {
        return Err(AppError::InvalidInput("invalid playlist marker key".into()));
    }
    Ok(Some(marker.to_string()))
}

/// Case-insensitive duplicate check, in Rust rather than SQL: SQLite's
/// `LOWER`/`NOCASE` stop at ASCII, and "Détente" vs "détente" is exactly the
/// collision a French library will produce. The front pre-checks against the
/// list it holds; this is the safety net under it.
fn name_taken(conn: &Connection, name: &str, excluding: Option<i64>) -> AppResult<bool> {
    let mut stmt = conn.prepare("SELECT id, name FROM playlists")?;
    let wanted = name.to_lowercase();
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
    })?;
    for row in rows {
        let (id, existing) = row?;
        if Some(id) != excluding && existing.to_lowercase() == wanted {
            return Ok(true);
        }
    }
    Ok(false)
}

fn load_item_ids(conn: &Connection, playlist_id: i64) -> AppResult<Vec<i64>> {
    let mut stmt = conn.prepare(
        "SELECT item_id FROM playlist_tracks WHERE playlist_id = ?1 ORDER BY position ASC",
    )?;
    let rows = stmt.query_map(params![playlist_id], |row| row.get(0))?;
    let mut ids = Vec::new();
    for row in rows {
        ids.push(row?);
    }
    Ok(ids)
}

/// Replace a playlist's membership with `item_ids`, positions renumbered
/// 0..n-1. The one write path for every membership change, so order and
/// density can never disagree between call sites. `added_at` of surviving rows
/// is preserved by carrying the old values across the rewrite.
fn rewrite_membership(
    conn: &Connection,
    playlist_id: i64,
    item_ids: &[i64],
    now: u64,
) -> AppResult<()> {
    let mut added_at_by_item: std::collections::HashMap<i64, u64> =
        std::collections::HashMap::new();
    {
        let mut stmt =
            conn.prepare("SELECT item_id, added_at FROM playlist_tracks WHERE playlist_id = ?1")?;
        let rows = stmt.query_map(params![playlist_id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)? as u64))
        })?;
        for row in rows {
            let (item, added) = row?;
            added_at_by_item.entry(item).or_insert(added);
        }
    }
    conn.execute(
        "DELETE FROM playlist_tracks WHERE playlist_id = ?1",
        params![playlist_id],
    )?;
    let mut insert = conn.prepare(
        "INSERT INTO playlist_tracks (playlist_id, position, item_id, added_at)
         VALUES (?1, ?2, ?3, ?4)",
    )?;
    for (position, item_id) in item_ids.iter().enumerate() {
        let added_at = added_at_by_item.get(item_id).copied().unwrap_or(now);
        insert.execute(params![
            playlist_id,
            position as i64,
            item_id,
            added_at as i64
        ])?;
    }
    Ok(())
}

fn touch(conn: &Connection, playlist_id: i64, now: u64) -> AppResult<()> {
    conn.execute(
        "UPDATE playlists SET updated_at = ?2 WHERE id = ?1",
        params![playlist_id, now as i64],
    )?;
    Ok(())
}

fn playlist_exists(conn: &Connection, id: i64) -> AppResult<()> {
    let found: Option<i64> = conn
        .query_row(
            "SELECT id FROM playlists WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .optional()?;
    match found {
        Some(_) => Ok(()),
        None => Err(AppError::InvalidInput("playlist not found".into())),
    }
}

/// Seed the built-in favorites list if this store has never had one. Runs at
/// every startup (and after a clear) — idempotent by the kind check.
pub fn ensure_favorites(conn: &Connection, now: u64) -> AppResult<()> {
    conn.execute(
        "INSERT INTO playlists (name, kind, created_at, updated_at)
         SELECT ?1, ?2, ?3, ?3
         WHERE NOT EXISTS (SELECT 1 FROM playlists WHERE kind = ?2)",
        params![FAVORITES_NAME, FAVORITES_KIND, now as i64],
    )?;
    Ok(())
}

fn kind_of(conn: &Connection, id: i64) -> AppResult<String> {
    conn.query_row(
        "SELECT kind FROM playlists WHERE id = ?1",
        params![id],
        |row| row.get(0),
    )
    .optional()?
    .ok_or_else(|| AppError::InvalidInput("playlist not found".into()))
}

pub fn list(conn: &Connection) -> AppResult<Vec<PlaylistRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, kind, cover, marker, created_at, updated_at
         FROM playlists ORDER BY name ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, Option<String>>(3)?,
            row.get::<_, Option<String>>(4)?,
            row.get::<_, i64>(5)? as u64,
            row.get::<_, i64>(6)? as u64,
        ))
    })?;
    let mut playlists = Vec::new();
    for row in rows {
        let (id, name, kind, cover, marker, created_at, updated_at) = row?;
        playlists.push(PlaylistRow {
            id,
            name,
            kind,
            cover,
            marker,
            created_at,
            updated_at,
            item_ids: load_item_ids(conn, id)?,
        });
    }
    Ok(playlists)
}

pub fn create(conn: &Connection, name: &str, now: u64) -> AppResult<PlaylistRow> {
    let name = checked_name(name)?;
    if name_taken(conn, &name, None)? {
        return Err(AppError::InvalidInput(
            "a playlist with this name already exists".into(),
        ));
    }
    conn.execute(
        "INSERT INTO playlists (name, kind, created_at, updated_at) VALUES (?1, 'user', ?2, ?2)",
        params![name, now as i64],
    )?;
    let id = conn.last_insert_rowid();
    Ok(PlaylistRow {
        id,
        name,
        kind: "user".into(),
        cover: None,
        marker: None,
        created_at: now,
        updated_at: now,
        item_ids: Vec::new(),
    })
}

pub fn rename(conn: &Connection, id: i64, name: &str, now: u64) -> AppResult<()> {
    let name = checked_name(name)?;
    if kind_of(conn, id)? == FAVORITES_KIND {
        return Err(AppError::InvalidInput(
            "the favorites playlist cannot be renamed".into(),
        ));
    }
    if name_taken(conn, &name, Some(id))? {
        return Err(AppError::InvalidInput(
            "a playlist with this name already exists".into(),
        ));
    }
    conn.execute(
        "UPDATE playlists SET name = ?2, updated_at = ?3 WHERE id = ?1",
        params![id, name, now as i64],
    )?;
    Ok(())
}

/// Returns the cover filename left ownerless, if the playlist wore one — the
/// caller removes the file, the row only knows names.
pub fn delete(conn: &Connection, id: i64) -> AppResult<Option<String>> {
    if kind_of(conn, id)? == FAVORITES_KIND {
        return Err(AppError::InvalidInput(
            "the favorites playlist cannot be deleted".into(),
        ));
    }
    let cover: Option<String> = conn.query_row(
        "SELECT cover FROM playlists WHERE id = ?1",
        params![id],
        |row| row.get(0),
    )?;
    // Membership rows go with the playlist: ON DELETE CASCADE.
    conn.execute("DELETE FROM playlists WHERE id = ?1", params![id])?;
    Ok(cover)
}

/// Record the tile a playlist now wears; returns the filename it replaces.
pub fn set_cover(
    conn: &Connection,
    id: i64,
    filename: &str,
    now: u64,
) -> AppResult<Option<String>> {
    playlist_exists(conn, id)?;
    let previous: Option<String> = conn.query_row(
        "SELECT cover FROM playlists WHERE id = ?1",
        params![id],
        |row| row.get(0),
    )?;
    conn.execute(
        "UPDATE playlists SET cover = ?2, updated_at = ?3 WHERE id = ?1",
        params![id, filename, now as i64],
    )?;
    Ok(previous.filter(|old| old != filename))
}

/// Back to the mosaic; returns the filename that just went ownerless.
pub fn remove_cover(conn: &Connection, id: i64, now: u64) -> AppResult<Option<String>> {
    playlist_exists(conn, id)?;
    let previous: Option<String> = conn.query_row(
        "SELECT cover FROM playlists WHERE id = ?1",
        params![id],
        |row| row.get(0),
    )?;
    conn.execute(
        "UPDATE playlists SET cover = NULL, updated_at = ?2 WHERE id = ?1",
        params![id, now as i64],
    )?;
    Ok(previous)
}

/// Set (or clear, on an empty string) what the playlist wears in the navigation.
/// The favorites list picks like any other: its name is the app's, its face is
/// the user's.
pub fn set_marker(conn: &Connection, id: i64, marker: &str, now: u64) -> AppResult<()> {
    playlist_exists(conn, id)?;
    let marker = checked_marker(marker)?;
    conn.execute(
        "UPDATE playlists SET marker = ?2, updated_at = ?3 WHERE id = ?1",
        params![id, marker, now as i64],
    )?;
    Ok(())
}

/// Append `item_ids` to the playlist, skipping ids already in it — adding an
/// album to a playlist that holds one of its singles must not file that track
/// twice. Returns (added, skipped).
pub fn add_tracks(
    conn: &Connection,
    id: i64,
    item_ids: &[i64],
    now: u64,
) -> AppResult<(usize, usize)> {
    if item_ids.len() > MAX_BATCH {
        return Err(AppError::InvalidInput("too many tracks at once".into()));
    }
    playlist_exists(conn, id)?;
    let tx = conn.unchecked_transaction()?;
    let mut ids = load_item_ids(&tx, id)?;
    let present: std::collections::HashSet<i64> = ids.iter().copied().collect();
    let mut appended: std::collections::HashSet<i64> = std::collections::HashSet::new();
    let mut added = 0usize;
    for item in item_ids {
        // Two guards: already in the playlist, or repeated within this batch.
        if present.contains(item) || !appended.insert(*item) {
            continue;
        }
        ids.push(*item);
        added += 1;
    }
    if added > 0 {
        rewrite_membership(&tx, id, &ids, now)?;
        touch(&tx, id, now)?;
    }
    tx.commit()?;
    Ok((added, item_ids.len() - added))
}

/// Remove the rows at `positions` (as currently displayed) and close the gaps.
pub fn remove_positions(
    conn: &Connection,
    id: i64,
    positions: &[u32],
    now: u64,
) -> AppResult<usize> {
    if positions.len() > MAX_BATCH {
        return Err(AppError::InvalidInput("too many tracks at once".into()));
    }
    playlist_exists(conn, id)?;
    let tx = conn.unchecked_transaction()?;
    let ids = load_item_ids(&tx, id)?;
    let doomed: std::collections::HashSet<usize> = positions.iter().map(|p| *p as usize).collect();
    let kept: Vec<i64> = ids
        .iter()
        .enumerate()
        .filter(|(position, _)| !doomed.contains(position))
        .map(|(_, item)| *item)
        .collect();
    let removed = ids.len() - kept.len();
    if removed > 0 {
        rewrite_membership(&tx, id, &kept, now)?;
        touch(&tx, id, now)?;
    }
    tx.commit()?;
    Ok(removed)
}

/// Move the row at `from` so it lands at `to`, both in current display order.
pub fn move_track(conn: &Connection, id: i64, from: u32, to: u32, now: u64) -> AppResult<()> {
    playlist_exists(conn, id)?;
    let tx = conn.unchecked_transaction()?;
    let mut ids = load_item_ids(&tx, id)?;
    let (from, to) = (from as usize, to as usize);
    if from >= ids.len() || to >= ids.len() {
        return Err(AppError::InvalidInput("position out of range".into()));
    }
    if from != to {
        let item = ids.remove(from);
        ids.insert(to, item);
        rewrite_membership(&tx, id, &ids, now)?;
        touch(&tx, id, now)?;
    }
    tx.commit()?;
    Ok(())
}

/// A track left the library: every membership pointing at it goes, gaps
/// closed. Called best-effort after `delete_track` — there is no foreign key
/// across database files to do it for us.
pub fn remove_item_everywhere(conn: &Connection, item_id: i64, now: u64) -> AppResult<()> {
    let mut stmt =
        conn.prepare("SELECT DISTINCT playlist_id FROM playlist_tracks WHERE item_id = ?1")?;
    let rows = stmt.query_map(params![item_id], |row| row.get::<_, i64>(0))?;
    let mut affected = Vec::new();
    for row in rows {
        affected.push(row?);
    }
    let tx = conn.unchecked_transaction()?;
    for playlist_id in affected {
        let kept: Vec<i64> = load_item_ids(&tx, playlist_id)?
            .into_iter()
            .filter(|item| *item != item_id)
            .collect();
        rewrite_membership(&tx, playlist_id, &kept, now)?;
    }
    tx.commit()?;
    Ok(())
}

/// The erase-all sweep: every playlist at once, memberships cascading.
pub fn clear(conn: &Connection) -> AppResult<()> {
    conn.execute("DELETE FROM playlists", [])?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Commands. Thin: validation happens in the store functions above, connection
// discipline in `JobsState` (same shape as artist images).
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn list_playlists(app: AppHandle, jobs: State<'_, JobsState>) -> AppResult<Value> {
    let covers_dir = AppPaths::resolve(&app)?.playlist_covers_dir;
    let rows = jobs.list_playlists().await?;
    Ok(json!({
        "playlists": rows.iter().map(|row| row.to_json(&covers_dir)).collect::<Vec<_>>()
    }))
}

#[tauri::command]
pub async fn create_playlist(
    app: AppHandle,
    jobs: State<'_, JobsState>,
    name: String,
) -> AppResult<Value> {
    let covers_dir = AppPaths::resolve(&app)?.playlist_covers_dir;
    let row = jobs.create_playlist(name).await?;
    Ok(json!({ "playlist": row.to_json(&covers_dir) }))
}

#[tauri::command]
pub async fn rename_playlist(
    jobs: State<'_, JobsState>,
    id: i64,
    name: String,
) -> AppResult<Value> {
    jobs.rename_playlist(id, name).await?;
    Ok(json!({ "ok": true }))
}

#[tauri::command]
pub async fn delete_playlist(
    app: AppHandle,
    jobs: State<'_, JobsState>,
    id: i64,
) -> AppResult<Value> {
    let orphan = jobs.delete_playlist(id).await?;
    remove_orphan(&AppPaths::resolve(&app)?.playlist_covers_dir, orphan);
    Ok(json!({ "ok": true }))
}

/// Give a playlist a tile of its own: same pipeline as an artist image — the
/// sidecar writes the 500px square rendition under a fresh random name in app
/// data's `playlists/`, the row points at it, the replaced file goes.
#[tauri::command]
pub async fn set_playlist_cover(
    app: AppHandle,
    jobs: State<'_, JobsState>,
    sidecar: State<'_, SidecarState>,
    id: i64,
    source_path: String,
    crop: Option<CoverCrop>,
) -> AppResult<Value> {
    if let Some(CoverCrop { size, .. }) = crop {
        if size == 0 {
            return Err(AppError::InvalidInput("empty crop".into()));
        }
    }
    let source = checked_cover_source(&source_path).await?;
    let dir = AppPaths::resolve(&app)?.playlist_covers_dir;
    let stem = Uuid::new_v4().simple().to_string();

    let result = sidecar
        .request(
            &app,
            "artist_image_set",
            json!({
                "source_path": source.to_string_lossy(),
                "dest_dir": dir.to_string_lossy(),
                "stem": stem,
                "crop": crop.map(|c| json!({ "left": c.left, "top": c.top, "size": c.size })),
            }),
            Duration::from_secs(60),
        )
        .await?;
    let filename = result
        .get("filename")
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::Sidecar("artist_image_set returned no filename".into()))?
        .to_string();

    let replaced = jobs.set_playlist_cover(id, filename.clone()).await?;
    remove_orphan(&dir, replaced);
    Ok(json!({ "id": id, "filename": filename }))
}

#[tauri::command]
pub async fn remove_playlist_cover(
    app: AppHandle,
    jobs: State<'_, JobsState>,
    id: i64,
) -> AppResult<Value> {
    let removed = jobs.remove_playlist_cover(id).await?;
    let had_cover = removed.is_some();
    remove_orphan(&AppPaths::resolve(&app)?.playlist_covers_dir, removed);
    Ok(json!({ "removed": had_cover }))
}

#[tauri::command]
pub async fn set_playlist_marker(
    jobs: State<'_, JobsState>,
    id: i64,
    marker: String,
) -> AppResult<Value> {
    jobs.set_playlist_marker(id, marker).await?;
    Ok(json!({ "ok": true }))
}

#[tauri::command]
pub async fn add_playlist_tracks(
    jobs: State<'_, JobsState>,
    id: i64,
    item_ids: Vec<i64>,
) -> AppResult<Value> {
    let (added, skipped) = jobs.add_playlist_tracks(id, item_ids).await?;
    Ok(json!({ "added": added, "skipped": skipped }))
}

#[tauri::command]
pub async fn remove_playlist_tracks(
    jobs: State<'_, JobsState>,
    id: i64,
    positions: Vec<u32>,
) -> AppResult<Value> {
    let removed = jobs.remove_playlist_tracks(id, positions).await?;
    Ok(json!({ "removed": removed }))
}

#[tauri::command]
pub async fn move_playlist_track(
    jobs: State<'_, JobsState>,
    id: i64,
    from: u32,
    to: u32,
) -> AppResult<Value> {
    jobs.move_playlist_track(id, from, to).await?;
    Ok(json!({ "ok": true }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::jobs_store::open_in_memory_for_tests;

    fn ids(conn: &Connection, playlist: i64) -> Vec<i64> {
        load_item_ids(conn, playlist).unwrap()
    }

    #[test]
    fn a_playlist_round_trips_with_its_members_in_order() {
        let conn = open_in_memory_for_tests();
        let row = create(&conn, "  Route de nuit ", 100).unwrap();
        assert_eq!(row.name, "Route de nuit");
        add_tracks(&conn, row.id, &[7, 3, 11], 150).unwrap();

        let listed = list(&conn).unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].name, "Route de nuit");
        assert_eq!(listed[0].item_ids, vec![7, 3, 11]);
        assert_eq!(listed[0].created_at, 100);
        assert_eq!(listed[0].updated_at, 150);
    }

    #[test]
    fn a_duplicate_name_is_rejected_case_insensitively() {
        let conn = open_in_memory_for_tests();
        create(&conn, "Détente", 100).unwrap();
        assert!(create(&conn, "détente", 100).is_err());
        assert!(create(&conn, " DÉTENTE ", 100).is_err());

        // Renaming onto another playlist's name is the same collision …
        let other = create(&conn, "Sport", 100).unwrap();
        assert!(rename(&conn, other.id, "détente", 200).is_err());
        // … but keeping your own name (case tweak included) is not.
        rename(&conn, other.id, "SPORT", 200).unwrap();
    }

    #[test]
    fn an_empty_or_absurd_name_is_refused() {
        let conn = open_in_memory_for_tests();
        assert!(create(&conn, "   ", 100).is_err());
        assert!(create(&conn, &"x".repeat(200), 100).is_err());
    }

    #[test]
    fn adding_skips_what_the_playlist_already_holds() {
        let conn = open_in_memory_for_tests();
        let row = create(&conn, "Mix", 100).unwrap();
        add_tracks(&conn, row.id, &[1, 2], 110).unwrap();

        // 2 is already in, 3 is repeated within the batch itself.
        let (added, skipped) = add_tracks(&conn, row.id, &[2, 3, 3, 4], 120).unwrap();
        assert_eq!((added, skipped), (2, 2));
        assert_eq!(ids(&conn, row.id), vec![1, 2, 3, 4]);
    }

    #[test]
    fn removing_positions_closes_the_gaps() {
        let conn = open_in_memory_for_tests();
        let row = create(&conn, "Mix", 100).unwrap();
        add_tracks(&conn, row.id, &[10, 20, 30, 40], 110).unwrap();

        let removed = remove_positions(&conn, row.id, &[0, 2], 120).unwrap();
        assert_eq!(removed, 2);
        assert_eq!(ids(&conn, row.id), vec![20, 40]);

        // Positions are dense again: the next removal addresses the new order.
        remove_positions(&conn, row.id, &[1], 130).unwrap();
        assert_eq!(ids(&conn, row.id), vec![20]);
    }

    #[test]
    fn moving_a_track_lands_it_at_the_target_position() {
        let conn = open_in_memory_for_tests();
        let row = create(&conn, "Mix", 100).unwrap();
        add_tracks(&conn, row.id, &[1, 2, 3, 4], 110).unwrap();

        move_track(&conn, row.id, 0, 2, 120).unwrap();
        assert_eq!(ids(&conn, row.id), vec![2, 3, 1, 4]);

        move_track(&conn, row.id, 3, 0, 130).unwrap();
        assert_eq!(ids(&conn, row.id), vec![4, 2, 3, 1]);

        assert!(move_track(&conn, row.id, 0, 9, 140).is_err());
    }

    #[test]
    fn a_move_preserves_when_each_track_was_added() {
        let conn = open_in_memory_for_tests();
        let row = create(&conn, "Mix", 100).unwrap();
        add_tracks(&conn, row.id, &[1], 110).unwrap();
        add_tracks(&conn, row.id, &[2], 120).unwrap();
        move_track(&conn, row.id, 0, 1, 130).unwrap();

        let added: Vec<i64> = {
            let mut stmt = conn
                .prepare(
                    "SELECT added_at FROM playlist_tracks WHERE playlist_id = ?1 ORDER BY position",
                )
                .unwrap();
            let rows = stmt.query_map(params![row.id], |r| r.get(0)).unwrap();
            rows.map(|r| r.unwrap()).collect()
        };
        assert_eq!(added, vec![120, 110]);
    }

    #[test]
    fn deleting_a_playlist_takes_its_members_with_it() {
        let conn = open_in_memory_for_tests();
        let row = create(&conn, "Mix", 100).unwrap();
        add_tracks(&conn, row.id, &[1, 2], 110).unwrap();
        delete(&conn, row.id).unwrap();

        assert!(list(&conn).unwrap().is_empty());
        let orphans: i64 = conn
            .query_row("SELECT COUNT(*) FROM playlist_tracks", [], |r| r.get(0))
            .unwrap();
        assert_eq!(orphans, 0);
        assert!(delete(&conn, row.id).is_err());
    }

    /// The library-side delete has no foreign key to lean on: the prune must
    /// reach every playlist and leave each one dense.
    #[test]
    fn a_deleted_library_item_leaves_every_playlist() {
        let conn = open_in_memory_for_tests();
        let a = create(&conn, "A", 100).unwrap();
        let b = create(&conn, "B", 100).unwrap();
        add_tracks(&conn, a.id, &[1, 5, 2], 110).unwrap();
        add_tracks(&conn, b.id, &[5], 110).unwrap();

        remove_item_everywhere(&conn, 5, 120).unwrap();
        assert_eq!(ids(&conn, a.id), vec![1, 2]);
        assert_eq!(ids(&conn, b.id), Vec::<i64>::new());
    }

    #[test]
    fn clear_removes_every_playlist() {
        let conn = open_in_memory_for_tests();
        let row = create(&conn, "Mix", 100).unwrap();
        add_tracks(&conn, row.id, &[1], 110).unwrap();
        clear(&conn).unwrap();
        assert!(list(&conn).unwrap().is_empty());
    }

    #[test]
    fn the_favorites_list_is_seeded_once_however_often_it_is_asked() {
        let conn = open_in_memory_for_tests();
        ensure_favorites(&conn, 100).unwrap();
        ensure_favorites(&conn, 200).unwrap();

        let rows = list(&conn).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].kind, FAVORITES_KIND);
        assert_eq!(rows[0].created_at, 100);
    }

    #[test]
    fn favorites_refuse_rename_and_delete_but_accept_tracks() {
        let conn = open_in_memory_for_tests();
        ensure_favorites(&conn, 100).unwrap();
        let favorites = &list(&conn).unwrap()[0];

        assert!(rename(&conn, favorites.id, "Mes sons", 200).is_err());
        assert!(delete(&conn, favorites.id).is_err());
        add_tracks(&conn, favorites.id, &[7], 200).unwrap();
        assert_eq!(ids(&conn, favorites.id), vec![7]);
    }

    /// The seeded row holds the stored name "Favorites", and the collision
    /// check reads names whatever their kind — so a user list cannot take it.
    /// Deliberate: in the English UI the label and the stored name coincide,
    /// and two lists both reading "Favorites" would be worse than one refusal.
    #[test]
    fn the_favorites_stored_name_stays_taken() {
        let conn = open_in_memory_for_tests();
        ensure_favorites(&conn, 100).unwrap();
        assert!(create(&conn, "Favorites", 200).is_err());
        assert!(create(&conn, "favorites", 200).is_err());
    }

    #[test]
    fn a_cover_round_trips_and_replacement_reports_the_orphan() {
        let conn = open_in_memory_for_tests();
        let row = create(&conn, "Mix", 100).unwrap();

        assert_eq!(set_cover(&conn, row.id, "a.jpg", 110).unwrap(), None);
        assert_eq!(
            set_cover(&conn, row.id, "b.jpg", 120).unwrap(),
            Some("a.jpg".to_string())
        );
        assert_eq!(list(&conn).unwrap()[0].cover.as_deref(), Some("b.jpg"));

        assert_eq!(
            remove_cover(&conn, row.id, 130).unwrap(),
            Some("b.jpg".to_string())
        );
        assert_eq!(list(&conn).unwrap()[0].cover, None);
    }

    #[test]
    fn a_marker_round_trips_and_clears_on_an_empty_string() {
        let conn = open_in_memory_for_tests();
        let row = create(&conn, "Mix", 100).unwrap();
        assert_eq!(list(&conn).unwrap()[0].marker, None);

        set_marker(&conn, row.id, "icon:flame", 110).unwrap();
        assert_eq!(
            list(&conn).unwrap()[0].marker.as_deref(),
            Some("icon:flame")
        );
        set_marker(&conn, row.id, "cover", 120).unwrap();
        assert_eq!(list(&conn).unwrap()[0].marker.as_deref(), Some("cover"));
        set_marker(&conn, row.id, "", 130).unwrap();
        assert_eq!(list(&conn).unwrap()[0].marker, None);
    }

    /// Shape is checked, keys are not: a front that adds an icon must not need
    /// a migration, and anything malformed must not reach the column.
    #[test]
    fn a_malformed_marker_is_refused() {
        let conn = open_in_memory_for_tests();
        let row = create(&conn, "Mix", 100).unwrap();

        set_marker(&conn, row.id, "icon:not-shipped-yet", 110).unwrap();
        set_marker(&conn, row.id, "color:indigo", 110).unwrap();

        assert!(set_marker(&conn, row.id, "mosaic", 110).is_err());
        assert!(set_marker(&conn, row.id, "icon:", 110).is_err());
        assert!(set_marker(&conn, row.id, "icon:Flame", 110).is_err());
        assert!(set_marker(&conn, row.id, "icon:a/b", 110).is_err());
        assert!(set_marker(&conn, row.id, &format!("icon:{}", "x".repeat(40)), 110).is_err());
        assert!(set_marker(&conn, 999, "cover", 110).is_err());
    }

    #[test]
    fn deleting_a_playlist_hands_back_its_cover_file() {
        let conn = open_in_memory_for_tests();
        let row = create(&conn, "Mix", 100).unwrap();
        set_cover(&conn, row.id, "tile.jpg", 110).unwrap();
        assert_eq!(delete(&conn, row.id).unwrap(), Some("tile.jpg".to_string()));
    }
}
