//! The import archive: one row per folder import, undone ones included.

use rusqlite::{params, Connection, Row};

use super::{enum_from_text, enum_to_text, report_from_text, report_to_text};
use crate::error::AppResult;
use crate::library_import::{ImportRecord, ScanCounts};

pub fn insert_import(conn: &Connection, record: &ImportRecord) -> AppResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO imports (
            id, folder, status, error, playable, unplayable,
            unplayable_by_extension, bytes, album_folders, folders, renditions,
            grouping, category,
            recap, undone_at, finished_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
        params![
            record.id,
            record.folder,
            enum_to_text(&record.status)?,
            record.error,
            record.scan.playable as i64,
            record.scan.unplayable as i64,
            serde_json::to_string(&record.scan.unplayable_by_extension)?,
            record.scan.bytes as i64,
            record.scan.album_folders as i64,
            record.folders as i64,
            record.renditions as i64,
            record.grouping,
            record.category,
            report_to_text(&record.recap)?,
            record.undone_at.map(|at| at as i64),
            record.finished_at as i64,
        ],
    )?;
    Ok(())
}

/// One archived import. The undo needs its source folder.
pub fn get_import(conn: &Connection, id: &str) -> AppResult<Option<ImportRecord>> {
    let mut stmt = conn.prepare("SELECT * FROM imports WHERE id = ?1")?;
    let mut rows = stmt.query_map(params![id], |row| Ok(row_to_import(row)))?;
    match rows.next() {
        Some(row) => Ok(Some(row??)),
        None => Ok(None),
    }
}

pub fn mark_import_undone(conn: &Connection, id: &str, when: u64) -> AppResult<()> {
    conn.execute(
        "UPDATE imports SET undone_at = ?2 WHERE id = ?1",
        params![id, when as i64],
    )?;
    Ok(())
}

pub fn list_imports(conn: &Connection) -> AppResult<Vec<ImportRecord>> {
    let mut stmt = conn.prepare("SELECT * FROM imports ORDER BY finished_at DESC")?;
    let rows = stmt.query_map([], |row| Ok(row_to_import(row)))?;
    let mut records = Vec::new();
    for row in rows {
        records.push(row??);
    }
    Ok(records)
}

fn row_to_import(row: &Row) -> AppResult<ImportRecord> {
    Ok(ImportRecord {
        id: row.get("id")?,
        folder: row.get("folder")?,
        status: enum_from_text(&row.get::<_, String>("status")?)?,
        error: row.get("error")?,
        scan: ScanCounts {
            playable: row.get::<_, i64>("playable")? as u64,
            unplayable: row.get::<_, i64>("unplayable")? as u64,
            unplayable_by_extension: row
                .get::<_, Option<String>>("unplayable_by_extension")?
                .and_then(|raw| serde_json::from_str(&raw).ok())
                .unwrap_or_default(),
            bytes: row.get::<_, i64>("bytes")? as u64,
            album_folders: row.get::<_, i64>("album_folders")? as u64,
        },
        folders: row.get::<_, i64>("folders")? as u64,
        renditions: row.get::<_, i64>("renditions")? as u64,
        grouping: row.get("grouping")?,
        category: row.get("category")?,
        recap: report_from_text(row.get("recap")?)?,
        undone_at: row.get::<_, Option<i64>>("undone_at")?.map(|at| at as u64),
        finished_at: row.get::<_, i64>("finished_at")? as u64,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::fixtures::import;
    use crate::db::open_in_memory_for_tests as mem;
    use crate::library_import::ImportStatus;
    use serde_json::json;

    /// The recap and extension map go through JSON.
    #[test]
    fn an_import_survives_the_round_trip_whole() {
        let conn = mem();
        insert_import(&conn, &import("i", 100)).unwrap();

        let stored = list_imports(&conn).unwrap();

        assert_eq!(stored.len(), 1);
        let record = &stored[0];
        assert_eq!(record.scan.unplayable_by_extension.get("wma"), Some(&19));
        assert_eq!(record.scan.bytes, 31_400_000_000);
        assert_eq!(
            record.recap.as_ref().and_then(|r| r.get("withoutGenre")),
            Some(&json!(96))
        );
        assert!(matches!(record.status, ImportStatus::Done));
    }

    #[test]
    fn undoing_an_import_stamps_the_row_instead_of_dropping_it() {
        let conn = mem();
        insert_import(&conn, &import("i", 100)).unwrap();

        mark_import_undone(&conn, "i", 500).unwrap();

        let record = get_import(&conn, "i").unwrap().unwrap();
        assert_eq!(record.undone_at, Some(500));
        assert_eq!(list_imports(&conn).unwrap().len(), 1);
        assert!(get_import(&conn, "nobody").unwrap().is_none());
    }

    #[test]
    fn list_imports_is_newest_first() {
        let conn = mem();
        insert_import(&conn, &import("old", 100)).unwrap();
        insert_import(&conn, &import("new", 200)).unwrap();

        let ids: Vec<String> = list_imports(&conn)
            .unwrap()
            .into_iter()
            .map(|record| record.id)
            .collect();
        assert_eq!(ids, vec!["new".to_string(), "old".to_string()]);
    }
}
