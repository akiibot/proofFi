"""Claim guards against real migrated storage; risk recheck is test-only evidence."""

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from importlib import import_module

import pytest
from app.core.canonical import digest
from app.core.errors import DomainError
from app.db.models import (
    ApprovalRecord,
    AuditRecord,
    CertificateRecord,
    ConstitutionVersionRecord,
    ExecutionRecord,
    SimulationConfigRecord,
    SimulationRecord,
    UserHead,
    VerificationRecord,
)
from app.db.state import append_state, read_state
from app.execution.signer import TestnetPolicy as OperationalPolicy
from app.models.contracts import ExecuteRequest, StressResult, VerificationResult
from app.verifier.certificates import sign_certificate
from sqlalchemy import func, select
from test_pf_012 import keypair
from test_pf_012 import payload as payload
from test_pf_012 import stored_certificate as stored_certificate
from test_pf_013 import body, persist_signed


def gate():
    import pkgutil

    import app.execution as execution

    assert "gate" in [x.name for x in pkgutil.iter_modules(execution.__path__)], (
        "PF-014 gate missing"
    )
    return import_module("app.execution.gate")


def request(cert, key="executor-test-key-0001"):
    return ExecuteRequest(
        certificate_id=cert.payload.id,
        action_digest=cert.payload.action_digest,
        idempotency_key=key,
    )


def operational(cert):
    t = cert.payload.transaction
    return OperationalPolicy(
        wallet_address=t.sender,
        token_address=t.token_address,
        recipient=t.recipient,
        token_decimals=t.token_decimals,
        max_gas_limit=t.gas_limit,
        max_fee_per_gas_wei=t.max_fee_per_gas_wei,
    )


@pytest.fixture
def ready(client, stored_certificate, database):
    # Exactly four successful named stresses are isolated fixture data, not model evidence.
    p = stored_certificate.payload
    names = ["market_shock", "income_delay", "emergency_expense", "fee_shock"]
    sim = p.simulation.model_copy(
        update={
            "stress_results": [
                StressResult(
                    name=n,
                    parameters={},
                    passed=True,
                    minimum_liquidity_minor=200000,
                    goal_funded=True,
                )
                for n in names
            ]
        }
    )
    from app.models.contracts import SimulationRun

    sim = SimulationRun.model_validate(sim.model_dump())
    cert = sign_certificate(p.model_copy(update={"simulation": sim}), keypair()[0], "test-key")
    persist_signed(database, cert)
    with database[1].begin() as s:
        s.get(SimulationRecord, sim.id).payload = sim.model_dump(mode="json")
        s.get(VerificationRecord, "verification-fixture").payload = VerificationResult(
            id="verification-fixture",
            action_id=p.action.id,
            verdict=p.verdict,
            simulation_id=sim.id,
            certificate_id=p.id,
            reasons=["ISOLATED TEST FIXTURE"],
        ).model_dump(mode="json")
    assert client.post("/approvals", json=body(cert)).status_code == 200
    return cert


def claim(client, cert, **kwargs):
    # Trusted server seam only; production route cannot accept a recheck implementation.
    return gate().claim_execution(
        client.app.state.engine,
        request(cert),
        "demo-user",
        policy=operational(cert),
        recheck=lambda trusted: (cert.payload.verdict, cert.payload.simulation),
        **kwargs,
    )


def counts(database):
    with database[1]() as s:
        return s.scalar(select(func.count()).select_from(ExecutionRecord))


def test_valid_claim_consumes_exact_approval_and_preserves_certificate(client, ready, database):
    original = ready.model_dump(mode="json")
    result = claim(client, ready)
    assert result.status == "CLAIMED" and result.tx_hash is None
    assert result.confirmations == 0 and result.block_number is None
    with database[1]() as s:
        assert counts(database) == 1
        approval = s.scalar(select(ApprovalRecord))
        assert approval.consumed_at is not None and approval.payload["consumed_at"] is not None
        assert s.get(CertificateRecord, ready.payload.id).payload == original
        audit = s.scalars(select(AuditRecord).order_by(AuditRecord.sequence)).all()
        assert audit[-1].payload["event_type"] == "EXECUTION_CLAIMED"
        assert audit[-1].previous_hash == audit[-2].event_hash


def test_replay_and_concurrency_create_only_one_claim(client, ready, database):
    with ThreadPoolExecutor(max_workers=2) as pool:

        def attempt(_):
            try:
                return claim(client, ready).status
            except DomainError as e:
                return e.code.value

        result = list(pool.map(attempt, range(2)))
    assert sorted(result) == ["ALREADY_USED", "CLAIMED"]
    assert counts(database) == 1
    with pytest.raises(DomainError, match="already claimed"):
        claim(client, ready)


@pytest.mark.parametrize(
    "change,expected",
    [
        ("signature", "INVALID_CERTIFICATE"),
        ("metadata", "INVALID_CERTIFICATE"),
        ("expiry", "EXPIRED"),
        ("state", "STALE_STATE"),
        ("policy", "STALE_POLICY"),
        ("config", "UNAVAILABLE"),
        ("simulation", "INVALID_CERTIFICATE"),
        ("verification", "INVALID_CERTIFICATE"),
        ("approval", "APPROVAL_REQUIRED"),
        ("audit", "UNAVAILABLE"),
    ],
)
def test_corrupt_or_stale_authority_never_claims(client, ready, database, change, expected):
    with database[1].begin() as s:
        row = s.get(CertificateRecord, ready.payload.id)
        if change == "signature":
            row.payload = {**row.payload, "verifier_signature": "0" * 128}
        elif change == "metadata":
            row.certificate_hash = "e" * 64
        elif change == "expiry":
            old = datetime.now(UTC) - timedelta(minutes=6)
            cert = sign_certificate(
                ready.payload.model_copy(
                    update={"issued_at": old, "expires_at": old + timedelta(minutes=5)}
                ),
                keypair()[0],
                "test-key",
            )
            row.payload = cert.model_dump(mode="json")
            row.certificate_hash = cert.certificate_hash
        elif change == "state":
            state = read_state(s)
            append_state(s, state.snapshot.model_copy(update={"version": 2}), 1)
        elif change == "policy":
            s.get(UserHead, "demo-user").constitution_id = None
        elif change == "config":
            s.get(SimulationConfigRecord, ready.payload.simulation.config.id).config_digest = (
                "e" * 64
            )
        elif change == "simulation":
            sim = s.get(SimulationRecord, ready.payload.simulation.id)
            sim.payload = {**sim.payload, "action_id": "wrong"}
        elif change == "verification":
            s.get(VerificationRecord, "verification-fixture").payload = {}
        elif change == "approval":
            ap = s.scalar(select(ApprovalRecord))
            ap.payload = {**ap.payload, "decision": "DENY"}
        else:
            audit = s.scalar(select(AuditRecord))
            audit.event_hash = "f" * 64
    with pytest.raises(DomainError) as e:
        claim(client, ready)
    assert e.value.code == expected and counts(database) == 0
    with database[1]() as s:
        assert s.scalar(select(ApprovalRecord)).consumed_at is None


def test_missing_recheck_fails_closed_and_does_not_consume(client, ready, database):
    with pytest.raises(DomainError) as e:
        gate().claim_execution(
            client.app.state.engine, request(ready), "demo-user", policy=operational(ready)
        )
    assert e.value.code == "NOT_IMPLEMENTED" and counts(database) == 0


def test_changed_recomputed_evidence_refuses_claim(client, ready, database):
    verdict = ready.payload.verdict.model_copy(update={"decision": "DENY"})
    with pytest.raises(DomainError) as e:
        gate().claim_execution(
            client.app.state.engine,
            request(ready),
            "demo-user",
            policy=operational(ready),
            recheck=lambda trusted: (verdict, ready.payload.simulation),
        )
    assert e.value.code == "POLICY_DENIED" and counts(database) == 0


def test_wrong_actor_or_action_never_claims(client, ready, database):
    for actor, req in [
        ("intruder", request(ready)),
        ("demo-user", request(ready).model_copy(update={"action_digest": "f" * 64})),
    ]:
        with pytest.raises(DomainError):
            gate().claim_execution(
                client.app.state.engine,
                req,
                actor,
                policy=operational(ready),
                recheck=lambda trusted: (ready.payload.verdict, ready.payload.simulation),
            )
    assert counts(database) == 0


def test_operational_allowlist_is_independent_of_signature(client, ready, database):
    wrong = operational(ready).model_copy(update={"recipient": "0x" + "4" * 40})
    with pytest.raises(DomainError) as e:
        gate().claim_execution(
            client.app.state.engine,
            request(ready),
            "demo-user",
            policy=wrong,
            recheck=lambda trusted: (ready.payload.verdict, ready.payload.simulation),
        )
    assert e.value.code == "POLICY_DENIED" and counts(database) == 0


def test_runtime_does_not_enable_execution_from_isolated_signed_fixture(client, ready, database):
    result = client.post("/execute", json=request(ready).model_dump())
    assert result.status_code == 501 and result.json()["code"] == "NOT_IMPLEMENTED"
    assert counts(database) == 0


def second_certificate(database, cert, *, chain_nonce=0):
    """A distinct authority artifact for the same candidate/run, only in tests."""
    t = cert.payload.transaction.model_copy(update={"nonce": chain_nonce})
    second = sign_certificate(
        cert.payload.model_copy(
            update={
                "id": "second-executor-certificate",
                "nonce": "d" * 64,
                "transaction": t,
            }
        ),
        keypair()[0],
        "test-key",
    )
    with database[1].begin() as s:
        original = s.get(CertificateRecord, cert.payload.id)
        verification = VerificationResult.model_validate(
            s.get(VerificationRecord, original.verification_id).payload
        )
        verification = verification.model_copy(
            update={"id": "second-verification", "certificate_id": second.payload.id}
        )
        s.add(
            VerificationRecord(
                id=verification.id,
                action_id=original.action_id,
                simulation_id=second.payload.simulation.id,
                constitution_id=original.constitution_id,
                payload=verification.model_dump(mode="json"),
            )
        )
        s.flush()
        s.add(
            CertificateRecord(
                id=second.payload.id,
                action_id=original.action_id,
                state_id=original.state_id,
                constitution_id=original.constitution_id,
                verification_id=verification.id,
                nonce=second.payload.nonce,
                certificate_hash=second.certificate_hash,
                payload=second.model_dump(mode="json"),
            )
        )
    return second


@pytest.mark.parametrize("reason", ["nonce", "idempotency"])
def test_distinct_certificates_cannot_reuse_reserved_nonce_or_key(client, ready, database, reason):
    assert claim(client, ready).status == "CLAIMED"
    second = second_certificate(database, ready, chain_nonce=0 if reason == "nonce" else 1)
    assert client.post("/approvals", json=body(second)).status_code == 200
    req = request(
        second, key="second-executor-key-002" if reason == "nonce" else "executor-test-key-0001"
    )
    with pytest.raises(DomainError) as e:
        gate().claim_execution(
            client.app.state.engine,
            req,
            "demo-user",
            policy=operational(second),
            recheck=lambda trusted: (second.payload.verdict, second.payload.simulation),
        )
    assert e.value.code == "CONFLICT" and counts(database) == 1
    with database[1]() as s:
        approval = s.scalar(
            select(ApprovalRecord).where(ApprovalRecord.certificate_id == second.payload.id)
        )
        assert approval.consumed_at is None


@pytest.mark.parametrize("kind", ["metrics", "stress", "missing_stress", "config", "paths"])
def test_recomputed_risk_must_match_signed_evidence(client, ready, database, kind):
    sim = ready.payload.simulation
    if kind == "metrics":
        sim = sim.model_copy(
            update={
                "metrics": sim.metrics.model_copy(
                    update={"goal_satisfaction_probability_bps": 9499}
                )
            }
        )
    elif kind == "stress":
        sim = sim.model_copy(
            update={
                "stress_results": [
                    sim.stress_results[0].model_copy(update={"passed": False}),
                    *sim.stress_results[1:],
                ]
            }
        )
    elif kind == "missing_stress":
        sim = sim.model_copy(update={"stress_results": sim.stress_results[1:]})
    elif kind == "config":
        sim = sim.model_copy(update={"config_digest": "f" * 64})
    else:
        sim = sim.model_copy(update={"sampled_liquidity_paths_minor": [[1, 2, 3]]})
    with pytest.raises(DomainError) as e:
        gate().claim_execution(
            client.app.state.engine,
            request(ready),
            "demo-user",
            policy=operational(ready),
            recheck=lambda trusted: (ready.payload.verdict, sim),
        )
    assert e.value.code == "POLICY_DENIED" and counts(database) == 0


def test_expiry_is_rechecked_after_risk_computation(client, ready, database, monkeypatch):
    from types import SimpleNamespace

    now = datetime.now(UTC)
    calls = 0

    def clock(_):
        nonlocal calls
        calls += 1
        return now if calls < 3 else ready.payload.expires_at

    monkeypatch.setattr(gate(), "datetime", SimpleNamespace(now=clock))
    with pytest.raises(DomainError) as e:
        claim(client, ready)
    assert e.value.code == "EXPIRED" and counts(database) == 0


def test_internal_recheck_failure_rolls_back_without_authority(client, ready, database):
    def unavailable(trusted):
        raise TimeoutError("sensitive-provider-details")

    with pytest.raises(DomainError) as e:
        gate().claim_execution(
            client.app.state.engine,
            request(ready),
            "demo-user",
            policy=operational(ready),
            recheck=unavailable,
        )
    assert e.value.code == "UNAVAILABLE" and "sensitive" not in e.value.message
    assert counts(database) == 0


def test_request_cannot_supply_transaction_or_risk_authority(client, ready, database):
    for extra in [
        {"transaction": ready.payload.transaction.model_dump()},
        {"recheck": "pass"},
        {"approval": True},
        {"state_version": 1},
    ]:
        result = client.post("/execute", json={**request(ready).model_dump(), **extra})
        assert result.status_code == 422
    client.cookies.clear()
    assert client.post("/execute", json=request(ready).model_dump()).status_code == 401
    assert counts(database) == 0


@pytest.mark.parametrize("kind", ["missing", "consumed", "actor", "digest"])
def test_missing_or_mismatched_approval_refuses_claim(client, ready, database, kind):
    with database[1].begin() as s:
        ap = s.scalar(select(ApprovalRecord))
        if kind == "missing":
            s.delete(ap)
        elif kind == "consumed":
            ap.consumed_at = datetime.now(UTC)
        elif kind == "actor":
            ap.payload = {**ap.payload, "actor_id": "other-user"}
        else:
            ap.payload = {**ap.payload, "action_digest": "f" * 64}
    with pytest.raises(DomainError) as e:
        claim(client, ready)
    assert e.value.code == "APPROVAL_REQUIRED" and counts(database) == 0


@pytest.mark.parametrize("kind", ["autonomy", "recipient"])
def test_signed_approval_flag_cannot_override_current_consent_rule(client, ready, database, kind):
    from app.models.contracts import ApprovalRequirement, ConstitutionVersion, PolicyVerdict

    with database[1].begin() as s:
        ap = s.scalar(select(ApprovalRecord))
        s.delete(ap)
        row = s.get(ConstitutionVersionRecord, ready.payload.constitution_version)
        policy = ConstitutionVersion.model_validate(row.payload)
        rules = policy.rules.model_copy(
            update={"autonomy_limit_minor": 0} if kind == "autonomy" else {"known_recipients": []}
        )
        policy = policy.model_copy(update={"rules": rules, "policy_digest": digest(rules)})
        row.policy_digest = policy.policy_digest
        row.payload = policy.model_dump(mode="json")
        verdict = PolicyVerdict(decision="PASS", checks=[])
        cert = sign_certificate(
            ready.payload.model_copy(
                update={
                    "policy_digest": policy.policy_digest,
                    "verdict": verdict,
                    "approval": ApprovalRequirement(required=False, reasons=[]),
                }
            ),
            keypair()[0],
            "test-key",
        )
        stored = s.get(CertificateRecord, cert.payload.id)
        stored.payload = cert.model_dump(mode="json")
        stored.certificate_hash = cert.certificate_hash
        vr = s.get(VerificationRecord, "verification-fixture")
        vr.payload = {**vr.payload, "verdict": verdict.model_dump(mode="json")}
    with pytest.raises(DomainError) as e:
        claim(client, cert)
    assert e.value.code == "APPROVAL_REQUIRED" and counts(database) == 0


def test_missing_certificate_and_keyring_never_claim(client, ready, database, monkeypatch):
    missing = request(ready).model_copy(update={"certificate_id": "absent"})
    with pytest.raises(DomainError) as e:
        gate().claim_execution(
            client.app.state.engine, missing, "demo-user", policy=operational(ready)
        )
    assert e.value.code == "INVALID_CERTIFICATE"
    monkeypatch.delenv("VERIFIER_PUBLIC_KEYS_JSON")
    with pytest.raises(DomainError) as e:
        claim(client, ready)
    assert e.value.code == "UNAVAILABLE" and counts(database) == 0


def test_corrupt_historical_certificate_cannot_free_wallet_nonce(client, ready, database):
    assert claim(client, ready).status == "CLAIMED"
    second = second_certificate(database, ready)
    assert client.post("/approvals", json=body(second)).status_code == 200
    with database[1].begin() as s:
        original = s.get(CertificateRecord, ready.payload.id)
        changed = ready.payload.model_copy(
            update={"transaction": ready.payload.transaction.model_copy(update={"nonce": 999})}
        )
        # Even an edited, recomputed digest cannot forge the old verifier signature.
        original.payload = ready.model_copy(
            update={"payload": changed, "certificate_hash": digest(changed)}
        ).model_dump(mode="json")
        original.certificate_hash = digest(changed)
    with pytest.raises(DomainError) as e:
        gate().claim_execution(
            client.app.state.engine,
            request(second, key="second-nonce-corruption-key"),
            "demo-user",
            policy=operational(second),
            recheck=lambda trusted: (second.payload.verdict, second.payload.simulation),
        )
    assert e.value.code == "UNAVAILABLE" and counts(database) == 1


def test_authentic_expired_history_keeps_nonce_reserved(client, ready, database, monkeypatch):
    from types import SimpleNamespace

    assert claim(client, ready).status == "CLAIMED"
    second = second_certificate(database, ready)
    second = sign_certificate(
        second.payload.model_copy(
            update={"expires_at": ready.payload.expires_at + timedelta(seconds=30)}
        ),
        keypair()[0],
        "test-key",
    )
    persist_signed(database, second)
    assert client.post("/approvals", json=body(second)).status_code == 200
    monkeypatch.setattr(gate(), "datetime", SimpleNamespace(now=lambda _: ready.payload.expires_at))
    with pytest.raises(DomainError) as e:
        gate().claim_execution(
            client.app.state.engine,
            request(second, key="expired-history-nonce-key"),
            "demo-user",
            policy=operational(second),
            recheck=lambda trusted: (second.payload.verdict, second.payload.simulation),
        )
    assert e.value.code == "CONFLICT" and counts(database) == 1
