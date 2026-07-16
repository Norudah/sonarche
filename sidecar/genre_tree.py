"""Genre -> browse-family resolution via the canonical genre tree.

genres-tree.yaml — the same file lastgenre canonicalizes against — is the
single source of truth: the stored genre is the most specific node, the browse
bucket is the family root above it. Only the 13 family roots are browse
families; genres under the other roots (african, asian, world, ...) resolve to
None and the front shows them under Other.
"""

import os
from functools import lru_cache

TREE_PATH = os.path.join(os.path.dirname(__file__), "genres-tree.yaml")
WHITELIST_PATH = os.path.join(os.path.dirname(__file__), "genres-whitelist.txt")

# Family root node -> display label. Roots outside this map are not families.
_FAMILIES = {
    "metal": "Metal",
    "rock": "Rock",
    "pop": "Pop",
    "electronic": "Electronic",
    "hip hop": "Hip-Hop",
    "jazz": "Jazz",
    "blues": "Blues",
    "soul & funk": "Soul & Funk",
    "folk": "Folk",
    "country": "Country",
    "reggae": "Reggae",
    "latin": "Latin",
    "classical": "Classical",
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


def bucket_for(genre: str | None) -> str | None:
    """Broad browse family for a specific genre, or None if outside the families."""
    if not genre:
        return None
    root = _genre_to_root().get(genre.strip().lower())
    return _FAMILIES.get(root) if root else None
