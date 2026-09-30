/** Environment setup, onboarding, API keys, preferences and updates. */

import type { Handler } from "./types";
import { emitMockEvent } from "./events";

const apiKeys = [{ name: "acoustid", configured: false }];

/** Keys saved this session, so `reveal_api_key` has something to return. */
const storedKeys = new Map<string, string>();

// API delays match the backend's fixed defaults.
const preferences = {
  lastfmFetchDelaySeconds: 1,
  acoustidLookupDelaySeconds: 1,
  downloadDelaySeconds: 3,
  audioFormat: "m4a",
};

const preferenceFields: Record<
  string,
  "lastfmFetchDelaySeconds" | "acoustidLookupDelaySeconds" | "downloadDelaySeconds"
> = {
  lastfm: "lastfmFetchDelaySeconds",
  acoustid: "acoustidLookupDelaySeconds",
  download: "downloadDelaySeconds",
};

const MOCK_RELEASE_BODY = `## [0.9.0](https://github.com/Norudah/sonarche/compare/sonarche-v0.8.0...sonarche-v0.9.0) (2026-08-12)

### Features

* **library:** let a cover be recropped in place ([1a2b3c4](https://github.com/Norudah/sonarche/commit/1a2b3c4d))
* **onboarding:** pick the language during setup ([5e6f7a8](https://github.com/Norudah/sonarche/commit/5e6f7a8b))
* **shell:** name the two modes on the lens toggle ([8607459](https://github.com/Norudah/sonarche/commit/86074590))

### Bug Fixes

* **ui:** mark every delete as destructive ([9b8c7d6](https://github.com/Norudah/sonarche/commit/9b8c7d6e))
* **shell:** keep the app's name on the Windows window ([f9d5943](https://github.com/Norudah/sonarche/commit/f9d59430))
`;

/** `?setup=python` (no interpreter) or `?setup=engine` (no venv); pair with
 * `?onboarding=1` to bypass the completion flag. */
const requestedSetup = new URLSearchParams(window.location.search).get("setup");

const env = {
  python: requestedSetup === "python" ? null : { path: "/opt/homebrew/bin/python3", version: "3.13.1" },
  venvOk: requestedSetup !== "python" && requestedSetup !== "engine",
  depsOk: requestedSetup !== "python" && requestedSetup !== "engine",
  // `?bundled`: the app ships its own interpreter, so the Python step is hidden.
  pythonBundled: new URLSearchParams(window.location.search).has("bundled"),
  libraryDir: "/Users/dev/Music/Sonarche",
};

/** `?returning`: the broken environment of an already-onboarded install. */
const isReturning = new URLSearchParams(window.location.search).has("returning");

const onboarding = { completed: requestedSetup == null || isReturning, acoustidConfigured: isReturning };

/** The lines `python_env.rs` and pip emit, at a watchable pace. */
const SETUP_SCRIPT = [
  "Python: /opt/homebrew/bin/python3 (3.13.1)",
  "Creating virtual environment...",
  "Installing dependencies (this can take a few minutes)...",
  "Collecting beets==2.12.0 (from -r requirements.txt (line 1))",
  "Downloading beets-2.12.0-py3-none-any.whl (1.9 MB)",
  "Collecting yt-dlp==2026.7.4 (from -r requirements.txt (line 2))",
  "Collecting mutagen==1.47.0 (from -r requirements.txt (line 3))",
  "Installing collected packages: mutagen, yt-dlp, beets",
  "Environment ready.",
];

function runMockSetup(): Promise<unknown> {
  return new Promise((resolve) => {
    let index = 0;
    const timer = window.setInterval(() => {
      emitMockEvent("setup:log", SETUP_SCRIPT[index]);
      index += 1;
      if (index >= SETUP_SCRIPT.length) {
        window.clearInterval(timer);
        env.venvOk = true;
        env.depsOk = true;
        resolve(env);
      }
    }, 900);
  });
}

export const handlers: Record<string, Handler> = {
  set_api_key: (payload) => {
    const key = apiKeys.find((k) => k.name === payload?.name);
    const value = String(payload?.value ?? "").trim();
    if (key) key.configured = value !== "";
    if (key?.name === "acoustid") onboarding.acoustidConfigured = key.configured;
    storedKeys.set(String(payload?.name), value);
    return key;
  },
  // A plausible AcoustID-shaped key when none was saved.
  reveal_api_key: (payload) => {
    const name = String(payload?.name);
    const key = apiKeys.find((k) => k.name === name);
    if (!key?.configured) return null;
    return storedKeys.get(name) ?? "mock8AcoUsTid";
  },
  get_env_status: async () => {
    // `?splash[=ms]` delays the answer so the splash can be seen.
    const held = new URLSearchParams(window.location.search).get("splash");
    if (held !== null) await new Promise((resolve) => window.setTimeout(resolve, Number(held) || 2000));
    return { ...env };
  },
  setup_env: () => runMockSetup(),
  reveal_log_file: () => null,
  get_onboarding_state: () => ({ ...onboarding }),
  set_onboarding_completed: (payload) => {
    onboarding.completed = Boolean(payload?.completed);
    return { ...onboarding };
  },
  // Only `bad` fails.
  check_acoustid_key: (payload) => {
    const valid = String(payload?.key ?? "").trim() !== "bad";
    return { valid, reason: valid ? null : "invalidKey" };
  },
  // One of each verdict.
  check_services: () => {
    return {
      services: [
        { name: "musicbrainz", state: "up", detail: "200" },
        { name: "acoustid", state: "up", detail: "400" },
        { name: "coverart", state: "up", detail: "200" },
        { name: "lastfm", state: "down", detail: "503" },
        { name: "lrclib", state: "unreachable", detail: "ReadTimeout" },
        { name: "lyricsovh", state: "up", detail: "200" },
      ],
    };
  },
  get_library_location: () => {
    return {
      path: "/Users/preview/Music/Sonarche",
      defaultPath: "/Users/preview/Music/Sonarche",
      isDefault: true,
    };
  },
  // Cross-volume; a folder under /Users/preview is refused.
  check_library_move: (payload) => {
    const parent = String(payload?.parent ?? "");
    return {
      target: `${parent}/Sonarche`,
      refusal: parent.startsWith("/Users/preview/Music/Sonarche") ? "intoItself" : null,
      fileCount: 12_412,
      sizeBytes: 68_400_000_000,
      sameVolume: false,
    };
  },
  set_audio_format: (payload) => {
    preferences.audioFormat = String(payload?.format ?? preferences.audioFormat);
    return preferences;
  },
  // Paced so the three phases can be watched.
  convert_library: async () => {
    const total = 12;
    for (let done = 0; done <= total; done++) {
      window.setTimeout(() => {
        emitMockEvent("sidecar:event", {
          event: "convert_progress",
          data: {
            done,
            total,
            format: preferences.audioFormat,
            title: `Track ${done}`,
            artist: "Mock",
            failed: 0,
          },
        });
      }, done * 250);
    }
    await new Promise((resolve) => window.setTimeout(resolve, (total + 1) * 250));
    return { format: preferences.audioFormat, total, converted: total, failed: 0, skipped: 3 };
  },
  set_rate_limit_delay: (payload) => {
    const field = preferenceFields[String(payload?.key)];
    if (field) preferences[field] = Number(payload?.seconds ?? preferences[field]);
    return preferences;
  },
  // Matches `currentVersion` below, so `?update` shows 0.8.0 → 0.9.0.
  "plugin:app|version": () => "0.8.0",
  // Opt-in with `?update`; the body is a real release-please changelog.
  "plugin:updater|check": () => {
    return new URLSearchParams(window.location.search).has("update")
      ? { rid: 1, currentVersion: "0.8.0", version: "0.9.0", date: null, body: MOCK_RELEASE_BODY, rawJson: {} }
      : null;
  },
  "plugin:updater|download_and_install": () => null,
  list_api_keys: () => apiKeys,
  get_preferences: () => preferences,
};
