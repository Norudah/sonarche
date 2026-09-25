"""Bounded reads over HTTP responses, so a server can't make the sidecar
buffer an unbounded body."""

_CHUNK_BYTES = 64 * 1024


def read_bounded(resp, max_bytes: int) -> bytes:
    """The body read in chunks; RuntimeError as soon as it exceeds `max_bytes`."""
    chunks = []
    total = 0
    for chunk in resp.iter_content(chunk_size=_CHUNK_BYTES):
        total += len(chunk)
        if total > max_bytes:
            raise RuntimeError("download too large")
        chunks.append(chunk)
    return b"".join(chunks)
