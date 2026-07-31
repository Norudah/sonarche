//! Every subprocess the app starts goes through here.
//!
//! Two reasons, both Windows.
//!
//! A GUI process on Windows owns no console, so each console child it spawns
//! allocates one of its own — a black window that pops up and vanishes. On the
//! setup path that is one flash per pip step, per interpreter probe, per
//! extraction, and one more every time the sidecar restarts. `CREATE_NO_WINDOW`
//! suppresses it, and it has to be set at every single spawn site, which is
//! exactly why no site calls `Command::new` directly any more.
//!
//! And the two system tools we shell out to live at different absolute paths on
//! each OS. They are still called by absolute path and never through `PATH`;
//! only the address changes. Windows has shipped both in System32 since 10 1803
//! — `tar` is bsdtar, so it reads the app's gzipped tarball and Chromaprint's
//! zip with the same invocation.

use std::ffi::OsStr;

use tokio::process::Command;

/// Not `CREATE_NEW_CONSOLE`'s opposite but its absence: the child runs with no
/// console at all. Safe for the sidecar, which speaks over pipes and never
/// writes to a terminal.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[cfg(windows)]
pub const SYSTEM_TAR: &str = r"C:\Windows\System32\tar.exe";
#[cfg(not(windows))]
pub const SYSTEM_TAR: &str = "/usr/bin/tar";

/// A `Command` that will not flash a console window on Windows. Use in place of
/// `Command::new` everywhere.
pub fn command(program: impl AsRef<OsStr>) -> Command {
    #[allow(unused_mut)]
    let mut cmd = Command::new(program);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}
