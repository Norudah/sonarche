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

use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::jobs::JobsState;

/// Longest name a playlist may wear. Anything past this is a pasted paragraph,
/// not a title.
const MAX_NAME_CHARS: usize = 120;

/// Cap on one addition batch. The biggest legitimate batch is "add this whole
/// album" or a filtered view — thousands, not millions.
const MAX_BATCH: usize = 10_000;

/// One playlist with its membership, in playing order. The item ids are all
/// the front needs: covers, durations and titles come from the library listing
/// it already holds, so nothing here can go stale against beets.
pub struct PlaylistRow {
    pub id: i64,
    pub name: String,
    pub created_at: u64,
    pub updated_at: u64,
    pub item_ids: Vec<i64>,
}

impl PlaylistRow {
    fn to_json(&self) -> Value {
        json!({
            "id": self.id,
            "name": self.name,
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

pub fn list(conn: &Connection) -> AppResult<Vec<PlaylistRow>> {
    let mut stmt =
        conn.prepare("SELECT id, name, created_at, updated_at FROM playlists ORDER BY name ASC")?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, i64>(2)? as u64,
            row.get::<_, i64>(3)? as u64,
        ))
    })?;
    let mut playlists = Vec::new();
    for row in rows {
        let (id, name, created_at, updated_at) = row?;
        playlists.push(PlaylistRow {
            id,
            name,
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
        "INSERT INTO playlists (name, created_at, updated_at) VALUES (?1, ?2, ?2)",
        params![name, now as i64],
    )?;
    let id = conn.last_insert_rowid();
    Ok(PlaylistRow {
        id,
        name,
        created_at: now,
        updated_at: now,
        item_ids: Vec::new(),
    })
}

pub fn rename(conn: &Connection, id: i64, name: &str, now: u64) -> AppResult<()> {
    let name = checked_name(name)?;
    playlist_exists(conn, id)?;
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

pub fn delete(conn: &Connection, id: i64) -> AppResult<()> {
    playlist_exists(conn, id)?;
    // Membership rows go with the playlist: ON DELETE CASCADE.
    conn.execute("DELETE FROM playlists WHERE id = ?1", params![id])?;
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
pub async fn list_playlists(jobs: State<'_, JobsState>) -> AppResult<Value> {
    let rows = jobs.list_playlists().await?;
    Ok(json!({ "playlists": rows.iter().map(PlaylistRow::to_json).collect::<Vec<_>>() }))
}

#[tauri::command]
pub async fn create_playlist(jobs: State<'_, JobsState>, name: String) -> AppResult<Value> {
    let row = jobs.create_playlist(name).await?;
    Ok(json!({ "playlist": row.to_json() }))
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
pub async fn delete_playlist(jobs: State<'_, JobsState>, id: i64) -> AppResult<Value> {
    jobs.delete_playlist(id).await?;
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
}
