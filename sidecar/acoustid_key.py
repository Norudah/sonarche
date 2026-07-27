"""Tell a working AcoustID key from a mistyped one, without a fingerprint.

AcoustID rejects a bad key (`code 4`) before it ever looks at the rest of the
request, so a deliberately empty lookup is enough to answer the question — no
audio file, no fingerprint, nothing spent. Anything else coming back means the
key itself got through and the server is only complaining about the request we
knowingly sent incomplete.

The answer is a verdict, not a raw payload: the walkthrough shows a check or a
reason, and mapping the API's error codes is this module's job, not the UI's.
"""

import protocol

_LOOKUP = "https://api.acoustid.org/v2/lookup"

# https://acoustid.org/webservice — 4 is the only code that means "the key".
_INVALID_KEY = 4

# The server answers 400 with a JSON body on a rejected key, so the status code
# is not the signal; the payload is.
_TIMEOUT = 15


def classify(payload: dict) -> dict:
    """The API's answer as a verdict. Pure — the network lives in `handle`."""
    if payload.get("status") == "ok":
        return {"valid": True, "reason": None}
    error = payload.get("error") or {}
    if error.get("code") == _INVALID_KEY:
        return {"valid": False, "reason": "invalidKey"}
    return {"valid": True, "reason": None}


def handle(request_id: str, params: dict) -> dict:
    import requests

    key = (params.get("key") or "").strip()
    if not key:
        return {"valid": False, "reason": "empty"}

    protocol.log("acoustid_key: checking the key against the lookup endpoint")
    resp = requests.post(
        _LOOKUP, data={"client": key, "format": "json"}, timeout=_TIMEOUT
    )
    try:
        payload = resp.json()
    except ValueError:
        raise RuntimeError(
            f"AcoustID answered {resp.status_code} with no JSON body"
        ) from None
    return classify(payload)
