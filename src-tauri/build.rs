fn main() {
    // tauri_build copies the resources (../sidecar) into target/ from this
    // build script; without this hint, editing a Python file never re-runs it
    // and `tauri dev` keeps launching a stale sidecar copy.
    println!("cargo:rerun-if-changed=../sidecar");
    tauri_build::build()
}
