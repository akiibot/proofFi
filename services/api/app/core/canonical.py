"""ProofFi JSON v1: sorted keys, UTF-8, compact separators, no floats; not RFC 8785."""

import hashlib
import json

from pydantic import BaseModel


def canonical_bytes(value: BaseModel | dict | list) -> bytes:
    if isinstance(value, BaseModel):
        value = value.model_dump(mode="json")

    def validate(obj):
        if obj is None or type(obj) in (str, int, bool):
            return
        if isinstance(obj, list):
            for item in obj:
                validate(item)
            return
        if isinstance(obj, dict) and all(isinstance(k, str) for k in obj):
            for item in obj.values():
                validate(item)
            return
        raise TypeError(
            "Canonical payloads accept only strings, integers, booleans, null, lists and objects"
        )

    validate(value)
    return json.dumps(
        value, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False
    ).encode("utf-8")


def digest(value: BaseModel | dict | list) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()
