"""Cryptographic fixtures are isolated test evidence, never policy/chain success."""

from datetime import UTC, datetime, timedelta

import pytest
from app.core.canonical import digest
from app.models.contracts import CertificatePayload
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

NOW = datetime(2026, 10, 15, 8, 0, tzinfo=UTC)


@pytest.fixture
def payload():
    action = dict(
        id="crypto-fixture",
        action_type="TEST_TOKEN_ALLOCATION",
        amount_minor=10000,
        chain_id=84532,
        token_address="0x" + "1" * 40,
        recipient="0x" + "2" * 40,
        funding_source="owned",
        planner_reason_untrusted="Isolated crypto fixture; no trusted policy result",
        planner_mode="deterministic_demo",
    )
    config = dict(
        id="test-config",
        model_version="test-only",
        seed=18421,
        path_count=1000,
        horizon_days=120,
        daily_volatility_bps=0,
        income_delay_probability_bps=0,
        emergency_probability_bps=0,
        emergency_expense_minor=200000,
        fee_minor=0,
        model_assumptions=["Test data only, not a configured product model"],
    )
    transaction = dict(
        chain_id=84532,
        sender="0x" + "3" * 40,
        to=action["token_address"],
        token_address=action["token_address"],
        recipient=action["recipient"],
        token_decimals=6,
        amount_base_units="100000000",
        value_wei="0",
        data="0xa9059cbb" + action["recipient"][2:].rjust(64, "0") + f"{100000000:064x}",
        nonce=0,
        gas_limit=100000,
        max_fee_per_gas_wei="100",
        max_priority_fee_per_gas_wei="1",
        intention="test allocation to an approved demo destination",
    )
    return CertificatePayload.model_validate(
        dict(
            id="certificate-fixture",
            action=action,
            action_digest=digest(action),
            transaction=transaction,
            state_version=1,
            state_snapshot_hash="a" * 64,
            constitution_version="policy-fixture",
            policy_digest="b" * 64,
            verdict=dict(
                decision="REQUIRES_APPROVAL",
                checks=[
                    dict(
                        rule="fixture",
                        status="REQUIRES_APPROVAL",
                        reason_code="TEST_ONLY",
                        measured={},
                    )
                ],
            ),
            simulation=dict(
                id="simulation-fixture",
                action_id=action["id"],
                state_snapshot_hash="a" * 64,
                config=config,
                config_digest=digest(config),
                metrics=dict(
                    goal_satisfaction_probability_bps=10000,
                    reserve_breach_probability_bps=0,
                    p05_terminal_liquidity_minor=200000,
                    expected_terminal_value_minor=1200000,
                ),
                stress_results=[],
                sampled_liquidity_paths_minor=[],
                created_at=NOW,
            ),
            approval=dict(required=True, reasons=["test-only approval"]),
            issued_at=NOW,
            expires_at=NOW + timedelta(minutes=5),
            nonce="c" * 64,
        )
    )


def crypto():
    from app.verifier import certificates

    return certificates


def keypair():
    # Publicly documented deterministic test seed; never a runtime key.
    key = Ed25519PrivateKey.from_private_bytes(bytes(range(32)))
    return key, {"test-key": key.public_key()}


def test_signature_round_trip_is_stable_and_reproducible(payload):
    key, keys = keypair()
    cert = crypto().sign_certificate(payload, key, "test-key")
    assert cert == crypto().sign_certificate(payload, key, "test-key")
    assert cert.certificate_hash == digest(payload)
    result = crypto().verify_integrity(cert, keys, now=NOW)
    assert result.status == "VALID"
    assert result.signature_valid


@pytest.mark.parametrize(
    "field,value",
    [("certificate_hash", "d" * 64), ("verifier_signature", "0" * 128), ("key_id", "unknown")],
)
def test_envelope_tamper_rejected(payload, field, value):
    key, keys = keypair()
    cert = crypto().sign_certificate(payload, key, "test-key")
    cert = cert.model_copy(update={field: value})
    result = crypto().verify_integrity(cert, keys, now=NOW)
    assert result.status == "TAMPERED"
    assert not result.signature_valid


def test_changed_payload_even_with_recomputed_hash_has_invalid_signature(payload):
    key, keys = keypair()
    cert = crypto().sign_certificate(payload, key, "test-key")
    changed = payload.model_copy(update={"nonce": "d" * 64})
    forged = cert.model_copy(update={"payload": changed, "certificate_hash": digest(changed)})
    assert crypto().verify_integrity(forged, keys, now=NOW).status == "TAMPERED"


def test_wrong_public_key_and_key_id_alias_are_rejected(payload):
    key, keys = keypair()
    cert = crypto().sign_certificate(payload, key, "test-key")
    assert (
        crypto()
        .verify_integrity(cert, {"test-key": Ed25519PrivateKey.generate().public_key()}, now=NOW)
        .status
        == "TAMPERED"
    )
    assert (
        crypto()
        .verify_integrity(
            cert.model_copy(update={"key_id": "alias"}), {"alias": keys["test-key"]}, now=NOW
        )
        .status
        == "TAMPERED"
    )


def test_expiry_exact_boundary_and_future_issuance(payload):
    key, keys = keypair()
    cert = crypto().sign_certificate(payload, key, "test-key")
    assert (
        crypto()
        .verify_integrity(cert, keys, now=payload.expires_at - timedelta(microseconds=1))
        .status
        == "VALID"
    )
    expired = crypto().verify_integrity(cert, keys, now=payload.expires_at)
    assert expired.status == "EXPIRED" and expired.signature_valid
    assert (
        crypto().verify_integrity(cert, keys, now=NOW - timedelta(seconds=1)).status == "TAMPERED"
    )


def test_signer_revalidates_nested_mutation_and_lifetime(payload):
    key, _ = keypair()
    payload.action.__dict__["amount_minor"] = 10001
    with pytest.raises(ValueError):
        crypto().sign_certificate(payload, key, "test-key")


def test_signer_rejects_wrong_action_or_config_digest(payload):
    key, _ = keypair()
    for changed in [
        payload.model_copy(update={"action_digest": "f" * 64}),
        payload.model_copy(
            update={"simulation": payload.simulation.model_copy(update={"config_digest": "f" * 64})}
        ),
        payload.model_copy(update={"expires_at": NOW + timedelta(minutes=6)}),
    ]:
        with pytest.raises(ValueError):
            crypto().sign_certificate(changed, key, "test-key")


def test_missing_certificate_has_explicit_error(client):
    result = client.get("/certificates/absent")
    assert result.status_code == 409
    assert result.json()["code"] == "INVALID_CERTIFICATE"


def test_no_certificate_issuance_endpoint_enabled(client, payload):
    result = client.post("/verify", json={"action": payload.action.model_dump(mode="json")})
    assert result.status_code == 501
    assert result.json()["code"] == "NOT_IMPLEMENTED"


@pytest.fixture
def stored_certificate(database, payload, monkeypatch):
    import json

    from app.db import models as db
    from app.db.state import read_state
    from app.models.contracts import ConstitutionRules, ConstitutionVersion

    key, keys = keypair()
    monkeypatch.setenv(
        "VERIFIER_PUBLIC_KEYS_JSON",
        json.dumps({"test-key": keys["test-key"].public_bytes_raw().hex()}),
    )
    with database[1].begin() as session:
        state = read_state(session)
        rules = ConstitutionRules(
            allowed_tokens=[payload.action.token_address],
            known_recipients=[payload.action.recipient],
        )
        policy = ConstitutionVersion(
            id="policy-fixture",
            user_id="demo-user",
            version=1,
            rules=rules,
            policy_digest=digest(rules),
            confirmed_at=NOW,
            confirmed_by="demo-user",
        )
        session.add(
            db.ConstitutionVersionRecord(
                id=policy.id,
                user_id="demo-user",
                draft_id="draft-initial",
                version=1,
                policy_digest=policy.policy_digest,
                payload=policy.model_dump(mode="json"),
            )
        )
        session.flush()
        session.get(db.UserHead, "demo-user").constitution_id = policy.id
        simulation = payload.simulation.model_copy(
            update={"state_snapshot_hash": state.snapshot_hash}
        )
        updated = payload.model_copy(
            update={
                "state_snapshot_hash": state.snapshot_hash,
                "simulation": simulation,
                "policy_digest": policy.policy_digest,
                "issued_at": datetime.now(UTC) - timedelta(seconds=1),
                "expires_at": datetime.now(UTC) + timedelta(minutes=4),
            }
        )
        cert = crypto().sign_certificate(updated, key, "test-key")
        session.add(
            db.CandidateRecord(
                id=payload.action.id,
                state_id=state.id,
                action_digest=payload.action_digest,
                payload=payload.action.model_dump(mode="json"),
            )
        )
        session.add(
            db.SimulationConfigRecord(
                id=simulation.config.id,
                config_digest=simulation.config_digest,
                payload=simulation.config.model_dump(mode="json"),
            )
        )
        session.flush()
        session.add(
            db.SimulationRecord(
                id=simulation.id,
                action_id=payload.action.id,
                state_id=state.id,
                config_id=simulation.config.id,
                payload=simulation.model_dump(mode="json"),
            )
        )
        session.flush()
        session.add(
            db.VerificationRecord(
                id="verification-fixture",
                action_id=payload.action.id,
                simulation_id=simulation.id,
                constitution_id=policy.id,
                payload={},
            )
        )
        session.flush()
        session.add(
            db.CertificateRecord(
                id=cert.payload.id,
                action_id=payload.action.id,
                state_id=state.id,
                constitution_id=policy.id,
                verification_id="verification-fixture",
                nonce=cert.payload.nonce,
                certificate_hash=cert.certificate_hash,
                payload=cert.model_dump(mode="json"),
            )
        )
    return cert


def test_stored_read_and_verification_approval_requirement(client, stored_certificate):
    id = stored_certificate.payload.id
    result = client.get(f"/certificates/{id}")
    assert result.status_code == 200
    assert result.json() == stored_certificate.model_dump(mode="json")
    status = client.post(f"/certificates/{id}/verify")
    assert status.status_code == 200
    assert status.json()["status"] == "APPROVAL_REQUIRED"
    assert status.json()["signature_valid"] is True
    assert (
        client.post(f"/certificates/{id}/verify", json={"certificate": {}}).json()["status"]
        == "APPROVAL_REQUIRED"
    )


def test_stale_state_rejected_even_with_authentic_signature(client, stored_certificate, database):
    from app.db.state import append_state, read_state

    with database[1].begin() as session:
        current = read_state(session)
        append_state(
            session,
            current.snapshot.model_copy(update={"version": 2, "realized_expense_minor": 200000}),
            1,
        )
    result = client.post(f"/certificates/{stored_certificate.payload.id}/verify").json()
    assert result["status"] == "SIGNED_BUT_STALE"
    assert result["signature_valid"] is True


def test_policy_deactivation_and_changed_hash_are_stale(client, stored_certificate, database):
    from app.db.models import UserHead

    with database[1].begin() as session:
        session.get(UserHead, "demo-user").constitution_id = None
    result = client.post(f"/certificates/{stored_certificate.payload.id}/verify").json()
    assert result["status"] == "SIGNED_BUT_STALE"


def test_stored_signature_tamper_never_passes(client, stored_certificate, database):
    from app.db.models import CertificateRecord

    with database[1].begin() as session:
        row = session.get(CertificateRecord, stored_certificate.payload.id)
        row.payload = {**row.payload, "verifier_signature": "0" * 128}
    result = client.post(f"/certificates/{stored_certificate.payload.id}/verify").json()
    assert result["status"] == "TAMPERED" and not result["signature_valid"]


def test_claimed_certificate_already_used(client, stored_certificate, database):
    from app.db.models import ExecutionRecord

    with database[1].begin() as session:
        session.add(
            ExecutionRecord(
                id="execution-fixture",
                certificate_id=stored_certificate.payload.id,
                idempotency_key="test-only-key",
                status="CLAIMED",
                tx_hash=None,
                payload={},
            )
        )
    assert (
        client.post(f"/certificates/{stored_certificate.payload.id}/verify").json()["status"]
        == "ALREADY_USED"
    )


def test_no_public_keys_fails_closed_without_issuance(client, stored_certificate, monkeypatch):
    monkeypatch.delenv("VERIFIER_PUBLIC_KEYS_JSON")
    result = client.post(f"/certificates/{stored_certificate.payload.id}/verify")
    assert result.status_code == 503
    assert result.json()["code"] == "UNAVAILABLE"


def test_matching_authenticated_approval_enables_current_status(
    client, stored_certificate, database
):
    from app.db.models import ApprovalRecord
    from app.models.contracts import Approval

    p = stored_certificate.payload
    approval = Approval(
        id="approval-fixture",
        certificate_id=p.id,
        action_digest=p.action_digest,
        state_version=p.state_version,
        constitution_version=p.constitution_version,
        actor_id="demo-user",
        decision="APPROVE",
        created_at=p.issued_at + timedelta(milliseconds=100),
        consumed_at=None,
    )
    with database[1].begin() as session:
        session.add(
            ApprovalRecord(
                id=approval.id,
                certificate_id=p.id,
                actor_id="demo-user",
                payload=approval.model_dump(mode="json"),
                consumed_at=None,
            )
        )
    assert client.post(f"/certificates/{p.id}/verify").json()["status"] == "VALID"
    with database[1].begin() as session:
        record = session.get(ApprovalRecord, approval.id)
        record.payload = {**record.payload, "action_digest": "f" * 64}
    assert client.post(f"/certificates/{p.id}/verify").json()["status"] == "APPROVAL_REQUIRED"


def test_signature_wire_format_is_domain_separated_and_key_bound(payload):
    key, keys = keypair()
    cert = crypto().sign_certificate(payload, key, "test-key")
    expected_message = b"ProofFi.ActionCertificate.v1\x00\x00\x00\x00\x08test-key" + bytes.fromhex(
        digest(payload)
    )
    # Independent public-key validation of the documented byte format.
    keys["test-key"].verify(bytes.fromhex(cert.verifier_signature), expected_message)
    plain = cert.model_copy(
        update={"verifier_signature": key.sign(bytes.fromhex(cert.certificate_hash)).hex()}
    )
    assert crypto().verify_integrity(plain, keys, now=NOW).status == "TAMPERED"


@pytest.mark.parametrize("encoded", ["not-json", "[]", "{}", '{"test-key":"wrong"}'])
def test_malformed_public_key_config_fails_closed(monkeypatch, encoded):
    from app.core.errors import DomainError

    monkeypatch.setenv("VERIFIER_PUBLIC_KEYS_JSON", encoded)
    with pytest.raises(DomainError) as error:
        crypto().public_keys_from_environment()
    assert error.value.code == "UNAVAILABLE"
    assert encoded not in error.value.message


def test_corrupted_policy_fails_closed(client, stored_certificate, database):
    from app.db.models import ConstitutionVersionRecord

    with database[1].begin() as session:
        row = session.get(ConstitutionVersionRecord, "policy-fixture")
        row.policy_digest = "f" * 64
    result = client.post(f"/certificates/{stored_certificate.payload.id}/verify")
    assert result.status_code == 503
    assert result.json()["code"] == "UNAVAILABLE"


def test_certificate_routes_stay_authenticated(client, stored_certificate):
    client.headers.pop("Authorization")
    client.cookies.clear()
    id = stored_certificate.payload.id
    assert client.get(f"/certificates/{id}").status_code == 401
    assert client.post(f"/certificates/{id}/verify").status_code == 401
