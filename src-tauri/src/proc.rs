//! All subprocesses start here, for Windows:
//! - `CREATE_NO_WINDOW` stops each console child flashing a window.
//! - System tools are called by absolute path, which differs per OS. Windows
//!   10 1803+ ships `tar` (bsdtar, which also reads zip) in System32.

use std::ffi::OsStr;

use tokio::process::Command;

/// The child gets no console; the sidecar only uses pipes.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[cfg(windows)]
pub const SYSTEM_TAR: &str = r"C:\Windows\System32\tar.exe";
#[cfg(not(windows))]
pub const SYSTEM_TAR: &str = "/usr/bin/tar";

/// Use instead of `Command::new` everywhere.
pub fn command(program: impl AsRef<OsStr>) -> Command {
    #[allow(unused_mut)]
    let mut cmd = Command::new(program);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}
