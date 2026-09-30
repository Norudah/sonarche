//! User playlists: ordered beets item ids under a name, stored in
//! sonarche.db. No tag is copied; the front joins ids against its listing.
//!
//! Order is a dense `position` column, rewritten in one transaction on every
//! reorder or removal. Simpler than a gap scheme and fast enough at a few
//! thousand rows.

use std::collections::HashSet;

use crate::error::{AppError, AppResult};
use rusqlite::{params, Connection, OptionalExtension};

const MAX_NAME_CHARS: usize = 120;

/// Largest single addition (a whole album or filtered view).
const MAX_BATCH: usize = 10_000;

/// Stored under a stable English name; the front localizes by `kind`.
const FAVORITES_KIND: &str = "favorites";
const FAVORITES_NAME: &str = "Favorites";

/// Cover file stem for a title that sanitizes to nothing.
pub(crate) const PLAYLIST_STEM_FALLBACK: &str = "Playlist";

/// A playlist with its item ids in playing order.
pub struct PlaylistRow {
    pub id: i64,
    pub name: String,
    /// `user`, or `favorites` (cannot be renamed or deleted).
    pub kind: String,
    /// Tile filename under `Artwork/Playlists/`, if any.
    pub cover: Option<String>,
    /// See `checked_marker`.
    pub marker: Option<String>,
    pub created_at: u64,
    pub updated_at: u64,
    pub item_ids: Vec<i64>,
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

/// Validates the navigation marker's shape only (`cover`, `icon:<key>`,
/// `color:<key>`): keys belong to the front, which falls back on unknown
/// ones. An empty string clears it.
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

/// Case-insensitive, in Rust: SQLite's `LOWER`/`NOCASE` are ASCII-only.
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

/// Replaces the membership with `item_ids` at positions 0..n-1, keeping
/// surviving rows' `added_at`. The only membership write path.
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

/// Seeds the favorites list if missing. Idempotent; runs at every startup.
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

/// Returns the cover filename left unowned, if any.
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
    // Memberships cascade.
    conn.execute("DELETE FROM playlists WHERE id = ?1", params![id])?;
    Ok(cover)
}

/// Returns the replaced filename, if any.
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

pub fn update_cover_filename(
    conn: &Connection,
    id: i64,
    filename: &str,
    now: u64,
) -> AppResult<()> {
    playlist_exists(conn, id)?;
    conn.execute(
        "UPDATE playlists SET cover = ?2, updated_at = ?3 WHERE id = ?1",
        params![id, filename, now as i64],
    )?;
    Ok(())
}

/// Returns the filename left unowned, if any.
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

/// An empty string clears the marker.
pub fn set_marker(conn: &Connection, id: i64, marker: &str, now: u64) -> AppResult<()> {
    playlist_exists(conn, id)?;
    let marker = checked_marker(marker)?;
    conn.execute(
        "UPDATE playlists SET marker = ?2, updated_at = ?3 WHERE id = ?1",
        params![id, marker, now as i64],
    )?;
    Ok(())
}

/// Appends items not already present. Returns (added, skipped).
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
        // Already in the playlist, or repeated within this batch.
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

/// Removes rows at display positions and closes the gaps.
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

/// Removes a deleted track from every playlist. No foreign key can span the
/// two databases.
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

/// How many memberships point at these items, for the undo confirmation.
/// Scanned rather than `IN (...)`: an import can exceed SQLite's parameter limit.
pub fn count_memberships(conn: &Connection, item_ids: &HashSet<i64>) -> AppResult<usize> {
    if item_ids.is_empty() {
        return Ok(0);
    }
    let mut stmt = conn.prepare("SELECT item_id FROM playlist_tracks")?;
    let rows = stmt.query_map([], |row| row.get::<_, i64>(0))?;
    let mut count = 0;
    for row in rows {
        if item_ids.contains(&row?) {
            count += 1;
        }
    }
    Ok(count)
}

/// Batch version of `remove_item_everywhere`, rewriting each playlist once.
pub fn remove_items_everywhere(
    conn: &Connection,
    item_ids: &HashSet<i64>,
    now: u64,
) -> AppResult<usize> {
    if item_ids.is_empty() {
        return Ok(0);
    }
    let mut stmt = conn.prepare("SELECT DISTINCT playlist_id FROM playlist_tracks")?;
    let rows = stmt.query_map([], |row| row.get::<_, i64>(0))?;
    let mut lists = Vec::new();
    for row in rows {
        lists.push(row?);
    }

    let tx = conn.unchecked_transaction()?;
    let mut removed = 0;
    for playlist_id in lists {
        let ids = load_item_ids(&tx, playlist_id)?;
        let kept: Vec<i64> = ids
            .iter()
            .copied()
            .filter(|item| !item_ids.contains(item))
            .collect();
        if kept.len() == ids.len() {
            continue;
        }
        removed += ids.len() - kept.len();
        rewrite_membership(&tx, playlist_id, &kept, now)?;
        touch(&tx, playlist_id, now)?;
    }
    tx.commit()?;
    Ok(removed)
}

pub fn clear(conn: &Connection) -> AppResult<()> {
    conn.execute("DELETE FROM playlists", [])?;
    Ok(())
}

/// Empties every playlist after a library wipe: new beets ids restart at 1
/// and would point at unrelated tracks.
pub fn clear_memberships(conn: &Connection, now: u64) -> AppResult<()> {
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "UPDATE playlists SET updated_at = ?1
         WHERE id IN (SELECT DISTINCT playlist_id FROM playlist_tracks)",
        params![now as i64],
    )?;
    tx.execute("DELETE FROM playlist_tracks", [])?;
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory_for_tests;

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

    /// Untouched playlists must not be rewritten (`updated_at` drives sorting).
    #[test]
    fn undoing_an_import_empties_its_tracks_out_of_every_playlist() {
        let conn = open_in_memory_for_tests();
        let mixed = create(&conn, "Mélange", 100).unwrap();
        let untouched = create(&conn, "Intacte", 100).unwrap();
        add_tracks(&conn, mixed.id, &[1, 2, 3, 4], 150).unwrap();
        add_tracks(&conn, untouched.id, &[9], 150).unwrap();
        let doomed: HashSet<i64> = [2, 4, 42].into();

        assert_eq!(count_memberships(&conn, &doomed).unwrap(), 2);
        let removed = remove_items_everywhere(&conn, &doomed, 300).unwrap();

        assert_eq!(removed, 2);
        assert_eq!(ids(&conn, mixed.id), vec![1, 3]);
        assert_eq!(ids(&conn, untouched.id), vec![9]);
        let listed = list(&conn).unwrap();
        let intact = listed.iter().find(|row| row.id == untouched.id).unwrap();
        assert_eq!(intact.updated_at, 150);
    }

    #[test]
    fn a_duplicate_name_is_rejected_case_insensitively() {
        let conn = open_in_memory_for_tests();
        create(&conn, "Détente", 100).unwrap();
        assert!(create(&conn, "détente", 100).is_err());
        assert!(create(&conn, " DÉTENTE ", 100).is_err());

        let other = create(&conn, "Sport", 100).unwrap();
        assert!(rename(&conn, other.id, "détente", 200).is_err());
        // Changing the case of its own name is allowed.
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

        // 2 is already in, 3 is repeated within the batch.
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
    fn a_library_wipe_empties_the_playlists_but_keeps_them() {
        let conn = open_in_memory_for_tests();
        let kept = create(&conn, "Mix", 100).unwrap();
        let empty = create(&conn, "Vide", 100).unwrap();
        add_tracks(&conn, kept.id, &[1, 2], 110).unwrap();

        clear_memberships(&conn, 200).unwrap();

        let listed = list(&conn).unwrap();
        assert_eq!(listed.len(), 2);
        assert_eq!(ids(&conn, kept.id), Vec::<i64>::new());
        let kept_row = listed.iter().find(|row| row.id == kept.id).unwrap();
        assert_eq!(kept_row.updated_at, 200);
        let empty_row = listed.iter().find(|row| row.id == empty.id).unwrap();
        assert_eq!(empty_row.updated_at, 100);
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

    /// "Favorites" is a stored name like any other, so a user list can't take it.
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
