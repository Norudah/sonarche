//! App-state passthroughs on the shared connection: artist images and playlists.

use crate::error::AppResult;
use crate::jobs_store;
use crate::playlists;

use super::{now_ms, with_conn, JobsState};

impl JobsState {
    pub async fn count_playlist_memberships(
        &self,
        item_ids: std::collections::HashSet<i64>,
    ) -> AppResult<usize> {
        with_conn(&self.0, move |conn| {
            playlists::count_memberships(conn, &item_ids)
        })
        .await
    }

    /// Drops every playlist membership pointing at these items.
    pub async fn prune_playlists(
        &self,
        item_ids: std::collections::HashSet<i64>,
    ) -> AppResult<usize> {
        let now = now_ms();
        with_conn(&self.0, move |conn| {
            playlists::remove_items_everywhere(conn, &item_ids, now)
        })
        .await
    }

    // Artist images and playlists share this store; timestamps are set here so
    // the store functions stay pure.

    pub async fn list_artist_images(&self) -> AppResult<Vec<jobs_store::ArtistImageRow>> {
        with_conn(&self.0, jobs_store::list_artist_images).await
    }

    /// Returns the replaced file's name, if any.
    pub async fn set_artist_image(
        &self,
        name: String,
        filename: String,
        source: String,
    ) -> AppResult<Option<String>> {
        let now = now_ms();
        with_conn(&self.0, move |c| {
            jobs_store::upsert_artist_image(c, &name, &filename, &source, now)
        })
        .await
    }

    /// Returns the removed row's filename, if any.
    pub async fn remove_artist_image(&self, name: String) -> AppResult<Option<String>> {
        with_conn(&self.0, move |c| jobs_store::remove_artist_image(c, &name)).await
    }

    /// Returns the filename left unowned by the rename, if any. `filename` is the
    /// new name; the caller renames the file first.
    pub async fn rename_artist_image(
        &self,
        old: String,
        new: String,
        filename: String,
    ) -> AppResult<Option<String>> {
        with_conn(&self.0, move |c| {
            jobs_store::rename_artist_image(c, &old, &new, &filename)
        })
        .await
    }

    pub async fn clear_artist_images(&self) -> AppResult<()> {
        with_conn(&self.0, jobs_store::clear_artist_images).await
    }

    pub async fn list_playlists(&self) -> AppResult<Vec<playlists::PlaylistRow>> {
        with_conn(&self.0, playlists::list).await
    }

    pub async fn create_playlist(&self, name: String) -> AppResult<playlists::PlaylistRow> {
        let now = now_ms();
        with_conn(&self.0, move |c| playlists::create(c, &name, now)).await
    }

    pub async fn rename_playlist(&self, id: i64, name: String) -> AppResult<()> {
        let now = now_ms();
        with_conn(&self.0, move |c| playlists::rename(c, id, &name, now)).await
    }

    /// Returns the cover filename left unowned, if any.
    pub async fn delete_playlist(&self, id: i64) -> AppResult<Option<String>> {
        with_conn(&self.0, move |c| playlists::delete(c, id)).await
    }

    /// Returns the replaced file's name, if any.
    pub async fn set_playlist_cover(&self, id: i64, filename: String) -> AppResult<Option<String>> {
        let now = now_ms();
        with_conn(&self.0, move |c| {
            playlists::set_cover(c, id, &filename, now)
        })
        .await
    }

    pub async fn update_playlist_cover_filename(&self, id: i64, filename: String) -> AppResult<()> {
        let now = now_ms();
        with_conn(&self.0, move |c| {
            playlists::update_cover_filename(c, id, &filename, now)
        })
        .await
    }

    /// Returns the removed file's name, if any.
    pub async fn remove_playlist_cover(&self, id: i64) -> AppResult<Option<String>> {
        let now = now_ms();
        with_conn(&self.0, move |c| playlists::remove_cover(c, id, now)).await
    }

    /// An empty string clears the marker.
    pub async fn set_playlist_marker(&self, id: i64, marker: String) -> AppResult<()> {
        let now = now_ms();
        with_conn(&self.0, move |c| playlists::set_marker(c, id, &marker, now)).await
    }

    /// Returns (added, skipped as already present).
    pub async fn add_playlist_tracks(
        &self,
        id: i64,
        item_ids: Vec<i64>,
    ) -> AppResult<(usize, usize)> {
        let now = now_ms();
        with_conn(&self.0, move |c| {
            playlists::add_tracks(c, id, &item_ids, now)
        })
        .await
    }

    /// Returns how many rows were removed.
    pub async fn remove_playlist_tracks(&self, id: i64, positions: Vec<u32>) -> AppResult<usize> {
        let now = now_ms();
        with_conn(&self.0, move |c| {
            playlists::remove_positions(c, id, &positions, now)
        })
        .await
    }

    pub async fn move_playlist_track(&self, id: i64, from: u32, to: u32) -> AppResult<()> {
        let now = now_ms();
        with_conn(&self.0, move |c| {
            playlists::move_track(c, id, from, to, now)
        })
        .await
    }

    /// Best-effort; the caller only logs failures.
    pub async fn remove_item_from_playlists(&self, item_id: i64) -> AppResult<()> {
        let now = now_ms();
        with_conn(&self.0, move |c| {
            playlists::remove_item_everywhere(c, item_id, now)
        })
        .await
    }

    pub async fn clear_playlists(&self) -> AppResult<()> {
        let now = now_ms();
        with_conn(&self.0, move |c| {
            playlists::clear(c)?;
            // The built-in list survives an erase, emptied.
            playlists::ensure_favorites(c, now)
        })
        .await
    }

    /// Empties every playlist without deleting any (after a library wipe).
    pub async fn clear_playlist_memberships(&self) -> AppResult<()> {
        let now = now_ms();
        with_conn(&self.0, move |c| playlists::clear_memberships(c, now)).await
    }
}
