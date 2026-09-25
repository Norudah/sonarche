/** The installer's current activity, from pip's last meaningful log line.
 * Not a percentage: pip's dependency tree size isn't known up front. */

export type InstallPhase =
  | { kind: "starting" }
  | { kind: "venv" }
  | { kind: "fetching"; pkg: string }
  | { kind: "installing" }
  | { kind: "done" };

function packageName(rest: string): string | null {
  const name = rest.trim().split(/[\s=<>!~[;(]/)[0];
  return name.length > 0 ? name : null;
}

export function installPhase(logs: readonly string[]): InstallPhase {
  // Backwards: the last meaningful line wins.
  for (let index = logs.length - 1; index >= 0; index -= 1) {
    const line = logs[index].trim();

    if (line.startsWith("Environment ready")) return { kind: "done" };
    if (line.startsWith("Successfully installed") || line.startsWith("Installing collected packages")) {
      return { kind: "installing" };
    }

    const collecting = /^(?:Collecting|Downloading|Using cached)\s+(.+)$/.exec(line);
    if (collecting) {
      const pkg = packageName(collecting[1]);
      if (pkg) return { kind: "fetching", pkg };
    }

    if (line.startsWith("Creating virtual environment")) return { kind: "venv" };
  }
  return { kind: "starting" };
}
