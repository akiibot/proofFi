"""Approval integration uses isolated signed fixtures, never product-issued authority."""

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta

import pytest
from app.core.canonical import digest
from app.db.models import ApprovalRecord, AuditRecord, CertificateRecord, ExecutionRecord, UserHead
from app.db.state import append_state, read_state
from app.verifier.certificates import sign_certificate
from sqlalchemy import func, select
from test_pf_012 import keypair
from test_pf_012 import payload as payload
from test_pf_012 import stored_certificate as stored_certificate


def body(certificate, decision="APPROVE"):
    return {
        "certificate_id": certificate.payload.id,
        "action_digest": certificate.payload.action_digest,
        "decision": decision,
    }


def count_approvals(database):
    with database[1]() as session:
        return session.scalar(select(func.count()).select_from(ApprovalRecord))


def persist_signed(database, certificate):
    with database[1].begin() as session:
        row = session.get(CertificateRecord, certificate.payload.id)
        row.payload = certificate.model_dump(mode="json")
        row.certificate_hash = certificate.certificate_hash


def test_approval_is_bound_to_authenticated_actor_and_exact_certificate(
    client, stored_certificate, database
):
    result = client.post("/approvals", json=body(stored_certificate))
    assert result.status_code == 200
    approval = result.json()
    p = stored_certificate.payload
    assert approval["certificate_id"] == p.id
    assert approval["action_digest"] == p.action_digest
    assert approval["state_version"] == p.state_version
    assert approval["constitution_version"] == p.constitution_version
    assert approval["actor_id"] == "demo-user" and approval["decision"] == "APPROVE"
    assert approval["consumed_at"] is None
    assert count_approvals(database) == 1
    assert client.post(f"/certificates/{p.id}/verify").json()["status"] == "VALID"


def test_denial_is_persisted_and_cannot_be_changed_to_approval(
    client, stored_certificate, database
):
    result = client.post("/approvals", json=body(stored_certificate, "DENY"))
    assert result.status_code == 200 and result.json()["decision"] == "DENY"
    assert client.post("/approvals", json=body(stored_certificate)).status_code == 409
    assert count_approvals(database) == 1
    assert (
        client.post(f"/certificates/{stored_certificate.payload.id}/verify").json()["status"]
        == "APPROVAL_REQUIRED"
    )


def test_duplicate_requests_do_not_create_second_approval(client, stored_certificate, database):
    assert client.post("/approvals", json=body(stored_certificate)).status_code == 200
    result = client.post("/approvals", json=body(stored_certificate))
    assert result.status_code == 409 and result.json()["code"] == "CONFLICT"
    assert count_approvals(database) == 1


def test_wrong_action_digest_cannot_be_approved(client, stored_certificate, database):
    result = client.post("/approvals", json={**body(stored_certificate), "action_digest": "f" * 64})
    assert result.status_code == 409
    assert result.json()["code"] == "INVALID_CERTIFICATE"
    assert count_approvals(database) == 0


def test_missing_certificate_cannot_be_approved(client, database):
    result = client.post(
        "/approvals",
        json={"certificate_id": "absent", "action_digest": "a" * 64, "decision": "APPROVE"},
    )
    assert result.status_code == 409 and result.json()["code"] == "INVALID_CERTIFICATE"
    assert count_approvals(database) == 0


def test_tampered_signature_does_not_gain_human_authority(client, stored_certificate, database):
    persist_signed(
        database, stored_certificate.model_copy(update={"verifier_signature": "0" * 128})
    )
    assert (
        client.post("/approvals", json=body(stored_certificate)).json()["code"]
        == "INVALID_CERTIFICATE"
    )
    assert count_approvals(database) == 0


def test_expired_certificate_cannot_be_approved(client, stored_certificate, database):
    now = datetime.now(UTC)
    expired = sign_certificate(
        stored_certificate.payload.model_copy(
            update={
                "issued_at": now - timedelta(minutes=6),
                "expires_at": now - timedelta(minutes=1),
            }
        ),
        keypair()[0],
        "test-key",
    )
    persist_signed(database, expired)
    result = client.post("/approvals", json=body(expired))
    assert result.status_code == 409 and result.json()["code"] == "EXPIRED"
    assert count_approvals(database) == 0


def test_state_change_invalidates_approval_request(client, stored_certificate, database):
    with database[1].begin() as session:
        state = read_state(session)
        append_state(
            session,
            state.snapshot.model_copy(update={"version": 2, "realized_expense_minor": 200000}),
            1,
        )
    result = client.post("/approvals", json=body(stored_certificate))
    assert result.status_code == 409 and result.json()["code"] == "STALE_STATE"
    assert count_approvals(database) == 0


def test_policy_deactivation_invalidates_approval_request(client, stored_certificate, database):
    with database[1].begin() as session:
        session.get(UserHead, "demo-user").constitution_id = None
    result = client.post("/approvals", json=body(stored_certificate))
    assert result.status_code == 409 and result.json()["code"] == "STALE_POLICY"
    assert count_approvals(database) == 0


def test_claimed_certificate_cannot_gain_approval(client, stored_certificate, database):
    with database[1].begin() as session:
        session.add(
            ExecutionRecord(
                id="claim-fixture",
                certificate_id=stored_certificate.payload.id,
                idempotency_key="approval-claim-test",
                status="CLAIMED",
                tx_hash=None,
                payload={},
            )
        )
    result = client.post("/approvals", json=body(stored_certificate))
    assert result.status_code == 409 and result.json()["code"] == "ALREADY_USED"
    assert count_approvals(database) == 0


def test_approval_does_not_accept_actor_or_state_from_request(client, stored_certificate, database):
    for extra in [{"actor_id": "demo-user"}, {"state_version": 1}, {"verified": True}]:
        assert (
            client.post("/approvals", json={**body(stored_certificate), **extra}).status_code == 422
        )
    assert count_approvals(database) == 0


def test_approval_requires_session_and_csrf(client, stored_certificate, database):
    assert (
        client.post(
            "/approvals", headers={"X-CSRF-Token": "wrong"}, json=body(stored_certificate)
        ).status_code
        == 403
    )
    client.cookies.clear()
    assert client.post("/approvals", json=body(stored_certificate)).status_code == 401
    assert count_approvals(database) == 0


def test_unavailable_keyring_cannot_gain_approval(
    client, stored_certificate, database, monkeypatch
):
    monkeypatch.delenv("VERIFIER_PUBLIC_KEYS_JSON")
    assert client.post("/approvals", json=body(stored_certificate)).status_code == 503
    assert count_approvals(database) == 0


def test_concurrent_approval_requests_create_exactly_one_decision(
    client, stored_certificate, database
):
    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(
            pool.map(
                lambda _: client.post("/approvals", json=body(stored_certificate)).status_code,
                range(2),
            )
        )
    assert sorted(statuses) == [200, 409]
    assert count_approvals(database) == 1


def test_approval_and_audit_are_atomic_and_hash_bound(client, stored_certificate, database):
    result = client.post("/approvals", json=body(stored_certificate))
    assert result.status_code == 200
    audit = client.get("/audit").json()
    assert len(audit) == 1 and audit[0]["event_type"] == "APPROVAL_RECORDED"
    event = audit[0]
    assert event["actor"] == "demo-user"
    assert event["artifact_digest"] == digest(result.json())
    assert event["details"]["decision"] == "APPROVE"
    assert event["details"]["certificate_id"] == stored_certificate.payload.id
    assert event["previous_hash"] is None and event["sequence"] == 1
    assert event["event_hash"] == digest({k: v for k, v in event.items() if k != "event_hash"})


def test_corrupt_audit_head_rolls_back_approval(client, stored_certificate, database):
    with database[1].begin() as session:
        session.add(
            AuditRecord(
                id="corrupt-head", sequence=1, previous_hash=None, event_hash="f" * 64, payload={}
            )
        )
    result = client.post("/approvals", json=body(stored_certificate))
    assert result.status_code == 503
    assert count_approvals(database) == 0


def test_corrupt_certificate_metadata_cannot_gain_approval(client, stored_certificate, database):
    with database[1].begin() as session:
        session.get(CertificateRecord, stored_certificate.payload.id).certificate_hash = "e" * 64
    result = client.post("/approvals", json=body(stored_certificate))
    assert result.status_code == 409 and result.json()["code"] == "INVALID_CERTIFICATE"
    assert count_approvals(database) == 0


@pytest.mark.parametrize("restriction", ["token", "recipient", "borrowed"])
def test_human_approval_cannot_override_current_hard_restrictions(
    client, stored_certificate, database, restriction
):
    from app.db.models import ConstitutionVersionRecord
    from app.models.contracts import ConstitutionVersion

    certificate = stored_certificate
    with database[1].begin() as session:
        row = session.get(ConstitutionVersionRecord, certificate.payload.constitution_version)
        policy = ConstitutionVersion.model_validate(row.payload)
        action = certificate.payload.action
        rules = policy.rules
        if restriction == "token":
            rules = rules.model_copy(update={"allowed_tokens": []})
        elif restriction == "recipient":
            rules = rules.model_copy(
                update={"known_recipients": [], "blocked_recipients": [action.recipient]}
            )
        else:
            action = action.model_copy(update={"funding_source": "borrowed"})
        policy = policy.model_copy(update={"rules": rules, "policy_digest": digest(rules)})
        row.payload = policy.model_dump(mode="json")
        row.policy_digest = policy.policy_digest
        certificate = sign_certificate(
            certificate.payload.model_copy(
                update={
                    "action": action,
                    "action_digest": digest(action),
                    "policy_digest": policy.policy_digest,
                }
            ),
            keypair()[0],
            "test-key",
        )
    persist_signed(database, certificate)
    result = client.post("/approvals", json=body(certificate))
    assert result.status_code == 403 and result.json()["code"] == "POLICY_DENIED"
    assert count_approvals(database) == 0


def test_unnecessary_approval_is_not_silently_created(client, stored_certificate, database):
    p = stored_certificate.payload
    verdict = p.verdict.model_copy(update={"decision": "PASS", "checks": []})
    approval = p.approval.model_copy(update={"required": False, "reasons": []})
    cert = sign_certificate(
        p.model_copy(update={"verdict": verdict, "approval": approval}), keypair()[0], "test-key"
    )
    persist_signed(database, cert)
    result = client.post("/approvals", json=body(cert))
    assert result.status_code == 409 and result.json()["code"] == "CONFLICT"
    assert count_approvals(database) == 0


def test_two_decisions_link_successive_audit_hashes(client, stored_certificate, database):
    from app.db.models import VerificationRecord

    assert client.post("/approvals", json=body(stored_certificate, "DENY")).status_code == 200
    second = sign_certificate(
        stored_certificate.payload.model_copy(
            update={"id": "second-certificate-fixture", "nonce": "d" * 64}
        ),
        keypair()[0],
        "test-key",
    )
    with database[1].begin() as session:
        original = session.get(CertificateRecord, stored_certificate.payload.id)
        session.add(
            VerificationRecord(
                id="second-verification-fixture",
                action_id=original.action_id,
                simulation_id=second.payload.simulation.id,
                constitution_id=original.constitution_id,
                payload={},
            )
        )
        session.flush()
        session.add(
            CertificateRecord(
                id=second.payload.id,
                action_id=original.action_id,
                state_id=original.state_id,
                constitution_id=original.constitution_id,
                verification_id="second-verification-fixture",
                nonce=second.payload.nonce,
                certificate_hash=second.certificate_hash,
                payload=second.model_dump(mode="json"),
            )
        )
    assert client.post("/approvals", json=body(second)).status_code == 200
    events = client.get("/audit").json()
    assert [e["sequence"] for e in events] == [1, 2]
    assert events[1]["previous_hash"] == events[0]["event_hash"]
    for event in events:
        assert event["event_hash"] == digest({k: v for k, v in event.items() if k != "event_hash"})


def test_approval_does_not_mutate_signed_certificate_or_consume_it(
    client, stored_certificate, database
):
    assert client.post("/approvals", json=body(stored_certificate)).status_code == 200
    assert client.get(
        f"/certificates/{stored_certificate.payload.id}"
    ).json() == stored_certificate.model_dump(mode="json")
    with database[1]() as session:
        assert session.scalar(select(func.count()).select_from(ExecutionRecord)) == 0
        assert session.scalar(select(ApprovalRecord)).consumed_at is None


def test_audit_binds_authenticated_session_without_exposing_cookie(client, stored_certificate):
    import hashlib

    token = client.cookies.get("prooffi_session")
    assert client.post("/approvals", json=body(stored_certificate)).status_code == 200
    result = client.get("/audit")
    event = result.json()[0]
    assert event["details"]["session_digest"] == hashlib.sha256(token.encode()).hexdigest()
    assert token not in result.text
