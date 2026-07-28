# Build & release backlog

Everything left that is about shipping the app rather than about the app. Parked
here on purpose, 2026-07-28, so feature work does not have to carry it.

Nothing below is a bug in the product. Order is what I would do first, not
priority as such.

## Ready to do

### 1. Merge `develop` → `main` and cut 0.10.0

release-please turns the merge into a Release PR; merging that PR tags and
builds. The `feat(build)` commits in develop mean a **minor**, so 0.10.0, with
three bundles: macOS ARM, macOS Intel, Windows x64.

This is also the only way to prove the Intel bundle works. Everything checkable
without a CI run has been checked (wheels, `cargo check --target
x86_64-apple-darwin`, fpcalc universal, no ffmpeg anywhere).

### 2. Verify an update that actually installs

Never done, on any platform — it needs two consecutive releases to be possible
at all. 0.9.1 → 0.10.0 is the first pair. The Settings → Updates pane is the
tool for it.

### 3. README

The repository has none. The section that matters most is "First launch": on
macOS the first thing an unsigned build says is _"Sonarche is damaged and can't
be opened"_, with Trash as the only button, and the way out is not guessable.
Needs screenshots.

## Never tested

- **Library import on Windows**, in particular a folder with an accented name.
  The surface was fixed blind during the port and never exercised.
- **First launch on a clean machine**, neither macOS nor Windows: no Python, no
  venv, no tools directory.

## Quality guardrails — decided against for now, not forgotten

Ranked by what they would actually have caught, after the Windows port:

1. **Windows-shaped inputs against the pure functions**, run on macOS. Free, no
   CI cost, and it is what would have saved the four round-trips that port took
   — the YAML quoting bug was trivially testable.
2. **Ruff on the sidecar**, for `PLW1514` (`open()` with no encoding). Linux,
   seconds. That family of bug cost a whole debugging session.
3. A **Windows runner for the sidecar suite** (~6 min/push). Useful for the
   encoding family, but far less worth it than it looked at first.

## Known, structural, not fixed

- **Windows file locking.** The player holds the file open while it plays, and
  Windows refuses to delete or move an open file. Deleting the playing track, or
  importing while listening, will fail on Windows where it works on macOS. No
  linter will ever catch this; it needs the player to release the handle.
- **The 260-character path limit** on Windows, with beets' `max_filename_length:
0`. A real risk on a deeply nested library.

## Open questions

- **Make the repository public?** Actions become free of quota. Requires a sweep
  of the history first: keys, tokens, personal paths.
- **Windows on ARM.** Technically possible since llvmlite left the dependency
  tree — all 28 wheels resolve for `win_arm64`. Not shipped: a fourth bundle is
  a fourth set of release minutes, and x64 runs under emulation. One line in
  `prepare-runtime.mjs` and one in the release matrix when it is worth it.

## Closed

- ~~Intel macOS blocked by llvmlite~~ — beets declared numba/llvmlite/scipy and
  imported none of them. Dropped from the lock; Intel lives, and the shipped
  wheel set went from 82 MB to 18 MB.
- ~~`--only-binary=:all:` guard~~ — in both the install and the prefetch.
- ~~CI waking the sidecar job for frontend-only pushes~~ — `checks.yml` split
  into `checks-front.yml` and `checks-sidecar.yml`, each with its own `paths`.
