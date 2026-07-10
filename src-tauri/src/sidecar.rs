use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::{oneshot, Mutex};
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::python_env::AppPaths;

type Pending = Arc<Mutex<HashMap<String, oneshot::Sender<Value>>>>;

struct SidecarHandle {
    child: Child,
    stdin: ChildStdin,
    pending: Pending,
}

#[derive(Default)]
pub struct SidecarState {
    inner: Mutex<Option<SidecarHandle>>,
}

fn spawn_stdout_reader(app: AppHandle, stdout: tokio::process::ChildStdout, pending: Pending) {
    tauri::async_runtime::spawn(async move {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            match serde_json::from_str::<Value>(&line) {
                Ok(msg) if msg.get("event").is_some() => {
                    let _ = app.emit("sidecar:event", &msg);
                }
                Ok(msg) => {
                    if let Some(id) = msg.get("id").and_then(|v| v.as_str()) {
                        if let Some(tx) = pending.lock().await.remove(id) {
                            let _ = tx.send(msg);
                        }
                    }
                }
                Err(_) => eprintln!("[sidecar] non-JSON on stdout: {line}"),
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
            eprintln!("[sidecar] {line}");
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

    let mut child = Command::new(&venv_python)
        .arg("-u")
        .arg(&paths.sidecar_main)
        .env("PYTHONUNBUFFERED", "1")
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

impl SidecarState {
    pub async fn request(
        &self,
        app: &AppHandle,
        cmd: &str,
        params: Value,
        timeout: Duration,
    ) -> AppResult<Value> {
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

        let response = match tokio::time::timeout(timeout, rx).await {
            Ok(Ok(msg)) => msg,
            Ok(Err(_)) => return Err(AppError::Sidecar("sidecar exited unexpectedly".into())),
            Err(_) => {
                pending.lock().await.remove(&id);
                return Err(AppError::Sidecar(format!("request '{cmd}' timed out")));
            }
        };

        if response.get("ok").and_then(Value::as_bool) == Some(true) {
            Ok(response.get("result").cloned().unwrap_or(Value::Null))
        } else {
            let message = response
                .pointer("/error/message")
                .and_then(Value::as_str)
                .unwrap_or("unknown sidecar error");
            Err(AppError::Sidecar(message.to_string()))
        }
    }

    pub async fn shutdown(&self) {
        if let Some(mut handle) = self.inner.lock().await.take() {
            let _ = handle.child.start_kill();
        }
    }
}
