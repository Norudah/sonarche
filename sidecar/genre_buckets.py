"""Curated genre -> browse-bucket map.

The stored `genre` is the specific, canonical value (e.g. "Thrash Metal"); the
bucket is the broad family a user browses by (e.g. "Metal"). beets' lastgenre
tree ranks "metal" under "rock", which is too coarse to browse by, so the buckets
below are ours: seeded once from the lastgenre tree with hand-picked family
boundaries, then owned and edited here. Genres with no bucket resolve to None —
add them to the relevant tuple as the library grows.
"""

_BUCKETS: dict[str, tuple[str, ...]] = {
    "Metal": (
        "alternative metal", "black metal", "celtic metal", "christian metal",
        "crossover thrash", "death metal", "death/doom", "deathcore", "djent", "doom metal",
        "drone metal", "epic doom metal", "epic metal", "folk metal", "funeral doom",
        "funk metal", "glam metal", "goregrind", "gothic metal", "groove metal", "heavy metal",
        "industrial death metal", "industrial metal", "mathcore", "medieval metal",
        "melodic death metal", "metalcore", "neoclassical metal", "neue deutsche härte",
        "pagan metal", "power metal", "progressive metal",
        "progressive power metal", "progressive thrash metal", "sludge metal", "speed metal",
        "stoner metal", "stoner rock", "symphonic metal", "technical death metal",
        "teutonic thrash metal", "thrash metal", "traditional heavy metal", "viking metal",
    ),
    "Rock": (
        "acid rock", "alternative rock", "anarcho punk", "art punk", "art rock", "britpop",
        "canterbury scene", "celtic punk", "chinese rock", "christian punk", "christian rock",
        "classic rock", "crust punk", "dark cabaret", "deathrock", "desert rock", "dream pop",
        "dunedin sound", "emo", "experimental rock", "folk punk", "folk rock", "freakbeat",
        "garage rock", "glam rock", "gothic rock", "grindcore", "grunge", "gypsy punk",
        "hard rock", "hardcore punk", "horror punk", "indie pop", "indie rock",
        "industrial rock", "krautrock", "math rock", "neo-psychedelia", "new prog",
        "new wave", "no wave", "noise pop", "noise rock", "nu metal", "oi!",
        "paisley underground", "pop punk", "pop rock", "post-britpop", "post-grunge",
        "post-hardcore", "post-metal", "post-punk", "post-rock", "power pop", "powerviolence",
        "progressive rock", "psychedelic rock", "psychobilly", "punk rock", "raga rock",
        "riot grrrl", "rock", "rock and roll", "sadcore", "screamo", "shoegaze", "ska punk",
        "skate punk", "slowcore", "southern rock", "space rock", "surf rock",
        "thrashcore", "twee pop", "visual kei", "world fusion",
    ),
    "Pop": (
        "arab pop", "austropop", "balkan pop", "baroque pop", "bubblegum pop", "europop",
        "french pop", "iranian pop", "jangle pop", "latin pop", "laïkó", "levenslied",
        "louisiana swamp pop", "mexican pop", "motorpop", "nederpop", "pop", "pop rap",
        "psychedelic pop", "russian pop", "schlager", "soft rock", "sophisti-pop",
        "space age pop", "sunshine pop", "surf pop", "teen pop", "traditional pop music",
        "turkish pop", "vispop", "wonky pop",
    ),
    "Electronic": (
        "4-beat", "acid breaks", "acid house", "acid jazz", "alternative dance", "ambient",
        "ambient house", "baggy", "big beat", "bitpop", "boogie", "breakbeat",
        "breakbeat hardcore", "breakcore", "broken beat", "bubblegum dance", "chicago house",
        "chillwave", "crunk", "cybergrind", "dance-pop", "dance-punk", "dance-rock",
        "dark ambient", "darkcore", "darkstep", "death industrial", "deep house",
        "detroit techno", "digital hardcore", "disco", "disco house", "diva house", "doomcore",
        "downtempo", "drone music", "drum and bass", "dub techno", "dubstep", "dubtronica",
        "electro", "electro backbeat", "electro house", "electro-industrial", "electroclash",
        "electronic", "electronic art music", "electronic body music", "electronic rock",
        "electronica", "electropop", "ethereal wave", "eurobeat", "eurodance", "folktronica",
        "freestyle house", "full on", "funky house", "gabber", "ghetto house", "ghettotech",
        "glitch", "goa trance", "grime", "happy hardcore", "hard trance", "hardstyle",
        "hi-nrg", "hip house", "house", "idm", "illbient", "indietronica",
        "italo dance", "italo disco", "italo house", "jumpstyle", "jungle",
        "liquid funk", "lowercase", "madchester", "new beat",
        "new rave", "nintendocore", "nortec", "nu jazz", "nu skool breaks", "post-disco",
        "power electronics", "power noise", "progressive house", "ragga jungle", "schranz",
        "speed garage", "speedcore", "synthcore", "synthpop", "synthpunk",
        "tech house", "tech trance", "techno", "technopop", "techstep", "trance",
        "tribal house", "trip hop", "uk garage", "uplifting trance", "vocal house",
        "witch house",
    ),
    "Hip-Hop": (
        "alternative hip hop", "chicano rap", "christian hip hop", "crunkcore",
        "east coast hip hop", "g-funk", "gangsta rap", "hardcore hip hop", "hip hop",
        "hip hop soul", "horrorcore", "hyphy", "industrial hip hop", "jazz rap", "mafioso rap",
        "miami bass", "midwest hip hop", "nerdcore", "new jack swing", "new school hip hop",
        "old school hip hop", "political hip hop", "rap metal", "rap rock", "rapcore",
        "songo-salsa", "southern hip hop", "turntablism", "west coast hip hop",
    ),
    "Jazz": (
        "asian american jazz", "avant-garde jazz", "bebop", "boogie-woogie", "brass band",
        "chamber jazz", "cool jazz", "crossover jazz", "dixieland", "free improvisation",
        "free jazz", "gypsy jazz", "hard bop", "jazz", "jazz fusion", "jazz-funk",
        "latin jazz", "m-base", "mainstream jazz", "modal jazz", "punk jazz", "ragtime",
        "shibuya-kei", "smooth jazz", "soul jazz", "swing", "trad jazz", "vocal jazz",
        "west coast jazz",
    ),
    "Blues": (
        "blues", "british blues", "chicago blues", "classic female blues", "contemporary r&b",
        "country blues", "delta blues", "detroit blues", "electric blues", "jazz blues",
        "jump blues", "kansas city blues", "louisiana blues", "memphis blues", "piano blues",
        "piedmont blues", "punk blues", "soul blues", "st. louis blues", "swamp blues",
        "texas blues",
    ),
    "Soul & Funk": (
        "blue-eyed soul", "deep funk", "funk", "go-go", "neo soul", "northern soul", "p-funk",
        "soul",
    ),
    "Folk": (
        "anti-folk", "indie folk", "neofolk", "progressive folk",
    ),
    "Country": (
        "alternative country", "americana", "australian country music", "bakersfield sound",
        "bluegrass", "classic country", "close harmony", "country", "country pop",
        "country rock", "cowpunk", "franco-country", "honky tonk", "lubbock sound",
        "nashville sound", "neotraditional country", "outlaw country", "progressive bluegrass",
        "progressive country", "red dirt", "rockabilly", "truck-driving country",
        "western swing", "zydeco",
    ),
    "Reggae": (
        "2 tone", "dancehall", "dub", "lovers rock", "ragga", "raggamuffin", "reggae",
        "reggae 110", "reggae bultrón", "reggae en español", "reggae fusion", "rocksteady",
        "romantic flow", "roots reggae", "ska",
    ),
    "Latin": (
        "axé", "bachata", "baithak gana", "bossa nova", "calypso", "chicha", "choro",
        "chutney", "chutney soca", "cumbia", "forró", "frevo", "huayno", "mambo", "maracatu",
        "mariachi", "merengue", "méringue", "música popular brasileira", "pagode", "punta",
        "punta rock", "ranchera", "reggaeton", "salsa", "samba", "soca", "son", "tejano",
        "tropicalia", "zouk",
    ),
    "Classical": (
        "ballet", "baroque", "baroque music", "cantata", "cantique", "chamber music",
        "classical", "classical music", "concerto", "concerto grosso",
        "contemporary classical", "gregorian chant", "mass", "modern classical", "opera",
        "oratorio", "orchestra", "orchestral", "organum", "requiem", "sacred music", "sonata",
        "string quartet", "symphonic", "symphony",
    ),
}

# Reverse index built once: specific genre (lowercase) -> bucket.
_GENRE_TO_BUCKET: dict[str, str] = {
    genre: bucket for bucket, genres in _BUCKETS.items() for genre in genres
}


def bucket_for(genre: str | None) -> str | None:
    """Broad browse family for a specific genre, or None if unmapped."""
    if not genre:
        return None
    return _GENRE_TO_BUCKET.get(genre.strip().lower())
