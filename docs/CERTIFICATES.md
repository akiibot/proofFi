# Certificate integrity v1

PF-012 implements cryptographic primitives and stored-certificate read/status routes. It does not implement policy evaluation, trusted certificate issuance (PF-029), human approval recording (PF-013), executor authorization (PF-014), or chain signing. No product certificate is generated from fixtures or seeded on application startup.

## Canonical format

The unsigned object is exactly CertificatePayload in the approved v1.0.0 contract. Canonical JSON uses sorted keys, UTF-8, compact separators, no floats, and Pydantic JSON timestamp representation. SHA-256 of those bytes is certificate_hash. Action and simulation-configuration digests are independently recomputed. Revalidation through detached JSON prevents frozen-model nested mutation or unvalidated model_copy updates from bypassing consistency checks.

Ed25519 signs the following bytes:

Vallet retains the original `ProofFi.ActionCertificate.v1` protocol domain below
so existing signatures remain valid. It is not product display branding.

```text
UTF8("ProofFi.ActionCertificate.v1") || 0x00
|| uint32_big_endian(len(UTF8(key_id))) || UTF8(key_id)
|| raw_32_bytes(certificate_hash)
```

This domain separator prevents signatures from another use being interpreted as certificates; key ID is bound to the signature. The signature is lowercase hex of 64 signature bytes. Hash and signature are envelope fields, excluded from the unsigned payload. Execution status/hash remain in separate records. Lifetime is at most five minutes; expiry is exclusive. Future-issued certificates are not currently valid. None of this proves future solvency or independently establishes policy compliance.

## Keys and authority

sign_certificate takes an explicit Ed25519PrivateKey supplied only by the future trusted issuance service. It never generates or loads a default key. There is no HTTP signing endpoint. Public verification loads only a backend-controlled public keyring, configured as VERIFIER_PUBLIC_KEYS_JSON: a JSON object mapping key IDs to lowercase hex raw 32-byte Ed25519 public keys. No private key goes into that variable. Missing/malformed keyrings return UNAVAILABLE without echoing configuration. Unknown certificate key IDs fail integrity checks. Retain old trusted public keys while historical certificates remain viewable.

Signing-key provisioning and rotation remain part of trusted issuance deployment; no private key is generated, persisted or committed by PF-012. Test keys are deterministic, explicitly public test fixtures, and never loaded by runtime code.

## API behavior

GET /certificates/{id} loads the stored signed artifact. Reading it does not imply current validity. Missing IDs return 409 INVALID_CERTIFICATE, using the existing error contract. Malformed stored records fail closed.

POST /certificates/{id}/verify loads the stored certificate itself, never trusting a client copy. It checks:

1. Schema, canonical hash, action/config digests, trusted public-key signature and bounded time window.
2. Stored metadata binding and current financial snapshot/version.
3. Active Constitution identity and integrity/digest.
4. Any execution claim, including failed or pending records (a spent certificate is never automatically reusable).
5. Required approval: exact certificate/action/state/policy, correct stored actor, approve decision, valid timestamp and unconsumed state.

The existing CertificateStatus response distinguishes TAMPERED, EXPIRED, SIGNED_BUT_STALE, ALREADY_USED, APPROVAL_REQUIRED and VALID. VALID is a read-time observation; it is not an execution lock or permission to sign. PF-014 must independently repeat checks and atomically claim authorization. The status route does not test current gas, balances, RPC availability or re-run risk policy; those are executor/issuance responsibilities.

No API schema or migration changed for this issue. Signing format is an implementation detail of the approved canonical JSON + Ed25519 choice, documented here for all consumers.
