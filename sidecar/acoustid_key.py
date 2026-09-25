"""Check an AcoustID key without fingerprinting anything.

AcoustID rejects a bad key (code 4) before validating the rest of the
request, so an intentionally empty lookup is enough.
"""

import protocol

_LOOKUP = "https://api.acoustid.org/v2/lookup"

# https://acoustid.org/webservice
_INVALID_KEY = 4

# A rejected key returns 400 with a JSON body: check the payload, not the status.
_TIMEOUT = 15


def classify(payload: dict) -> dict:
    """The API's answer as a verdict."""
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
