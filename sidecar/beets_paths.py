"""beets hands paths back as bytes; the sidecar works in str."""


def decode(value):
    """`value` as str when beets gave bytes; anything else unchanged."""
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value


def item_path(item) -> str:
    return decode(item.path)
