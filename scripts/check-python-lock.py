"""Guards the two assumptions `sidecar/requirements.txt` rests on.

The lock is installed with `--no-deps`, and it deliberately omits `numba`,
`llvmlite` and `scipy` — beets declares them and imports none of them. Both
halves of that are silent when they break: a beets release adding a real
dependency would leave the app importing a package nobody installed, and a
beets release that starts *using* numba would fail on Intel macOS only, where
no wheel exists, on a machine no one here builds on.

So, on every push:

1. Re-resolve `requirements.in` and diff it against the lock. Anything new,
   gone, or at a different version is reported.
2. Read the installed beets and its plugins, and fail on an import of one of
   the three dropped packages.

Run after installing the lock:

    python scripts/check-python-lock.py
"""

from __future__ import annotations

import json
import pathlib
import re
import subprocess
import sys

from packaging.requirements import Requirement

# Declared by beets, imported by nothing. `llvmlite` is here as numba's own
# dependency: it is what has no Intel macOS wheel past 0.45.
EXCLUDED = {"numba", "llvmlite", "scipy"}

ROOT = pathlib.Path(__file__).resolve().parent.parent
LOCK = ROOT / "sidecar" / "requirements.txt"
DIRECT = ROOT / "sidecar" / "requirements.in"

IMPORT_RE = re.compile(
    r"^\s*(?:import|from)\s+(" + "|".join(sorted(EXCLUDED)) + r")\b",
    re.MULTILINE,
)


def normalize(name: str) -> str:
    """PEP 503 name folding, so `typing_extensions` and `Typing-Extensions`
    compare equal."""
    return re.sub(r"[-_.]+", "-", name).lower()


def read_lock(path: pathlib.Path) -> dict[str, str]:
    """The lock as {name: version}, markers evaluated for this platform — the
    colorama line is Windows-only and must not read as missing elsewhere."""
    pins: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.split("#", 1)[0].strip()
        if not line:
            continue
        req = Requirement(line)
        if req.marker and not req.marker.evaluate():
            continue
        pins[normalize(req.name)] = str(req.specifier).lstrip("=")
    return pins


def resolve(path: pathlib.Path) -> dict[str, str]:
    """What pip would install from the direct requirements, left to itself."""
    report = subprocess.run(
        [
            sys.executable,
            "-m",
            "pip",
            "install",
            "--quiet",
            "--disable-pip-version-check",
            "--dry-run",
            "--ignore-installed",
            "--report",
            "-",
            "-r",
            str(path),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True,
    )
    installs = json.loads(report.stdout)["install"]
    return {normalize(i["metadata"]["name"]): i["metadata"]["version"] for i in installs}


def compare(locked: dict[str, str], resolved: dict[str, str]) -> list[str]:
    resolved = {name: version for name, version in resolved.items() if name not in EXCLUDED}
    problems = []
    for name in sorted(resolved.keys() - locked.keys()):
        problems.append(f"missing from the lock: {name}=={resolved[name]}")
    for name in sorted(locked.keys() - resolved.keys()):
        problems.append(f"in the lock, no longer resolved: {name}=={locked[name]}")
    for name in sorted(locked.keys() & resolved.keys()):
        if locked[name] != resolved[name]:
            problems.append(f"{name}: lock has {locked[name]}, resolution wants {resolved[name]}")
    return problems


def check_imports() -> list[str]:
    """Fail if beets has started importing what we dropped."""
    import beets
    import beetsplug

    problems = []
    for package in (beets, beetsplug):
        root = pathlib.Path(package.__file__ or "").parent
        for source in sorted(root.rglob("*.py")):
            for module in set(IMPORT_RE.findall(source.read_text(encoding="utf-8", errors="replace"))):
                problems.append(f"{source.relative_to(root.parent)} imports {module}")
    return problems


def main() -> int:
    problems = compare(read_lock(LOCK), resolve(DIRECT)) + check_imports()
    if not problems:
        print("python lock: up to date, and beets still imports none of " + ", ".join(sorted(EXCLUDED)))
        return 0
    print("python lock is out of date:\n", file=sys.stderr)
    for problem in problems:
        print(f"  - {problem}", file=sys.stderr)
    print(f"\nRegenerate it — see the header of {DIRECT.relative_to(ROOT)}.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
