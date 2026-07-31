use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;

use serde::Deserialize;
use serde_json::value::RawValue;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin};
use tokio::sync::{oneshot, Mutex};
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::python_env::AppPaths;

/// A reply, still as the bytes the sidecar wrote.
///
/// `RawValue` rather than `Value` because of one caller: the library listing is
/// ~6.4 MB of JSON at 10 000 tracks, and parsing that into a tree only to
/// serialize it straight back out for the IPC allocates a map and a string per
/// field per track, twice, for nothing. Kept raw, it is copied once and handed
/// to Tauri as-is. Every other reply is a handful of bytes and gets parsed on
/// arrival by whoever wants a `Value` — see `SidecarState::request`.
type Reply = Result<Box<RawValue>, String>;

type Pending = Arc<Mutex<HashMap<String, oneshot::Sender<Reply>>>>;

/// Just enough of a response line to route it. `result` deliberately stays raw:
/// naming it `Value` here would reintroduce the parse this type exists to skip.
#[derive(Deserialize)]
struct Envelope {
    id: Option<String>,
    event: Option<String>,
    ok: Option<bool>,
    result: Option<Box<RawValue>>,
    error: Option<EnvelopeError>,
}

#[derive(Deserialize)]
struct EnvelopeError {
    message: Option<String>,
}

struct SidecarHandle {
    child: Child,
    stdin: ChildStdin,
    pending: Pending,
}

/// One sidecar process and the requests in flight on it.
///
/// A channel is strictly serial by construction: `main.py` reads one line,
/// runs its handler to completion, and only then reads the next. That is why
/// there are two of them (see `SidecarState`) rather than one shared pipe.
#[derive(Default)]
struct SidecarChannel {
    inner: Mutex<Option<SidecarHandle>>,
}

/// Two sidecar processes, split by what the request does rather than by which
/// module answers it.
///
/// The Python loop handles one request at a time, and the work it does is not
/// short: an album enrich fingerprints every track, calls MusicBrainz, the
/// Cover Art Archive and Last.fm, and paces itself with real sleeps between
/// them — minutes, routinely. On a single pipe every read queued behind that,
/// so opening the library during a download waited out the whole album and then
/// failed on the 60s query timeout, with nothing actually broken.
///
/// `read` answers the listing and nothing else. It opens the beets DB read-only
/// (`mode=ro`), so the split costs no write safety: the writer stays alone on
/// `work`, and the reader cannot become a second one.
#[derive(Default)]
pub struct SidecarState {
    work: SidecarChannel,
    read: SidecarChannel,
}

/// What a response line asks this side to do.
enum Routed {
    /// A progress event: no id, forwarded whole to the front.
    Event,
    /// A reply to the request with this id.
    Reply(String, Reply),
    /// Nothing to do — an id we are not waiting on, or an unparseable line.
    Ignore,
}

/// Read one response line.
///
/// Settling ok/error here rather than in the caller is deliberate: past this
/// point the payload is opaque bytes, so this is the last place that can tell a
/// result from a failure without parsing it a second time.
fn route(line: &str) -> Routed {
    let Ok(msg) = serde_json::from_str::<Envelope>(line) else {
        return Routed::Ignore;
    };
    if msg.event.is_some() {
        return Routed::Event;
    }
    let Some(id) = msg.id else {
        return Routed::Ignore;
    };
    // A result the sidecar reported as absent is `null`, not an error: some
    // commands legitimately answer with nothing.
    let reply = if msg.ok == Some(true) {
        Ok(msg.result.unwrap_or_else(|| RawValue::NULL.to_owned()))
    } else {
        Err(msg
            .error
            .and_then(|e| e.message)
            .unwrap_or_else(|| "unknown sidecar error".into()))
    };
    Routed::Reply(id, reply)
}

fn spawn_stdout_reader(app: AppHandle, stdout: tokio::process::ChildStdout, pending: Pending) {
    tauri::async_runtime::spawn(async move {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            match route(&line) {
                Routed::Event => match RawValue::from_string(line) {
                    Ok(raw) => {
                        let _ = app.emit("sidecar:event", raw);
                    }
                    Err(err) => eprintln!("[sidecar] undeliverable event: {err}"),
                },
                Routed::Reply(id, reply) => {
                    if let Some(tx) = pending.lock().await.remove(&id) {
                        let _ = tx.send(reply);
                    }
                }
                Routed::Ignore => eprintln!("[sidecar] unroutable on stdout: {line}"),
            }
        }
        eprintln!("[sidecar] stdout closed");
        // Drop pending senders so awaiting requests fail fast instead of timing out.
        pending.lock().await.clear();
    });
}

fn spawn_stderr_reader(stderr: tokio::process::ChildStderr) {
    tauri::async_runtime::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            // To the log file, not just stderr: this stream carries the
            // sidecar's tracebacks, and on Windows stderr goes nowhere.
            crate::logs::write(&format!("[sidecar] {line}"));
        }
    });
}

async fn start(app: &AppHandle) -> AppResult<SidecarHandle> {
    let paths = AppPaths::resolve(app)?;
    let venv_python = paths.venv_python();
    if !tokio::fs::try_exists(&venv_python).await.unwrap_or(false) {
        return Err(AppError::EnvNotReady(
            "virtual environment missing, run setup first".into(),
        ));
    }

    let beets_dir = paths
        .beets_config
        .parent()
        .ok_or_else(|| AppError::EnvNotReady("beets config dir not found".into()))?;

    let mut child = crate::proc::command(&venv_python)
        .arg("-u")
        .arg(&paths.sidecar_main)
        .env("PYTHONUNBUFFERED", "1")
        // Python's UTF-8 Mode. `protocol` pins the channel's own encoding, but
        // that only covers the three streams it owns; this covers the rest —
        // `open()`'s default, the filesystem encoding, and the locale encoding
        // that `subprocess` text mode reads. Without it, on Windows, all of
        // those are cp1252 and any accent is a crash waiting for the right
        // filename.
        .env("PYTHONUTF8", "1")
        // The in-process beets must read the same config.yaml the beet CLI
        // gets via --config; otherwise it would pick up the user's own beets
        // config (or none), drifting from write_beets_config().
        .env("BEETSDIR", beets_dir)
        .current_dir(
            paths
                .sidecar_main
                .parent()
                .ok_or_else(|| AppError::EnvNotReady("sidecar resource dir not found".into()))?,
        )
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()?;

    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| AppError::Sidecar("failed to open sidecar stdin".into()))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| AppError::Sidecar("failed to open sidecar stdout".into()))?;
    if let Some(stderr) = child.stderr.take() {
        spawn_stderr_reader(stderr);
    }

    let pending: Pending = Arc::new(Mutex::new(HashMap::new()));
    spawn_stdout_reader(app.clone(), stdout, pending.clone());

    Ok(SidecarHandle {
        child,
        stdin,
        pending,
    })
}

impl SidecarChannel {
    async fn request(
        &self,
        app: &AppHandle,
        cmd: &str,
        params: Value,
        timeout: Duration,
    ) -> AppResult<Box<RawValue>> {
        let id = Uuid::new_v4().to_string();
        let (tx, rx) = oneshot::channel();

        let pending = {
            let mut guard = self.inner.lock().await;
            // Restart the sidecar if it died since the last request.
            let dead = matches!(
                guard.as_mut().map(|h| h.child.try_wait()),
                Some(Ok(Some(_)))
            );
            if dead {
                eprintln!("[sidecar] process died, restarting");
                *guard = None;
            }
            if guard.is_none() {
                *guard = Some(start(app).await?);
            }
            let handle = guard
                .as_mut()
                .ok_or_else(|| AppError::Sidecar("unreachable".into()))?;
            handle.pending.lock().await.insert(id.clone(), tx);

            let line = serde_json::to_string(&json!({ "id": id, "cmd": cmd, "params": params }))?;
            if let Err(err) = handle.stdin.write_all(format!("{line}\n").as_bytes()).await {
                *guard = None;
                return Err(AppError::Sidecar(format!(
                    "failed to write to sidecar: {err}"
                )));
            }
            handle.pending.clone()
        };

        match tokio::time::timeout(timeout, rx).await {
            Ok(Ok(Ok(result))) => Ok(result),
            Ok(Ok(Err(message))) => Err(AppError::Sidecar(message)),
            Ok(Err(_)) => Err(AppError::Sidecar("sidecar exited unexpectedly".into())),
            Err(_) => {
                pending.lock().await.remove(&id);
                Err(AppError::Sidecar(format!("request '{cmd}' timed out")))
            }
        }
    }

    async fn shutdown(&self) {
        if let Some(mut handle) = self.inner.lock().await.take() {
            let _ = handle.child.start_kill();
        }
    }
}

impl SidecarState {
    /// Anything that downloads, imports, enriches or writes tags. Serial, and
    /// free to take as long as it takes.
    ///
    /// Parses the reply into a `Value` for the caller's convenience: these
    /// replies are a handful of fields (`{"updated": 3}`, `{"matched": true}`),
    /// so the tree costs nothing and the callers read it.
    pub async fn request(
        &self,
        app: &AppHandle,
        cmd: &str,
        params: Value,
        timeout: Duration,
    ) -> AppResult<Value> {
        let raw = self.work.request(app, cmd, params, timeout).await?;
        Ok(serde_json::from_str(raw.get())?)
    }

    /// Read-only queries the UI waits on. Never queues behind `request`, and
    /// answers in the sidecar's own bytes — nothing here inspects the payload,
    /// and the listing is far too big to parse for the privilege of not
    /// looking at it.
    pub async fn read(
        &self,
        app: &AppHandle,
        cmd: &str,
        params: Value,
        timeout: Duration,
    ) -> AppResult<Box<RawValue>> {
        self.read.request(app, cmd, params, timeout).await
    }

    pub async fn shutdown(&self) {
        self.work.shutdown().await;
        self.read.shutdown().await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn reply_of(line: &str) -> (String, Reply) {
        match route(line) {
            Routed::Reply(id, reply) => (id, reply),
            _ => panic!("expected a reply for: {line}"),
        }
    }

    #[test]
    fn result_is_handed_back_as_the_bytes_the_sidecar_wrote() {
        // The whole point of the read channel: no reserialization, so the
        // payload must come out byte-identical, key order included.
        let payload = r#"{"tracks":[{"id":1,"title":"Lucy","length":200.1}]}"#;
        let (id, reply) = reply_of(&format!(r#"{{"id":"abc","ok":true,"result":{payload}}}"#));

        assert_eq!(id, "abc");
        assert_eq!(reply.expect("ok reply").get(), payload);
    }

    #[test]
    fn a_raw_result_serializes_as_json_not_as_an_escaped_string() {
        // What the IPC does with the command's return value. A `RawValue` that
        // serialized as a quoted string would reach the front as text, and
        // `listLibrary` would map over a string instead of tracks — so this is
        // the assertion the read channel actually rests on.
        let payload = r#"{"tracks":[{"id":1,"title":"Lucy"}]}"#;
        let (_, reply) = reply_of(&format!(r#"{{"id":"abc","ok":true,"result":{payload}}}"#));

        let wire = serde_json::to_string(&reply.expect("ok reply")).expect("serializes");

        assert_eq!(wire, payload);
    }

    #[test]
    fn failure_carries_the_sidecar_message() {
        let (_, reply) =
            reply_of(r#"{"id":"abc","ok":false,"error":{"code":"internal","message":"boom"}}"#);

        assert_eq!(reply.expect_err("error reply"), "boom");
    }

    #[test]
    fn failure_without_a_message_still_fails() {
        let (_, reply) = reply_of(r#"{"id":"abc","ok":false}"#);

        assert_eq!(reply.expect_err("error reply"), "unknown sidecar error");
    }

    #[test]
    fn ok_without_a_result_is_null_rather_than_an_error() {
        let (_, reply) = reply_of(r#"{"id":"abc","ok":true}"#);

        assert_eq!(reply.expect("ok reply").get(), "null");
    }

    #[test]
    fn progress_events_are_forwarded_not_matched_to_a_request() {
        // Events carry no id; routing one as a reply would drop it and leave
        // the real request hanging until its timeout.
        assert!(matches!(
            route(r#"{"event":"download_progress","data":{"percent":42.0}}"#),
            Routed::Event
        ));
    }

    #[test]
    fn garbage_on_stdout_is_ignored_rather_than_fatal() {
        assert!(matches!(route("not json at all"), Routed::Ignore));
        assert!(matches!(
            route(r#"{"ok":true,"result":{}}"#),
            Routed::Ignore
        ));
    }
}
