//! Which image file (under `artists/`) each artist is shown with.

use rusqlite::{params, Connection, OptionalExtension};

use crate::error::AppResult;

/// The image file (under `artists/`) an artist is shown with.
pub struct ArtistImageRow {
    pub name: String,
    pub filename: String,
    pub updated_at: u64,
}

pub fn list_artist_images(conn: &Connection) -> AppResult<Vec<ArtistImageRow>> {
    let mut stmt =
        conn.prepare("SELECT name, filename, updated_at FROM artist_images ORDER BY name ASC")?;
    let rows = stmt.query_map([], |row| {
        Ok(ArtistImageRow {
            name: row.get("name")?,
            filename: row.get("filename")?,
            updated_at: row.get::<_, i64>("updated_at")? as u64,
        })
    })?;
    let mut images = Vec::new();
    for row in rows {
        images.push(row?);
    }
    Ok(images)
}

/// Returns the replaced filename, if any, for the caller to delete.
pub fn upsert_artist_image(
    conn: &Connection,
    name: &str,
    filename: &str,
    source: &str,
    now: u64,
) -> AppResult<Option<String>> {
    let previous: Option<String> = conn
        .query_row(
            "SELECT filename FROM artist_images WHERE name = ?1",
            params![name],
            |row| row.get(0),
        )
        .optional()?;
    conn.execute(
        "INSERT OR REPLACE INTO artist_images (name, filename, source, updated_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![name, filename, source, now as i64],
    )?;
    Ok(previous.filter(|old| old != filename))
}

/// Returns the filename left unowned, if any.
pub fn remove_artist_image(conn: &Connection, name: &str) -> AppResult<Option<String>> {
    let filename: Option<String> = conn
        .query_row(
            "SELECT filename FROM artist_images WHERE name = ?1",
            params![name],
            |row| row.get(0),
        )
        .optional()?;
    conn.execute("DELETE FROM artist_images WHERE name = ?1", params![name])?;
    Ok(filename)
}

/// Follows an albumartist rename. The caller renames the file first and
/// passes the new filename. If the new name already has an image, it wins
/// (renames usually merge a misspelling into an existing artist). Returns
/// the filename left unowned, if any.
pub fn rename_artist_image(
    conn: &Connection,
    old: &str,
    new: &str,
    filename: &str,
) -> AppResult<Option<String>> {
    if old == new {
        return Ok(None);
    }
    let target_taken: bool = conn
        .query_row(
            "SELECT 1 FROM artist_images WHERE name = ?1",
            params![new],
            |_| Ok(true),
        )
        .optional()?
        .unwrap_or(false);
    if target_taken {
        return remove_artist_image(conn, old);
    }
    conn.execute(
        "UPDATE artist_images SET name = ?2, filename = ?3 WHERE name = ?1",
        params![old, new, filename],
    )?;
    Ok(None)
}

/// Points a row at a renamed file.
pub fn update_artist_image_filename(
    conn: &Connection,
    name: &str,
    filename: &str,
) -> AppResult<()> {
    conn.execute(
        "UPDATE artist_images SET filename = ?2 WHERE name = ?1",
        params![name, filename],
    )?;
    Ok(())
}

/// Deletes every row; the caller removes the directory.
pub fn clear_artist_images(conn: &Connection) -> AppResult<()> {
    conn.execute("DELETE FROM artist_images", [])?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory_for_tests as mem;

    #[test]
    fn an_artist_image_round_trips_and_replacement_reports_the_orphan() {
        let conn = mem();
        assert_eq!(
            upsert_artist_image(&conn, "Hans Zimmer", "a.jpg", "local", 100).unwrap(),
            None
        );
        assert_eq!(
            upsert_artist_image(&conn, "Hans Zimmer", "a.jpg", "local", 150).unwrap(),
            None
        );
        assert_eq!(
            upsert_artist_image(&conn, "Hans Zimmer", "b.png", "local", 200).unwrap(),
            Some("a.jpg".to_string())
        );

        let rows = list_artist_images(&conn).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].name, "Hans Zimmer");
        assert_eq!(rows[0].filename, "b.png");
        assert_eq!(rows[0].updated_at, 200);
    }

    #[test]
    fn removing_an_artist_image_hands_back_its_file() {
        let conn = mem();
        upsert_artist_image(&conn, "Hans Zimmer", "a.jpg", "local", 100).unwrap();

        assert_eq!(
            remove_artist_image(&conn, "Hans Zimmer").unwrap(),
            Some("a.jpg".to_string())
        );
        assert!(list_artist_images(&conn).unwrap().is_empty());
        assert_eq!(remove_artist_image(&conn, "Hans Zimmer").unwrap(), None);
    }

    #[test]
    fn a_rename_moves_the_image_with_the_name() {
        let conn = mem();
        upsert_artist_image(&conn, "Hanz Zimmer", "a.jpg", "local", 100).unwrap();

        assert_eq!(
            rename_artist_image(&conn, "Hanz Zimmer", "Hans Zimmer", "Hans Zimmer.jpg").unwrap(),
            None
        );

        let rows = list_artist_images(&conn).unwrap();
        assert_eq!(rows[0].name, "Hans Zimmer");
        assert_eq!(rows[0].filename, "Hans Zimmer.jpg");
    }

    #[test]
    fn a_rename_onto_an_existing_image_keeps_the_target_and_orphans_the_source() {
        let conn = mem();
        upsert_artist_image(&conn, "Hanz Zimmer", "stray.jpg", "local", 100).unwrap();
        upsert_artist_image(&conn, "Hans Zimmer", "kept.jpg", "local", 100).unwrap();

        assert_eq!(
            rename_artist_image(&conn, "Hanz Zimmer", "Hans Zimmer", "unused.jpg").unwrap(),
            Some("stray.jpg".to_string())
        );

        let rows = list_artist_images(&conn).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].filename, "kept.jpg");
    }

    #[test]
    fn a_rename_with_no_image_is_a_no_op() {
        let conn = mem();
        assert_eq!(
            rename_artist_image(&conn, "Nobody", "Somebody", "Somebody.jpg").unwrap(),
            None
        );
        assert!(list_artist_images(&conn).unwrap().is_empty());
    }
}
