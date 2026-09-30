//! Guards the manual re-enrich action (which hits MusicBrainz/AcoustID):
//! one run per item at a time, plus a cooldown after each.

use std::collections::{HashMap, HashSet};
use std::time::{Duration, Instant};

use serde_json::Value;
use tauri::AppHandle;
use tokio::sync::Mutex;

use crate::error::{AppError, AppResult};
use crate::jobs;

const COOLDOWN: Duration = Duration::from_secs(10);

#[derive(Default)]
struct Inner {
    in_flight: HashSet<i64>,
    last_run: HashMap<i64, Instant>,
}

#[derive(Default)]
pub struct ReenrichState {
    inner: Mutex<Inner>,
}

impl ReenrichState {
    pub async fn run(&self, app: &AppHandle, item_id: i64) -> AppResult<Value> {
        {
            let mut inner = self.inner.lock().await;
            if inner.in_flight.contains(&item_id) {
                return Err(AppError::InvalidInput("already re-enriching".into()));
            }
            if let Some(finished) = inner.last_run.get(&item_id) {
                if finished.elapsed() < COOLDOWN {
                    return Err(AppError::InvalidInput("re-enriched moments ago".into()));
                }
            }
            inner.in_flight.insert(item_id);
        }

        let result = jobs::enrich_item(app, item_id, None, None).await;

        // Await the lock (not a Drop guard) so an item can't stay stuck; the
        // cooldown starts on finish.
        let mut inner = self.inner.lock().await;
        inner.in_flight.remove(&item_id);
        inner.last_run.insert(item_id, Instant::now());
        result
    }
}
