fn main() {
    // Re-run the build script (which copies ../sidecar) when Python files change.
    println!("cargo:rerun-if-changed=../sidecar");
    tauri_build::build()
}
