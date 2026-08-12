"""Genre -> browse-family resolution via the canonical genre tree.

genres-tree.yaml is the base: the stored genre is the most specific node, the
browse bucket is the family root above it. Only the 13 family roots are browse
families; genres under the other roots (avant-garde, comedy, easy listening,
kids music, soundtrack) resolve to None and the front shows them under Other.

The user's own placements (genre_overrides) sit on top and win: a genre the
user filed somewhere buckets there, whatever the base tree says. lastgenre
does not read this module — it canonicalizes against the *derived* tree files
genre_overrides regenerates, so both readings stay aligned.
"""

import os
from functools import lru_cache

TREE_PATH = os.path.join(os.path.dirname(__file__), "genres-tree.yaml")
WHITELIST_PATH = os.path.join(os.path.dirname(__file__), "genres-whitelist.txt")

# Family root node -> display label. Roots outside this map are not families.
# The set follows the 2026-08 audit (Discogs/AllMusic/RYM cross-check): R&B
# stopped hiding under Blues, Folk and Country merged, and World exists so the
# african/asian sections stop rotting in Other.
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

# Family roots that existed before the audit, still alive in a user's
# genre-overrides.json. Resolved on read, never rewritten: the file is the
# user's, and mapping beats migrating.
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
    """Family root per the base tree alone, overrides ignored — what an
    override is compared against to know whether it still says anything."""
    root = _genre_to_root().get(genre_lower)
    return root if root in _FAMILIES else None


def invalidate_cache() -> None:
    # The base tree never changes at runtime; only the overrides layer does,
    # and it keeps its own cache. Kept as one entry point so a caller after
    # an override write does not need to know which module cached what.
    import genre_overrides

    genre_overrides._cache = None
    genre_overrides._cache_stamp = None


def bucket_for(genre: str | None) -> str | None:
    """Broad browse family for a specific genre, or None if outside the families.

    The user's placement wins over the base tree."""
    if not genre:
        return None
    import genre_overrides

    key = genre.strip().lower()
    root = genre_overrides.family_root_for(key) or _genre_to_root().get(key)
    return _FAMILIES.get(root) if root else None
