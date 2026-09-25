"""Guards the assumptions `sidecar/requirements.txt` rests on.

The lock is installed with `--no-deps` and omits `numba`, `llvmlite` and
`scipy` (declared by beets, never imported). This script:

1. Re-resolves `requirements.in` and reports any drift from the lock.
2. Fails if beets or its plugins import one of the dropped packages.

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

# `llvmlite` (numba's dependency) has no Intel macOS wheel past 0.45.
EXCLUDED = {"numba", "llvmlite", "scipy"}

ROOT = pathlib.Path(__file__).resolve().parent.parent
LOCK = ROOT / "sidecar" / "requirements.txt"
DIRECT = ROOT / "sidecar" / "requirements.in"

IMPORT_RE = re.compile(
    r"^\s*(?:import|from)\s+(" + "|".join(sorted(EXCLUDED)) + r")\b",
    re.MULTILINE,
)


def normalize(name: str) -> str:
    """PEP 503 name normalization."""
    return re.sub(r"[-_.]+", "-", name).lower()


def read_lock(path: pathlib.Path) -> dict[str, str]:
    """The lock as {name: version}, with markers evaluated for this platform."""
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
