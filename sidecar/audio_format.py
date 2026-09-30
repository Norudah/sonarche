"""Audio format setting: the only preference that rewrites audio bytes.

- `m4a`: the downloaded stream as-is (default, no re-encode).
- `mp3`: for devices that only play mp3.

Existing flac files are still read and played; the app no longer produces them.
"""

# Extension = wire value = stored setting.
FORMATS = ("m4a", "mp3")

DEFAULT = "m4a"

# LAME V0 (~245 kbps VBR), above any downloaded stream's bitrate.
_MP3_QUALITY = "0"


def normalize(value: str | None) -> str:
    """The stored setting, or the default for anything unreadable. Never raises."""
    candidate = (value or "").strip().lower().lstrip(".")
    return candidate if candidate in FORMATS else DEFAULT


def is_native(fmt: str | None) -> bool:
    """Whether this format needs no re-encode."""
    return normalize(fmt) == DEFAULT


def encoder_args(fmt: str) -> list[str]:
    """ffmpeg output arguments. `-vn` drops the cover; it is re-embedded later."""
    target = normalize(fmt)
    if target == "mp3":
        return ["-vn", "-c:a", "libmp3lame", "-q:a", _MP3_QUALITY]
    # For converting back from mp3 or legacy flac.
    return ["-vn", "-c:a", "aac", "-b:a", "256k"]


def ffmpeg_command(ffmpeg: str, source: str, dest: str, fmt: str) -> list[str]:
    """The full conversion command line."""
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
    """yt-dlp postprocessors; empty for the native format, so yt-dlp writes the
    stream byte for byte.
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
    """yt-dlp format selector: the m4a stream when native, otherwise the best
    audio of any kind since it will be re-encoded anyway.
    """
    if is_native(fmt):
        return "bestaudio[ext=m4a]/bestaudio"
    return "bestaudio/best"
