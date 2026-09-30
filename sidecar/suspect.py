"""Flag matches that contradict the download's own title.

Language versions of a song share near-identical fingerprints, so AcoustID
can land on the wrong one. A correct match nearly always shares a word with
the video title; no overlap only flags the item for review.
"""

import re
import unicodedata

# Value names the reason.
SUSPECT_MATCH = "sonarche_suspect_match"
TITLE_MISMATCH = "title-mismatch"

# Qualifiers common to both sides of a wrong pair ("(End Title)"); they don't
# count as agreement.
_NOISE_TOKENS = frozenset(
    """
    official video audio lyric lyrics visualizer clip hd hq 4k full
    version single main end title theme finale reprise remix edit mix
    live remaster remastered ost soundtrack feat ft
    """.split()
)


def _tokens(text: str | None) -> set[str]:
    if not text:
        return set()
    flat = unicodedata.normalize("NFKD", text)
    flat = "".join(ch for ch in flat if not unicodedata.combining(ch))
    words = re.split(r"[^a-z0-9]+", flat.casefold())
    return {w for w in words if w and not w.isdigit() and w not in _NOISE_TOKENS}


def is_title_mismatch(hint_title: str | None, matched_title: str | None) -> bool:
    """True when the titles share no word. An empty side is no evidence."""
    hint, matched = _tokens(hint_title), _tokens(matched_title)
    if not hint or not matched:
        return False
    return not (hint & matched)


def titles_agree(hint_title: str | None, other_title: str | None) -> bool:
    """True when both titles have real words and share at least one."""
    hint, other = _tokens(hint_title), _tokens(other_title)
    return bool(hint and other and hint & other)


def has_words(text: str | None) -> bool:
    """Whether the text has any real word once noise and digits are removed."""
    return bool(_tokens(text))


def mark(item, hint_title: str | None) -> bool:
    """Set or clear the review flag on a freshly matched item. Returns whether
    it is flagged. In-memory only; the caller stores.

    A later healthier match, or a run without a hint, clears a stale flag."""
    if is_title_mismatch(hint_title, item.title):
        item[SUSPECT_MATCH] = TITLE_MISMATCH
        return True
    if item.get(SUSPECT_MATCH):
        del item[SUSPECT_MATCH]
    return False
