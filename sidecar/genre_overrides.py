"""User control over the genre tree: which family a genre files under.

The bundled genres-tree.yaml stays the canonical base — it ships with the app
and updates with it. The user's decisions live apart, as a small JSON map
(genre -> family root) in SONARCHE_GENRES_DIR, so an app update never clobbers
them and an erased library never takes them along: a placement is an opinion
about a genre name, not about any particular track.

One entry covers both gestures. Reclassing a known genre overrides the tree's
placement; adopting a genre the tree does not know gives it a family at all
(it browsed under Other before). Overrides that merely restate the base tree
are dropped on write — the base already says it, and a stored copy would go
stale the day the bundled tree moves.

The read path (bucket_for) consults the overrides directly. lastgenre cannot:
it canonicalizes against a tree *file* named in the beets config. So every
change regenerates a derived tree + whitelist here (base + overrides), the
config points at those, and the in-process plugin is told to reload — without
that, an adopted genre would be scrubbed by the next enrich.
"""

import json
import os
import tempfile

import protocol

ENV_DIR = "SONARCHE_GENRES_DIR"
OVERRIDES_NAME = "genre-overrides.json"
DERIVED_TREE_NAME = "genres-tree.yaml"
DERIVED_WHITELIST_NAME = "genres-whitelist.txt"

_cache: dict[str, str] | None = None
# (mtime_ns, size) of the file the cache reflects, None for "no file". The
# stamp — not process memory — is what expires the cache: the sidecar runs as
# TWO processes (a work channel and a read channel, see Rust `SidecarState`),
# the write lands on one and the listing is served by the other, so an
# in-memory invalidation would leave the read process bucketing against the
# old placements until the app restarts.
_cache_stamp: tuple[int, int] | None = None


def genres_dir() -> str | None:
    return os.environ.get(ENV_DIR) or None


def _overrides_path() -> str | None:
    base = genres_dir()
    return os.path.join(base, OVERRIDES_NAME) if base else None


def _stamp_of(path: str) -> tuple[int, int] | None:
    try:
        st = os.stat(path)
        return (st.st_mtime_ns, st.st_size)
    except OSError:
        return None


def load() -> dict[str, str]:
    """genre (lowercase) -> family root (lowercase). Empty when unset.

    Re-reads the file whenever its stamp moved — one `stat` per call, which the
    per-track read path can afford."""
    global _cache, _cache_stamp
    path = _overrides_path()
    if not path:
        return {}
    stamp = _stamp_of(path)
    if _cache is not None and stamp == _cache_stamp:
        return _cache
    if stamp is None:
        _cache, _cache_stamp = {}, None
        return _cache
    try:
        import genre_tree

        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        families = data.get("families") or {}
        # Legacy family roots (pre-audit placements) resolve to their heirs on
        # read; the file itself is left as the user wrote it.
        _cache = {
            str(k).lower(): genre_tree.LEGACY_ROOTS.get(str(v).lower(), str(v).lower())
            for k, v in families.items()
        }
    except (OSError, ValueError) as exc:
        # A broken file must not take the whole read path down with it; the
        # library still browses, just without the user's placements.
        protocol.log(f"genre_overrides: unreadable {path}: {exc}")
        _cache = {}
    _cache_stamp = stamp
    return _cache


def family_root_for(genre_lower: str) -> str | None:
    return load().get(genre_lower)


def _atomic_write(path: str, content: str) -> None:
    directory = os.path.dirname(path)
    os.makedirs(directory, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=directory, prefix=".tmp-")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(content)
        os.replace(tmp, path)
    except OSError:
        try:
            os.remove(tmp)
        except OSError:
            pass
        raise


def _save(overrides: dict[str, str]) -> None:
    global _cache, _cache_stamp
    path = _overrides_path()
    if not path:
        raise RuntimeError("SONARCHE_GENRES_DIR not set")
    payload = {"version": 1, "families": dict(sorted(overrides.items()))}
    _atomic_write(path, json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    _cache = dict(overrides)
    _cache_stamp = _stamp_of(path)


def set_family(genre: str, family_label: str | None) -> dict:
    """Place a genre under a family, or None to return it to the base tree.

    Returns the resolution after the change, so the caller can display where
    the genre now files without re-asking.
    """
    import genre_tree

    key = genre.strip().lower()
    if not key:
        raise RuntimeError("empty genre")
    if genre_tree.label_of_root(key):
        # Re-parenting a family under another family would fold two browse
        # shelves into one; the front never offers it, this backstops it.
        raise RuntimeError(f"{genre!r} is a family, not a genre")

    overrides = dict(load())
    if family_label is None:
        overrides.pop(key, None)
    else:
        root = genre_tree.root_of_label(family_label)
        if root is None:
            raise RuntimeError(f"unknown family: {family_label}")
        if genre_tree.base_root_for(key) == root:
            # Moving a genre back where the base tree already puts it: no
            # override to keep, just drop any previous one.
            overrides.pop(key, None)
        else:
            overrides[key] = root

    _save(overrides)
    regenerate()
    genre_tree.invalidate_cache()
    _refresh_lastgenre()
    return {
        "genre": genre.strip(),
        "family": genre_tree.bucket_for(key),
        "overridden": key in overrides,
    }


def list_overrides() -> list[dict]:
    import genre_tree

    return [
        {"genre": genre, "family": genre_tree.label_of_root(root)}
        for genre, root in sorted(load().items())
    ]


def _strip_node(children: list, name: str) -> list | None:
    """Remove the node called `name` anywhere under `children`; return its own
    children (possibly empty) when found, None when absent."""
    for i, node in enumerate(children):
        if isinstance(node, dict):
            for node_name, sub in node.items():
                if str(node_name).lower() == name:
                    del children[i]
                    return sub or []
                found = _strip_node(sub or [], name)
                if found is not None:
                    return found
        elif str(node).lower() == name:
            del children[i]
            return []
    return None


def _derived_tree(base_tree: list, overrides: dict[str, str]) -> list:
    tree = json.loads(json.dumps(base_tree))  # deep copy, plain types only
    for genre, root in overrides.items():
        # The base tree holds duplicates (e.g. "funk metal" twice under
        # heavy metal); strip them all or the leftover copy would keep
        # canonicalizing against the old placement.
        subtree: list | None = None
        while (found := _strip_node(tree, genre)) is not None:
            if found:
                subtree = found
        node = genre if not subtree else {genre: subtree}
        for top in tree:
            if isinstance(top, dict) and str(next(iter(top))).lower() == root:
                key = next(iter(top))
                if top[key] is None:
                    top[key] = []
                top[key].append(node)
                break
        else:
            protocol.log(f"genre_overrides: family root {root!r} not in tree, {genre!r} skipped")
    return tree


def _dump_yaml_tree(tree: list) -> str:
    """Plain block-YAML, matching the bundled file's shape (safe_load reads it
    back identically; no yaml.dump to keep node order and avoid quoting noise)."""
    lines: list[str] = []

    def needs_quotes(name: str) -> bool:
        return name != name.strip() or any(c in name for c in ":#{}[]&*!|>'\"%@`")

    def emit(node, indent: int) -> None:
        pad = "  " * indent
        if isinstance(node, dict):
            for name, sub in node.items():
                label = f'"{name}"' if needs_quotes(str(name)) else str(name)
                if sub:
                    lines.append(f"{pad}- {label}:")
                    for child in sub:
                        emit(child, indent + 1)
                else:
                    lines.append(f"{pad}- {label}")
        else:
            label = f'"{node}"' if needs_quotes(str(node)) else str(node)
            lines.append(f"{pad}- {label}")

    for top in tree:
        emit(top, 0)
    return "\n".join(lines) + "\n"


def regenerate() -> None:
    """Write the derived tree + whitelist (base + overrides) into the genres
    dir — the files the beets config's lastgenre section points at."""
    import yaml  # ships with beets

    import genre_tree

    base = genres_dir()
    if not base:
        return
    overrides = load()

    with open(genre_tree.TREE_PATH, encoding="utf-8") as f:
        base_tree = yaml.safe_load(f)
    tree = _derived_tree(base_tree, overrides)
    header = (
        "# Derived by Sonarche from the bundled genres-tree.yaml plus the\n"
        f"# user's placements ({OVERRIDES_NAME}). Regenerated on every change\n"
        "# and at sidecar startup — do not edit.\n"
    )
    _atomic_write(os.path.join(base, DERIVED_TREE_NAME), header + _dump_yaml_tree(tree))

    with open(genre_tree.WHITELIST_PATH, encoding="utf-8") as f:
        base_whitelist = f.read()
    known = {
        line.strip().lower()
        for line in base_whitelist.splitlines()
        if line.strip() and not line.startswith("#")
    }
    adopted = sorted(g for g in overrides if g not in known)
    extra = "".join(f"{g}\n" for g in adopted)
    if extra:
        extra = "# Adopted by the user (genre-overrides.json):\n" + extra
    _atomic_write(os.path.join(base, DERIVED_WHITELIST_NAME), base_whitelist + extra)


def ensure_derived() -> None:
    """Startup guarantee: the files the beets config names exist and reflect
    the current overrides (the app may have been updated since they were last
    written, with a newer bundled tree underneath)."""
    if not genres_dir():
        return
    try:
        regenerate()
    except Exception as exc:  # noqa: BLE001 — startup must survive a bad file
        protocol.log(f"genre_overrides: derived files not regenerated: {exc}")


def _refresh_lastgenre() -> None:
    """Reload the in-process plugin's tree + whitelist if it is already up;
    a plugin loaded later reads the fresh files on its own."""
    try:
        from beets import plugins as beets_plugins

        for plugin in beets_plugins.find_plugins():
            if plugin.name == "lastgenre":
                plugin.whitelist = plugin._load_whitelist()
                plugin.c14n_branches, plugin.canonicalize = plugin._load_c14n_tree()
                protocol.log("genre_overrides: lastgenre reloaded")
    except Exception as exc:  # noqa: BLE001 — a stale plugin beats a dead op
        protocol.log(f"genre_overrides: lastgenre not reloaded: {exc}")


def handle_set(_request_id: str, params: dict) -> dict:
    genre = params.get("genre") or ""
    family = params.get("family")
    if family is not None and not isinstance(family, str):
        raise RuntimeError("family must be a string or null")
    return set_family(str(genre), family)


def handle_list(_request_id: str, _params: dict) -> dict:
    return {"overrides": list_overrides()}
