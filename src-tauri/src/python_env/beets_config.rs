//! The beets config files (download and import flavours), regenerated on every launch.

use std::path::Path;

use crate::error::AppResult;

use super::paths::AppPaths;

/// Which way into the library a beets config is for.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Flavour {
    /// A staged download: one untagged file alone in an empty folder.
    App,
    /// The user's own collection, covers already beside the tracks.
    Import,
}

/// Writes the beets config, read by the CLI importer (`--config`) and by the
/// sidecar (BEETSDIR). Regenerated on every launch.
///
/// Two files, since beets takes a single `--config` with no key overrides.
/// The import flavour differs in:
/// - `embedart: no`: covers already sit beside the tracks; embedding them
///   duplicated ~300 MB on a 1.2 GB library.
/// - `fetchart.sources: filesystem`: an import must not reach the network.
/// - Filing templates with fallbacks, the incremental guard and the repair
///   plugin.
pub(super) async fn write_beets_config(paths: &AppPaths) -> AppResult<()> {
    ensure_derived_genre_files(paths).await?;
    write_config_file(paths, &paths.beets_config, Flavour::App).await?;
    write_config_file(paths, &paths.beets_import_config, Flavour::Import).await
}

/// Seeds the derived genre files from the bundled base until the sidecar
/// regenerates them.
async fn ensure_derived_genre_files(paths: &AppPaths) -> AppResult<()> {
    tokio::fs::create_dir_all(&paths.genres_dir).await?;
    for (bundled, derived) in [
        (&paths.genres_tree, paths.derived_genres_tree()),
        (&paths.genres_whitelist, paths.derived_genres_whitelist()),
    ] {
        if !tokio::fs::try_exists(&derived).await.unwrap_or(false) {
            tokio::fs::copy(bundled, &derived).await?;
        }
    }
    Ok(())
}

async fn write_config_file(paths: &AppPaths, target: &Path, flavour: Flavour) -> AppResult<()> {
    tokio::fs::write(target, beets_config_yaml(paths, flavour)).await?;
    Ok(())
}

/// A path as a single-quoted YAML scalar.
///
/// Double quotes treat `\` as an escape (`C:\Users` starts a `\U` escape).
/// Single quotes' only escape is a doubled `'`, for paths like `O'Brien`.
fn yaml_scalar(path: &Path) -> String {
    format!("'{}'", path.display().to_string().replace('\'', "''"))
}

/// Import filing templates, rendered by beets in `import_paths_test.py`.
///
/// Fallbacks keep untagged files out of `Music//`, and `%if{$track,…}`
/// drops the `00` prefix. `%ifdef` rather than `%if`: a missing flexible
/// attribute renders as the literal `$symbol`, which `%if` treats as true.
const IMPORT_PATHS: &str = r#"paths:
  default: 'Library/%if{$albumartist,$albumartist,Unknown Artist}/%if{$album,$album,Unknown Album}/%if{$track,$track ,}$title'
  singleton: '%ifdef{sonarche_provisional,Unidentified,Library/Singles}/%if{$artist,$artist,Unknown Artist}/$title'
  comp: 'Library/%if{$albumartist,$albumartist,Unknown Artist}/%if{$album,$album,Unknown Album}/%if{$track,$track ,}$title'
"#;

/// Download filing templates, also rendered in `import_paths_test.py`.
///
/// - `Library/`: verified music, `%aunique{}` separating same-named records.
/// - `Unidentified/`: items carrying the `sonarche_provisional` flag.
///
/// `comp` restates `default` so compilations file under their album artist.
/// It can't be omitted: beets merges defaults key by key, and its own `comp`
/// template is `Compilations/$album`.
const APP_PATHS: &str = r#"paths:
  default: 'Library/%if{$albumartist,$albumartist,Unknown Artist}/%if{$album,$album,Unknown Album}%aunique{}/%if{$track,$track ,}$title'
  singleton: '%ifdef{sonarche_provisional,Unidentified,Library/Singles}/%if{$artist,$artist,Unknown Artist}/$title'
  comp: 'Library/%if{$albumartist,$albumartist,Unknown Artist}/%if{$album,$album,Unknown Album}%aunique{}/%if{$track,$track ,}$title'
"#;

/// Lets a stopped import be relaunched without duplicating files. Import
/// flavour only: staged download folders are always new.
const INCREMENTAL: &str = r#"  incremental: yes
"#;

fn beets_config_yaml(paths: &AppPaths, flavour: Flavour) -> String {
    format!(
        r#"directory: {library}
library: {db}
import:
  move: yes
  write: yes
  quiet_fallback: asis
  # Never offer to resume an interrupted import: the prompt reads stdin, and
  # our beets runs headless on the sidecar's protocol pipe. An interrupted
  # run is retried from the top instead.
  resume: no
  # Staged files are imported untagged by design, so beets' duplicate check
  # can only ever collide blank-vs-blank (enriched items have real tags).
  # `skip` (the quiet default) silently drops every album-batch track after
  # the first one; real re-download duplicates never collide anyway.
  duplicate_action: keep
{incremental}{statefile}# cover-hq.* is the archive Sonarche <= 2.x kept beside beets' cover.jpg;
# nothing writes it anymore, but declaring the leftovers clutter lets beets
# prune a folder where one still lingers after a move or merge.
clutter: ["Thumbs.DB", ".DS_Store", "cover-hq.jpg", "cover-hq.png"]
{path_format}{pluginpath}plugins: musicbrainz fetchart embedart lastgenre{repair_plugin}
musicbrainz:
  genres: yes
fetchart:
  auto: yes
{art_sources}embedart:
  auto: {embed_art}
# auto: no — the import stage never runs lastgenre; enrich calls _get_genre()
# itself. Canonical tree + whitelist are the *derived* files the sidecar
# regenerates from the bundled base plus the user's placements (see
# genre_overrides.py): the stored genre is the most specific tree node
# (count 3, specific first), the browse bucket climbs the same tree.
lastgenre:
  auto: no
  source: track
  count: 3
  canonical: {tree}
  whitelist: {whitelist}
  prefer_specific: yes
  cleanup_existing: yes
  fallback: null
ui:
  color: no
"#,
        library = yaml_scalar(&paths.music_dir()),
        db = yaml_scalar(&paths.beets_db),
        tree = yaml_scalar(&paths.derived_genres_tree()),
        whitelist = yaml_scalar(&paths.derived_genres_whitelist()),
        embed_art = if flavour == Flavour::App { "yes" } else { "no" },
        incremental = if flavour == Flavour::Import {
            INCREMENTAL
        } else {
            ""
        },
        // Explicit path, so an erase can find it.
        statefile = if flavour == Flavour::Import {
            format!("statefile: {}\n", yaml_scalar(&paths.beets_import_state))
        } else {
            String::new()
        },
        path_format = if flavour == Flavour::Import {
            IMPORT_PATHS
        } else {
            APP_PATHS
        },
        art_sources = if flavour == Flavour::Import {
            "  sources: filesystem\n"
        } else {
            ""
        },
        // Filename-based tag repairs, for the user's own rips only.
        repair_plugin = if flavour == Flavour::Import {
            " sonarche_import"
        } else {
            ""
        },
        // Entries join the `beetsplug` namespace, so this must be the plugin folder.
        pluginpath = if flavour == Flavour::Import {
            format!(
                "pluginpath: [{}]\n",
                yaml_scalar(
                    &paths
                        .sidecar_main
                        .parent()
                        .unwrap_or(&paths.sidecar_main)
                        .join("beetsplug")
                )
            )
        } else {
            String::new()
        },
    )
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::super::tools::{DENO_BIN, FFMPEG_BIN, FPCALC_BIN};
    use super::*;

    fn paths() -> AppPaths {
        let data = PathBuf::from("/data");
        AppPaths {
            venv_dir: data.join("venv"),
            staging_dir: data.join("staging"),
            beets_config: data.join("beets").join("config.yaml"),
            beets_import_config: data.join("beets").join("config-import.yaml"),
            beets_import_state: data.join("beets").join("import-state.pickle"),
            beets_db: data.join("beets").join("library.db"),
            library_root: PathBuf::from("/music/Sonarche"),
            sidecar_main: data.join("sidecar").join("main.py"),
            requirements: data.join("sidecar").join("requirements.txt"),
            genres_tree: data.join("sidecar").join("genres-tree.yaml"),
            genres_whitelist: data.join("sidecar").join("genres-whitelist.txt"),
            genres_dir: data.join("genres"),
            tools_dir: data.join("tools"),
            python_archive: data.join("python.tar.gz"),
            runtime_dir: data.join("runtime"),
            wheels_dir: data.join("wheels"),
            bundled_fpcalc: data.join("tools").join(FPCALC_BIN),
            bundled_ffmpeg: data.join("tools").join(FFMPEG_BIN),
            bundled_deno: data.join("tools").join(DENO_BIN),
            deno_cache_dir: data.join("deno"),
        }
    }

    #[test]
    fn a_windows_path_is_not_read_as_a_yaml_escape() {
        let mut paths = paths();
        paths.library_root = PathBuf::from(r"C:\Users\pieru\Music\Sonarche");
        paths.beets_db = PathBuf::from(r"C:\Users\pieru\AppData\Roaming\beets\library.db");

        let config = beets_config_yaml(&paths, Flavour::App);

        // `music_dir()` uses the host separator.
        let expected = format!("directory: '{}'", paths.music_dir().display());
        assert!(config.contains(&expected), "{config}");
        // A backslash inside double quotes is an escape: no line may mix the two.
        for line in config.lines() {
            assert!(
                !(line.contains('\\') && line.contains('"')),
                "a backslash inside double quotes: {line}"
            );
        }
    }

    #[test]
    fn an_apostrophe_in_a_path_is_doubled_not_left_to_close_the_scalar() {
        let mut paths = paths();
        paths.library_root = PathBuf::from(r"C:\Users\O'Brien\Music");

        let config = beets_config_yaml(&paths, Flavour::App);

        let expected = format!(
            "directory: '{}'",
            paths.music_dir().display().to_string().replace('\'', "''")
        );
        assert!(expected.contains("O''Brien"), "{expected}");
        assert!(config.contains(&expected), "{config}");
    }

    #[test]
    fn the_import_config_turns_cover_embedding_off() {
        assert!(
            beets_config_yaml(&paths(), Flavour::App).contains("embedart:\n  auto: yes"),
            "the app config embeds"
        );
        assert!(
            beets_config_yaml(&paths(), Flavour::Import).contains("embedart:\n  auto: no"),
            "the import config does not"
        );
    }

    #[test]
    fn only_the_import_config_pins_art_to_the_filesystem() {
        assert!(
            beets_config_yaml(&paths(), Flavour::Import)
                .contains("fetchart:\n  auto: yes\n  sources: filesystem\n"),
            "the import config must not reach a remote art source"
        );
        assert!(
            !beets_config_yaml(&paths(), Flavour::App).contains("sources:"),
            "the app config leaves fetchart's own defaults alone"
        );
    }

    /// The flavours may differ only in their known lines.
    #[test]
    fn the_two_configs_differ_on_nothing_but_the_known_import_settings() {
        let app = beets_config_yaml(&paths(), Flavour::App);
        let import = beets_config_yaml(&paths(), Flavour::Import);

        let strip = |config: &str| {
            config
                .replace("  sources: filesystem\n", "")
                .replace("embedart:\n  auto: yes", "embedart:\n  auto: no")
                .replace(" sonarche_import", "")
                .replace(INCREMENTAL, "")
                .replace(IMPORT_PATHS, "")
                .replace(APP_PATHS, "")
                .lines()
                .filter(|line| !line.starts_with("pluginpath:") && !line.starts_with("statefile:"))
                .collect::<Vec<_>>()
                .join("\n")
        };

        assert_eq!(strip(&app), strip(&import));
    }

    #[test]
    fn only_the_import_config_guards_against_re_importing_and_nameless_folders() {
        let import = beets_config_yaml(&paths(), Flavour::Import);
        let app = beets_config_yaml(&paths(), Flavour::App);

        assert!(import.contains("incremental: yes"));
        assert!(import.contains("Unknown Artist"));
        // Must be where the erase can reach it.
        assert!(import.contains("statefile: '/data/beets/import-state.pickle'"));
        assert!(!app.contains("incremental"));
        assert!(!app.contains("statefile"));
    }

    #[test]
    fn the_app_config_keeps_aunique_and_files_guesses_in_the_zone() {
        let app = beets_config_yaml(&paths(), Flavour::App);
        assert!(app.contains(APP_PATHS), "{app}");
        assert!(app.contains("%aunique{}"), "{app}");
        assert!(app.contains("default: 'Library/"), "{app}");
        // The zone boundary is the provisional flag: imported singles are rowless too.
        assert!(
            app.contains("singleton: '%ifdef{sonarche_provisional,Unidentified,Library/Singles}/"),
            "{app}"
        );
        let import = beets_config_yaml(&paths(), Flavour::Import);
        assert!(
            import
                .contains("singleton: '%ifdef{sonarche_provisional,Unidentified,Library/Singles}/"),
            "{import}"
        );
    }

    #[test]
    fn neither_config_files_compilations_on_a_shelf_of_their_own() {
        for flavour in [Flavour::App, Flavour::Import] {
            let config = beets_config_yaml(&paths(), flavour);
            assert!(!config.contains("Compilations/"), "{config}");
            let rule = |key: &str| {
                config
                    .lines()
                    .find_map(|line| line.trim().strip_prefix(key))
                    .map(str::to_string)
                    .unwrap_or_default()
            };
            assert_eq!(rule("comp: "), rule("default: "), "{config}");
            assert!(rule("comp: ").starts_with("'Library/"), "{config}");
        }
    }

    #[test]
    fn only_the_import_config_loads_the_repair_plugin() {
        let import = beets_config_yaml(&paths(), Flavour::Import);
        assert!(import.contains("lastgenre sonarche_import"), "{import}");
        assert!(
            import.contains("pluginpath: ['/data/sidecar/beetsplug']"),
            "{import}"
        );

        let app = beets_config_yaml(&paths(), Flavour::App);
        assert!(!app.contains("sonarche_import"), "{app}");
        assert!(!app.contains("pluginpath"), "{app}");
    }

    #[test]
    fn both_configs_target_the_one_library() {
        for flavour in [Flavour::App, Flavour::Import] {
            let config = beets_config_yaml(&paths(), flavour);
            assert!(config.contains(&format!("directory: '{}'", paths().music_dir().display())));
            assert!(config.contains("library: '/data/beets/library.db'"));
        }
    }
}
