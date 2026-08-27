"""What the audio files are made of — the one setting that rewrites bytes.

Everything else the app decides about a track is a tag or a path. This is the
container and the codec, and it is the only preference that can make the file
itself unreadable somewhere. Hence the shape of the list below: three answers,
each one a real reason someone would pick it, and nothing that exists only to
lengthen a dropdown.

- `m4a` — the stream the download already receives. Kept as-is, no re-encode,
  and therefore the default: the app's own rule is that a lossy file is never
  decoded and re-compressed behind the user's back.
- `mp3` — the format that plays *everywhere*. A car stereo from 2009, a cheap
  DAP, a bootloader-locked head unit. Worse per byte than AAC and the app says
  so, but "worse" is not the axis when the alternative is silence.
- `flac` — asked for by devices and players that want lossless input. From a
  lossy source it is lossless *of an original that already lost something*:
  bigger files, not better sound, and the interface has to say that out loud
  rather than let the word "lossless" do the lying.

Everything here is pure and unit-tested: the encoder arguments are the part
that is expensive to get wrong and free to check.
"""

# Extension = wire value = what the setting stores. One string, so nothing has
# to map between "the format", "the container" and "the file suffix".
FORMATS = ("m4a", "mp3", "flac")

DEFAULT = "m4a"

# Below the source's own bitrate there is nothing left to keep; above it there
# is nothing left to gain. LAME's V0 (~245 kbps VBR) sits above every stream a
# download receives, which is the point: the transcode's loss should come from
# the format change alone, not from a ceiling we chose.
_MP3_QUALITY = "0"

# ffmpeg's default (5) is the knee of the curve — level 8 buys about 1% for
# several times the CPU, on files that are already lossless-of-lossy.
_FLAC_COMPRESSION = "5"


def normalize(value: str | None) -> str:
    """The stored setting, or the default for anything unreadable.

    A preference file written by another build, a hand-edited value, a null:
    all of them mean "nobody chose", and the answer to that is the format the
    app would have used anyway. Never raises — a bad value must not be able to
    stop a download."""
    candidate = (value or "").strip().lower().lstrip(".")
    return candidate if candidate in FORMATS else DEFAULT


def is_native(fmt: str | None) -> bool:
    """Whether this format is the one the download already produces.

    The distinction that keeps the app's promise: native means yt-dlp writes
    the stream it received and nothing decodes it. Anything else is a real
    re-encode, which the caller has to be able to say out loud."""
    return normalize(fmt) == DEFAULT


def encoder_args(fmt: str) -> list[str]:
    """ffmpeg's output arguments for one format, cover stream excluded.

    `-vn` drops the attached picture rather than trying to carry it across
    containers — every container spells cover art differently, and the caller
    re-embeds it afterwards through one writer that knows all of them.
    """
    target = normalize(fmt)
    if target == "mp3":
        return ["-vn", "-c:a", "libmp3lame", "-q:a", _MP3_QUALITY]
    if target == "flac":
        return ["-vn", "-c:a", "flac", "-compression_level", _FLAC_COMPRESSION]
    # AAC in MP4: the shape a download already lands in, for a library being
    # converted *back* from mp3 or flac. `-b:a 256k` sits comfortably above the
    # streams the download receives.
    return ["-vn", "-c:a", "aac", "-b:a", "256k"]


def ffmpeg_command(ffmpeg: str, source: str, dest: str, fmt: str) -> list[str]:
    """The full conversion command line. Pure, so the test reads like the
    command someone would type.

    `-loglevel error` because the sidecar's stderr is its log: a conversion
    pass over a whole library would otherwise write a screenful per track and
    bury everything else in it.
    """
    return [
        ffmpeg,
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-y",
        "-i",
        source,
        *encoder_args(fmt),
        dest,
    ]


def postprocessors(fmt: str) -> list[dict]:
    """yt-dlp's postprocessor chain for a download that must not stay native.

    Empty for the native format, and that emptiness is the invariant: with no
    postprocessor yt-dlp writes the stream it downloaded, byte for byte.
    """
    target = normalize(fmt)
    if is_native(target):
        return []
    quality = _MP3_QUALITY if target == "mp3" else "0"
    return [
        {
            "key": "FFmpegExtractAudio",
            "preferredcodec": target,
            "preferredquality": quality,
        }
    ]


def source_selector(fmt: str) -> str:
    """yt-dlp's format selector for a target format.

    Native keeps asking for the m4a stream by name — that is the whole promise:
    the file the app stores is the file it was served. A transcode asks for the
    best audio of any kind instead, because the encoder is about to decode it
    anyway and the widest, highest-rate source is the one that survives it best.
    """
    if is_native(fmt):
        return "bestaudio[ext=m4a]/bestaudio"
    return "bestaudio/best"
