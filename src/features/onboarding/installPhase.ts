/** The installer's current activity, from pip's last meaningful log line.
 * Not a percentage: pip's dependency tree size isn't known up front. */

export type InstallPhase =
  | { kind: "starting" }
  | { kind: "venv" }
  | { kind: "fetching"; pkg: string }
  | { kind: "installing" }
  /** pip is done; the beets config is being written. */
  | { kind: "finalizing" }
  | { kind: "done" };

const FETCHING = /^(?:Collecting|Downloading|Using cached|Processing)\s+(.+)$/;

/** `beets==2.12.0 (from …)`, a wheel file name or a path to one → `beets`. */
function packageName(rest: string): string | null {
  const token = rest.trim().split(/\s/)[0] ?? "";
  const base = token.slice(token.lastIndexOf("/") + 1);
  const wheel = /\.(?:whl|tar\.gz)$/.test(base) ? /^(.+?)-\d/.exec(base) : null;
  const name = wheel ? wheel[1] : base.split(/[=<>!~[;(]/)[0];
  return name.length > 0 ? name : null;
}

export function installPhase(logs: readonly string[]): InstallPhase {
  // Backwards: the last meaningful line wins.
  for (let index = logs.length - 1; index >= 0; index -= 1) {
    const line = logs[index].trim();

    if (line.startsWith("Environment ready")) return { kind: "done" };
    if (line.startsWith("Successfully installed")) return { kind: "finalizing" };
    if (line.startsWith("Installing collected packages")) return { kind: "installing" };

    const fetching = FETCHING.exec(line);
    if (fetching) {
      const pkg = packageName(fetching[1]);
      if (pkg) return { kind: "fetching", pkg };
    }

    if (line.startsWith("Creating virtual environment") || line.startsWith("Unpacking the bundled Python")) {
      return { kind: "venv" };
    }
  }
  return { kind: "starting" };
}

/** Distinct packages pip has named so far; `yt_dlp` and `yt-dlp` are one. */
export function namedPackageCount(logs: readonly string[]): number {
  const names = new Set<string>();
  for (const line of logs) {
    const fetching = FETCHING.exec(line.trim());
    const pkg = fetching ? packageName(fetching[1]) : null;
    if (pkg) names.add(pkg.toLowerCase().replace(/[-_.]+/g, "-"));
  }
  return names.size;
}
