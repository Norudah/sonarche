"""Bounded reads over HTTP responses.

Every image download used to land through `resp.content`, which materializes
the whole body in memory *before* any size check — a hostile or misconfigured
server could pull gigabytes into the sidecar. Callers now stream and hand the
response here; past their cap, the read stops and raises instead.
"""

_CHUNK_BYTES = 64 * 1024


def read_bounded(resp, max_bytes: int) -> bytes:
    """The response body, read in chunks; RuntimeError the moment it passes
    `max_bytes`, with only the bounded prefix ever held in memory."""
    chunks = []
    total = 0
    for chunk in resp.iter_content(chunk_size=_CHUNK_BYTES):
        total += len(chunk)
        if total > max_bytes:
            raise RuntimeError("download too large")
        chunks.append(chunk)
    return b"".join(chunks)
