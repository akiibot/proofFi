"""Certificate integrity primitives, not policy authorization or chain signing.

Only PF-029's trusted issuance service may supply a verified payload and a private
key. HTTP handlers never accept certificates or load a signing key.
"""

import json
import os
from collections.abc import Mapping
from datetime import UTC, datetime, timedelta

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey

from app.core.canonical import digest
from app.core.errors import DomainError
from app.models.contracts import ActionCertificate, CertificatePayload, CertificateStatus, ErrorCode

MAX_LIFETIME = timedelta(minutes=5)
DOMAIN = b"ProofFi.ActionCertificate.v1\x00"


def signature_message(certificate_hash: str, key_id: str) -> bytes:
    # Length-prefix the UTF-8 key identifier to avoid ambiguous concatenation.
    key = key_id.encode("utf-8")
    return DOMAIN + len(key).to_bytes(4, "big") + key + bytes.fromhex(certificate_hash)


def validated_payload(payload: CertificatePayload) -> CertificatePayload:
    # frozen=True does not freeze nested lists/dicts or validate model_copy updates.
    # Reparse a detached serialization before signing/verifying.
    value = CertificatePayload.model_validate_json(payload.model_dump_json())
    if value.expires_at - value.issued_at > MAX_LIFETIME:
        raise ValueError("Certificate lifetime exceeds five minutes")
    if value.action_digest != digest(value.action):
        raise ValueError("Action digest mismatch")
    if value.simulation.config_digest != digest(value.simulation.config):
        raise ValueError("Simulation config digest mismatch")
    return value


def sign_certificate(
    payload: CertificatePayload, private_key: Ed25519PrivateKey, key_id: str
) -> ActionCertificate:
    """Internal primitive: caller must independently establish policy authorization."""
    payload = validated_payload(payload)
    hashed = digest(payload)
    # Validate the envelope/key ID before doing cryptographic work.
    envelope = ActionCertificate(
        payload=payload, certificate_hash=hashed, verifier_signature="0" * 128, key_id=key_id
    )
    signature = private_key.sign(signature_message(hashed, envelope.key_id)).hex()
    return envelope.model_copy(update={"verifier_signature": signature})


def verify_integrity(
    certificate: ActionCertificate,
    public_keys: Mapping[str, Ed25519PublicKey],
    *,
    now: datetime | None = None,
) -> CertificateStatus:
    """VALID here means integrity/time only; API status adds stored lifecycle checks."""
    now = now or datetime.now(UTC)
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("Verification clock must be timezone-aware")
    try:
        certificate = ActionCertificate.model_validate_json(certificate.model_dump_json())
        payload = validated_payload(certificate.payload)
        if digest(payload) != certificate.certificate_hash:
            raise ValueError("Certificate digest mismatch")
        key = public_keys.get(certificate.key_id)
        if key is None:
            raise ValueError("Unknown verifier key")
        key.verify(
            bytes.fromhex(certificate.verifier_signature),
            signature_message(certificate.certificate_hash, certificate.key_id),
        )
    except (ValueError, InvalidSignature):
        return CertificateStatus(
            certificate_id=certificate.payload.id,
            status="TAMPERED",
            signature_valid=False,
            reasons=["Integrity or trusted verifier key check failed"],
        )
    if payload.issued_at > now:
        return CertificateStatus(
            certificate_id=payload.id,
            status="TAMPERED",
            signature_valid=True,
            reasons=["Certificate is not yet valid"],
        )
    if now >= payload.expires_at:
        return CertificateStatus(
            certificate_id=payload.id,
            status="EXPIRED",
            signature_valid=True,
            reasons=["Certificate expired"],
        )
    return CertificateStatus(
        certificate_id=payload.id, status="VALID", signature_valid=True, reasons=[]
    )


def public_keys_from_environment() -> dict[str, Ed25519PublicKey]:
    """Public keys only. No default key and no key supplied by a certificate/client."""
    try:
        values = json.loads(os.environ.get("VERIFIER_PUBLIC_KEYS_JSON", "{}"))
        if not isinstance(values, dict) or not values:
            raise ValueError("Missing public verifier keyring")
        result = {}
        for key_id, encoded in values.items():
            if (
                not isinstance(key_id, str)
                or not key_id
                or len(key_id) > 100
                or not isinstance(encoded, str)
            ):
                raise ValueError("Invalid public key entry")
            result[key_id] = Ed25519PublicKey.from_public_bytes(bytes.fromhex(encoded))
        return result
    except (ValueError, TypeError):
        # Do not echo environment content in errors.
        raise DomainError(
            ErrorCode.UNAVAILABLE, "Trusted verifier public keys are not configured"
        ) from None
