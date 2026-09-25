"""Genre -> browse family, via the genre tree.

The stored genre is the most specific node; its family is the root above it.
Roots outside `_FAMILIES` resolve to None ("Other"). User placements
(`genre_overrides`) win over the base tree.
"""

import os
from functools import lru_cache

TREE_PATH = os.path.join(os.path.dirname(__file__), "genres-tree.yaml")
WHITELIST_PATH = os.path.join(os.path.dirname(__file__), "genres-whitelist.txt")

# Family root node -> display label.
_FAMILIES = {
    "metal": "Metal",
    "rock": "Rock",
    "pop": "Pop",
    "electronic": "Electronic",
    "hip hop": "Hip-Hop",
    "r&b": "R&B, Soul & Funk",
    "jazz": "Jazz",
    "blues": "Blues",
    "folk & country": "Folk & Country",
    "classical": "Classical",
    "reggae": "Reggae",
    "latin": "Latin",
    "world": "World",
}

# Pre-2026-08 family roots that may remain in a user's overrides file;
# mapped on read, never rewritten.
LEGACY_ROOTS = {
    "soul & funk": "r&b",
    "folk": "folk & country",
    "country": "folk & country",
}


def _walk(children, root: str, out: dict[str, str]) -> None:
    for node in children:
        if isinstance(node, dict):
            for name, sub in node.items():
                out.setdefault(str(name).lower(), root)
                _walk(sub or [], root, out)
        else:
            out.setdefault(str(node).lower(), root)


@lru_cache(maxsize=1)
def _genre_to_root() -> dict[str, str]:
    import yaml  # ships with beets

    with open(TREE_PATH, encoding="utf-8") as f:
        tree = yaml.safe_load(f)

    mapping: dict[str, str] = {}
    for top in tree:
        if isinstance(top, dict):
            for root, children in top.items():
                root = str(root).lower()
                mapping.setdefault(root, root)
                _walk(children or [], root, mapping)
        else:
            name = str(top).lower()
            mapping.setdefault(name, name)
    return mapping


def label_of_root(root: str) -> str | None:
    return _FAMILIES.get(root)


def root_of_label(label: str) -> str | None:
    for root, name in _FAMILIES.items():
        if name == label:
            return root
    return None


def family_labels() -> list[str]:
    return list(_FAMILIES.values())


def base_root_for(genre_lower: str) -> str | None:
    """Family root from the base tree alone, ignoring overrides."""
    root = _genre_to_root().get(genre_lower)
    return root if root in _FAMILIES else None


def invalidate_cache() -> None:
    import genre_overrides

    genre_overrides._cache = None
    genre_overrides._cache_stamp = None


def bucket_for(genre: str | None) -> str | None:
    """Browse family for a genre, or None. User placements win."""
    if not genre:
        return None
    import genre_overrides

    key = genre.strip().lower()
    root = genre_overrides.family_root_for(key) or _genre_to_root().get(key)
    return _FAMILIES.get(root) if root else None
