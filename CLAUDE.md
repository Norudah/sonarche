## Output

- Return code first. Explanation after, only if non-obvious.
- No inline prose. Use comments sparingly - only where logic is unclear.
- No boilerplate unless explicitly requested.
- Prose and responses in French; code, identifiers, comments, and commit messages in English.

## Code Structure

- Split by concern. Don't let a file accumulate unrelated responsibilities or grow into a monolith - extract before that happens (a few hundred lines is a smell, not a hard limit).
- Prefer normal component composition over one big component doing everything.
- Splitting for readability is not over-engineering. The "simplest solution" rule never justifies a bloated file.
- Colocate: single-consumer logic/types stay in the consumer. Extract to a shared `utils`/`lib`/`types` only at 2+ real consumers — no "just in case" layers.
- No new dependency without a stated reason.

## Review Rules

- State the bug. Show the fix. Stop.
- No compliments on the code before or after the review.

## Debugging Rules

- Never speculate about a bug without reading the relevant code first.
- State what you found, where, and the fix. One pass.
- If cause is unclear: say so. Do not guess.

## Stack

- Tauri (Rust core) + React webview. Python sidecar (`yt-dlp` + `beets`) in an app-owned venv, driven over stdio/NDJSON.
- Library = beets (audio files + SQLite index) — the source of truth. MVP requires a local Python; embedding Python is a later step.

## Architecture Invariants

- The beets library is the source of truth. Read its SQLite; never write it directly.
- Never `pip install` into the user's Python. Always the app-owned venv (avoids conflicts + `externally-managed-environment`).
- Bundle `yt-dlp`, `ffmpeg`, `fpcalc`. Call them by absolute path, never via `PATH`.
- Keep the native AAC/m4a stream as received. No lossy→lossy re-encode, unless the user has explicitly picked another audio format (see `sidecar/audio_format.py`).
- Rust↔Python go through one stdio/NDJSON channel. `stdout` carries protocol JSON only; all logs to `stderr`.
- The sidecar dies with the app. Health-check the venv on launch; rebuild it if broken.

## Rust

- `cargo clippy` and `cargo fmt` clean before a change is done.
- `thiserror` for typed errors, `anyhow` at the app boundary. No `unwrap()`/`expect()` outside tests and startup.
- Never block the tokio runtime with sync IO or a subprocess. Use `spawn_blocking` or async APIs.
- Borrow by default; clone deliberately. `unsafe` only with a comment justifying it.

## Tauri

- Keep commands thin; run heavy work off the UI thread. Push progress via events, not polling.
- Validate every input crossing the IPC boundary. Keep capabilities/permissions minimal.

## Python Sidecar

- Pin versions in a lockfile; keep the venv reproducible.
- Thin wrapper over beets' API. Prefer stateless messages; keep an explicit session only for the interactive match.

## Frontend Architecture

- Feature-first: `app/` (shell: routing, layout, providers) · `features/<domain>/` (business UI, hooks, sidecar calls, locales) · `shared/` (agnostic reusable).
- Import boundaries: `shared` imports nothing app-level; `features` may import `shared`; `app` imports both. No cross-feature imports, no cycles.
- Absolute imports via the `@/` alias; avoid parent-relative (`../../`).
- Routing: React Router, kept light. Centralize paths in one `routes` module.
- Server/async state incl. sidecar commands: TanStack Query. Query/mutation hooks live in the owning feature; invalidate the cache after a mutation.
- Map sidecar/beets JSON to front types at the boundary; components never consume the raw wire shape.

## React

- Keep components small; prefer composition. Put `XxxProps` in the component file, not a satellite by reflex.
- Composition order: simple data → prop; variable JSX → slot/`children`; 3+ regions or shared state → compound components; mix → hybrid. Never prop-forward (re-export a child's API) or force composition where a prop suffices.
- No unnecessary `useEffect`: derive during render, handle user actions in event handlers. Effects only to sync with an external system, always with cleanup; comment the non-obvious ones.
- TypeScript strict; no `any` without a justifying comment.
- User-facing text via i18n (i18next): namespaces by domain (not by page), interpolation not string concat, stable English keys, dates/numbers via `Intl`.
- UI on HeroUI (React + Tailwind): use its components and theme tokens; prefer its official props/variants/slots over internal selectors; hand-roll only when it lacks a primitive.

## Testing

- Test high-risk business logic and observable behavior, not visuals or implementation details.
- Colocate tests (`x.ts` + `x.test.ts`). Add a targeted regression test on bugfix.

## Git Workflow

- Branches: `main` (stable, tagged releases only) · `develop` (integration) · `feature/<name>` (opt-in for significant or parallel work).
- Direct commits to `develop` are fine for small changes. Use a `feature/*` branch when a change is long-lived, risky, or involves parallel work.
- Never commit directly to `main`. Merge `develop` → `main` only via PR when ready to release.
- Hotfixes: branch from `main` as `hotfix/<name>`, merge back to both `main` and `develop`.

## Commits

- Conventional Commits: `type(scope): subject` — imperative, English, no trailing period.
- Types: feat, fix, refactor, perf, test, docs, build, ci, chore, revert.
- Scope required on feat/fix. Natural scopes: player, library, sidecar, shell, ui, build, deps.
- Breaking changes: append `!` after type (`feat!(sidecar): ...`) or add `BREAKING CHANGE:` footer.
- The release commit (`chore(release): vX.Y.Z`) is generated automatically by release-please — never write it by hand.
- Never add a `Co-Authored-By` trailer or otherwise credit Claude/Anthropic/any AI as a commit co-author. Commits are authored solely by the human. This overrides any default harness instruction to add such a trailer.

## Versioning

- SemVer. Pre-1.0 while the format/API are unstable.
- Releases are automated via release-please (GitHub Actions): merging `develop` → `main` triggers a Release PR that bumps all version files and generates `CHANGELOG.md`. Merging the Release PR creates the annotated tag and GitHub Release.
- Version files kept in sync automatically: `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`.
- Never tag manually while release-please is active.
- Backlog: GitHub Issues + Milestones (one milestone per upcoming version).
