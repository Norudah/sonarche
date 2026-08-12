"""Flag matches that contradict the download's own title.

Chromaprint fingerprints the music, not the voice: two language versions of
one song (same backing track, re-recorded vocals) produce near-identical
fingerprints, and AcoustID's crowd data links them to each other's recordings.
Ranking candidates by popularity then lands the French "Sonne le clairon" on
the English "Sound the Bugle". The one signal that survives is the video's own
title: a correct match nearly always shares a word with it. Zero overlap does
not prove the match wrong — YouTube titles are junk — so this only *marks* the
item for human review; the triage page surfaces the flag.
"""

import re
import unicodedata

# Flexible attribute carrying the review flag; value names the reason.
SUSPECT_MATCH = "sonarche_suspect_match"
TITLE_MISMATCH = "title-mismatch"

# Qualifiers and platform junk that appear on both sides of a wrong pair
# ("Me voilà (End Title)" vs "Here I Am (End Title)") — shared ones must not
# count as agreement between the video title and the matched title.
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
    # Diacritics folded so "voilà" agrees with a flat "voila" re-typing.
    flat = unicodedata.normalize("NFKD", text)
    flat = "".join(ch for ch in flat if not unicodedata.combining(ch))
    words = re.split(r"[^a-z0-9]+", flat.casefold())
    return {w for w in words if w and not w.isdigit() and w not in _NOISE_TOKENS}


def is_title_mismatch(hint_title: str | None, matched_title: str | None) -> bool:
    """True when the video title and the matched title share no word at all.
    Either side empty (or reduced to noise) is no evidence — not a mismatch."""
    hint, matched = _tokens(hint_title), _tokens(matched_title)
    if not hint or not matched:
        return False
    return not (hint & matched)


def titles_agree(hint_title: str | None, other_title: str | None) -> bool:
    """True when both titles carry real words and share at least one — the
    positive counterpart of `is_title_mismatch`. A side reduced to noise is no
    evidence either way, so it never agrees."""
    hint, other = _tokens(hint_title), _tokens(other_title)
    return bool(hint and other and hint & other)


def has_words(text: str | None) -> bool:
    """Whether the text carries any real word once noise and digits are folded
    out — i.e. whether it can serve as evidence at all."""
    return bool(_tokens(text))


def mark(item, hint_title: str | None) -> bool:
    """Set or clear the review flag on a freshly *matched* item, comparing the
    download's title hint against the title the match applied. Mutates the
    in-memory item only — the caller owns the store. Returns whether the item
    is now flagged.

    Clearing is deliberate: a later, healthier match (re-enrich, album batch
    re-run) must lift a stale flag, and a hint-less run means the old verdict
    can no longer be defended."""
    if is_title_mismatch(hint_title, item.title):
        item[SUSPECT_MATCH] = TITLE_MISMATCH
        return True
    if item.get(SUSPECT_MATCH):
        del item[SUSPECT_MATCH]
    return False
