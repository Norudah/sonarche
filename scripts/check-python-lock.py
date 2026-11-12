"""Guards the assumptions `sidecar/requirements.txt` rests on.

Deterministic on purpose: nothing here compares against what PyPI offers
today, so the same commit gives the same verdict next month.

1. The lock matches `requirements.in`. Regenerating it with the lock itself
   as the starting point must reproduce the same pins; only an edited `.in`
   (or a hand-edited lock) changes them.
2. beets and its plugins import none of the packages left out of the lock
   (they are installed `--no-deps`, so an import would break at runtime).
3. `yt-dlp-ejs` is the solver version the pinned yt-dlp expects.

Run with the sidecar's dev venv, after `uv pip sync`:

    .venv/bin/python scripts/check-python-lock.py
"""

from __future__ import annotations

import importlib.metadata
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
SIDECAR = ROOT / "sidecar"
LOCK = SIDECAR / "requirements.txt"
DIRECT = SIDECAR / "requirements.in"
CONFIG = SIDECAR / "uv.toml"

# Declared by beets, never imported; kept in step with `no-emit-package`.
EXCLUDED = ("numba", "llvmlite", "scipy")

IMPORT_RE = re.compile(r"^\s*(?:import|from)\s+(" + "|".join(EXCLUDED) + r")\b", re.MULTILINE)


def pins(text: str) -> set[str]:
    """`name==version ; marker` per requirement, hashes and comments dropped."""
    joined = re.sub(r"\\\n", " ", text)
    found = set()
    for line in joined.splitlines():
        line = line.split("#", 1)[0]
        line = re.sub(r"--hash=\S+", "", line).strip()
        if line:
            found.add(re.sub(r"\s+", " ", line))
    return found


def check_lock() -> list[str]:
    uv = shutil.which("uv")
    if uv is None:
        return ["uv not found on PATH (https://docs.astral.sh/uv/)"]
    with tempfile.TemporaryDirectory() as scratch:
        regenerated = pathlib.Path(scratch) / "requirements.txt"
        # Seeded with the lock so uv keeps its versions: only a changed `.in` moves them.
        shutil.copyfile(LOCK, regenerated)
        result = subprocess.run(
            [uv, "pip", "compile", "--quiet", "--config-file", str(CONFIG), str(DIRECT), "-o", str(regenerated)],
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        if result.returncode != 0:
            return [f"uv pip compile failed:\n{result.stderr.strip()}"]
        expected = pins(regenerated.read_text(encoding="utf-8"))
    actual = pins(LOCK.read_text(encoding="utf-8"))
    problems = [f"missing from the lock: {pin}" for pin in sorted(expected - actual)]
    problems += [f"in the lock, not in requirements.in: {pin}" for pin in sorted(actual - expected)]
    return problems


def check_imports() -> list[str]:
    import beets
    import beetsplug

    problems = []
    # `__path__`, not `__file__`: beetsplug is a namespace package, without one.
    roots = [pathlib.Path(entry) for package in (beets, beetsplug) for entry in package.__path__]
    for root in roots:
        for source in sorted(root.rglob("*.py")):
            for module in set(IMPORT_RE.findall(source.read_text(encoding="utf-8", errors="replace"))):
                problems.append(f"{source.relative_to(root.parent)} imports {module}, which the lock leaves out")
    return problems


def check_ejs() -> list[str]:
    from yt_dlp.extractor.youtube.jsc._builtin.vendor import _info

    expected = _info.VERSION
    installed = importlib.metadata.version("yt-dlp-ejs")
    if installed.split(".")[:2] != expected.split(".")[:2]:
        return [f"yt-dlp expects yt-dlp-ejs {expected}, the lock has {installed}"]
    return []


def main() -> int:
    problems = check_lock() + check_imports() + check_ejs()
    if not problems:
        print("python lock: matches requirements.in, beets imports nothing it leaves out, ejs in step")
        return 0
    print("python lock is broken:\n", file=sys.stderr)
    for problem in problems:
        print(f"  - {problem}", file=sys.stderr)
    print("\nRegenerate it with `npm run deps:python` (see sidecar/requirements.in).", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
