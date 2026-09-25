//! Job and track records, as persisted and sent to the front.

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum JobKind {
    Single,
    Album,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum JobStatus {
    Queued,
    Downloading,
    Importing,
    Enriching,
    Done,
    Failed,
    /// Stopped by the user. Resume markers survive for a retry.
    Cancelled,
}

impl JobStatus {
    /// The job has stopped, however it ended, and written everything it will.
    pub fn is_settled(self) -> bool {
        matches!(self, Self::Done | Self::Failed | Self::Cancelled)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum JobStep {
    Download,
    Import,
    Enrich,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TrackStatus {
    Pending,
    Downloading,
    Downloaded,
    Imported,
    Done,
    Failed,
    /// Removed, private or blocked at the source: nothing to retry.
    Unavailable,
}

/// One playlist entry. `staged_path`/`item_id` are the per-track resume point.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumTrack {
    /// 1-based.
    pub index: u32,
    pub video_id: String,
    pub url: String,
    pub title: Option<String>,
    pub duration: Option<f64>,
    pub status: TrackStatus,
    pub error: Option<String>,
    pub staged_path: Option<String>,
    pub item_id: Option<i64>,
    pub report: Option<Value>,
    /// Kept item this track duplicated (same recording); enrich removed it.
    #[serde(default)]
    pub duplicate_of: Option<i64>,
    /// Download attempts started; every attempt but the last has failed.
    #[serde(default)]
    pub download_attempts: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Job {
    pub id: String,
    pub url: String,
    pub kind: JobKind,
    pub status: JobStatus,
    pub failed_step: Option<JobStep>,
    pub error: Option<String>,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub thumbnail: Option<String>,
    pub duration: Option<f64>,
    pub staged_path: Option<String>,
    /// Set once imported; a retry resumes at enrich.
    #[serde(default)]
    pub item_id: Option<i64>,
    pub report: Option<Value>,
    /// Empty for singles. Album jobs keep `report` at `None`; the front
    /// aggregates per track.
    #[serde(default)]
    pub tracks: Vec<AlbumTrack>,
    /// Single jobs only; album jobs count per track.
    #[serde(default)]
    pub download_attempts: u32,
    /// Library category (beets' `grouping`), applied after enrich so the user's
    /// choice wins. `None` leaves it untouched.
    #[serde(default)]
    pub category: Option<String>,
    /// Album the user assigned to this playlist; `None` is the normal path.
    #[serde(default)]
    pub forced_album: Option<ForcedAlbum>,
    /// File the playlist as one record. Ignored when `forced_album` is set.
    #[serde(default = "default_single_album")]
    pub single_album: bool,
    /// Unavailable playlist slots, skipped but counted.
    #[serde(default)]
    pub unavailable: u32,
    /// When the job's library output was undone. The row stays in the history.
    #[serde(default)]
    pub undone_at: Option<u64>,
    pub created_at: u64,
    pub updated_at: u64,
}

/// Also the default for jobs persisted before the option existed.
fn default_single_album() -> bool {
    true
}

/// The album a download must land on: a new user-named record or an existing
/// one. Tracks are still identified individually.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ForcedAlbum {
    pub title: String,
    #[serde(default)]
    pub artist: Option<String>,
    /// An existing album row to land on; `title`/`artist` then only describe it.
    #[serde(default)]
    pub album_id: Option<i64>,
}
