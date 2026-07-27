/**
 * What the installer is doing right now, read off pip's own output.
 *
 * The setup used to show its raw log in a `<pre>`, which is honest and
 * unreadable: a wall of "Collecting" lines is a developer's artefact, not an
 * answer to "how long is this going to take". The log is still there behind a
 * disclosure — this turns its last meaningful line into one sentence.
 *
 * Deliberately not a percentage. pip resolves a dependency tree whose size is
 * not known up front, so any number would be invented; naming the package it is
 * fetching says as much and is true.
 */

export type InstallPhase =
  | { kind: "starting" }
  | { kind: "venv" }
  | { kind: "fetching"; pkg: string }
  | { kind: "installing" }
  | { kind: "done" };

/** `beets==2.12.0 (from -r requirements.txt (line 1))` → `beets`. */
function packageName(rest: string): string | null {
  const name = rest.trim().split(/[\s=<>!~[;(]/)[0];
  return name.length > 0 ? name : null;
}

export function installPhase(logs: readonly string[]): InstallPhase {
  // Backwards: the last line that says something wins, and most lines say
  // nothing (blank lines, progress bars, warnings).
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
