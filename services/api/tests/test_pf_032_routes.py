"""Actual emergency/optimizer integration with isolated chain bounds only."""

from concurrent.futures import ThreadPoolExecutor

import pytest
import test_pf_029
from app.db.state import read_state
from app.demo import emergency
from test_pf_007 import evidence as evidence
from test_pf_009 import configured as configured
from test_pf_009 import trusted as trusted
from test_pf_010 import bounds as bounds
from test_pf_029 import action as action
from test_pf_029 import rpc as rpc

issuance_configured = test_pf_029.configured


@pytest.fixture(autouse=True)
def operational_settings(monkeypatch):
    for name, value in {
        "RPC_URL": "http://isolated.invalid",
        "WALLET_ADDRESS": "0x" + "3" * 40,
        "TEST_TOKEN_ADDRESS": "0x" + "1" * 40,
        "APPROVED_RECIPIENT": "0x" + "2" * 40,
        "OPTIMIZER_GAS_LIMIT": "100000",
        "OPTIMIZER_MAX_FEE_PER_GAS_WEI": "100",
    }.items():
        monkeypatch.setenv(name, value)


@pytest.fixture
def ready(configured, bounds, monkeypatch):
    monkeypatch.setattr(emergency, "load_chain_bounds", lambda _: bounds)


def test_real_outflow_reprices_and_preserves_history(client, database, ready):
    before = client.get("/financial-state").json()
    response = client.post("/demo/emergency", json={"expected_state_version": 1})
    assert response.status_code == 200
    result = response.json()
    assert result["state"]["snapshot"]["version"] == 2
    assert result["state"]["snapshot"]["realized_expense_minor"] == 200000
    assert (
        before["snapshot"]["assets"][0]["amount_minor"]
        - result["state"]["snapshot"]["assets"][0]["amount_minor"]
        == 200000
    )
    assert result["optimization"]["status"] == "NO_SAFE_ACTION"
    from app.db.models import FinancialStateRecord

    with database[1]() as session:
        assert session.get(FinancialStateRecord, before["id"]).payload == before["snapshot"]
    events = client.get("/audit").json()
    event = next(e for e in events if e["event_type"] == "EMERGENCY_EXPENSE_RECORDED")
    assert event["details"]["state_id"] == result["state"]["id"]
    assert event["details"]["amount_minor"] == 200000
    assert client.post("/demo/emergency", json={"expected_state_version": 1}).status_code == 409


def test_concurrent_emergencies_debit_only_once(client, database, ready):
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(
            pool.map(
                lambda _: client.post("/demo/emergency", json={"expected_state_version": 1}),
                range(2),
            )
        )
    assert sorted(r.status_code for r in responses) == [200, 409]
    with database[1]() as session:
        assert read_state(session).snapshot.version == 2


def test_dependency_failure_rolls_back_expense(client, database, ready, monkeypatch):
    def fail(_):
        raise ValueError("private RPC contents")

    monkeypatch.setattr(emergency, "load_chain_bounds", fail)
    response = client.post("/demo/emergency", json={"expected_state_version": 1})
    assert response.status_code == 503 and "private" not in response.text
    with database[1]() as session:
        assert read_state(session).snapshot.version == 1


@pytest.mark.parametrize(
    "body",
    [
        {"expected_state_version": True},
        {"expected_state_version": 1, "amount_minor": 1},
        {"expected_state_version": 0},
    ],
)
def test_invalid_emergency_rejected(client, body):
    assert client.post("/demo/emergency", json=body).status_code == 422


def test_disabled_demo_cannot_change_state(client, ready):
    client.app.state.auth.settings.demo_mode = False
    assert client.post("/demo/emergency", json={"expected_state_version": 1}).status_code == 403


def test_real_certificate_becomes_stale_without_deleting_history(
    client, database, issuance_configured, rpc, action, bounds, monkeypatch
):
    monkeypatch.setattr(emergency, "load_chain_bounds", lambda _: bounds)
    response = client.post("/verify", json={"action": action})
    assert response.status_code == 200
    cert_id = response.json()["certificate_id"]
    assert cert_id
    old = client.get("/certificates/" + cert_id).json()
    result = client.post("/demo/emergency", json={"expected_state_version": 2})
    assert result.status_code == 200
    assert client.get("/certificates/" + cert_id).json() == old
    assert (
        client.post("/certificates/" + cert_id + "/verify").json()["status"] == "SIGNED_BUT_STALE"
    )
    from app.core.errors import DomainError
    from app.execution.gate import claim_execution
    from app.execution.signer import TestnetPolicy
    from app.models.contracts import ErrorCode, ExecuteRequest
    from app.verifier.service import recompute

    with pytest.raises(DomainError) as exc:
        claim_execution(
            client.app.state.engine,
            ExecuteRequest(
                certificate_id=cert_id,
                action_digest=old["payload"]["action_digest"],
                idempotency_key="stale-after-emergency",
            ),
            "demo-user",
            policy=TestnetPolicy(
                wallet_address="0x" + "3" * 40,
                token_address=action["token_address"],
                recipient=action["recipient"],
                token_decimals=6,
                max_gas_limit=100000,
                max_fee_per_gas_wei="100",
            ),
            recheck=recompute,
        )
    assert exc.value.code == ErrorCode.STALE_STATE


def update_cash(database, amounts, *, realized=0):
    from app.db.state import append_state

    with database[1].begin() as session:
        state = read_state(session)
        asset = state.snapshot.assets[0]
        assets = [
            asset.model_copy(update={"id": "cash-" + str(i), "amount_minor": amount})
            for i, amount in enumerate(amounts)
        ]
        snapshot = state.snapshot.model_copy(
            update={
                "version": state.snapshot.version + 1,
                "assets": assets,
                "realized_expense_minor": realized,
            }
        )
        return append_state(session, snapshot, state.snapshot.version)


@pytest.mark.parametrize("cash,status", [(199999, 409), (200000, 200)])
def test_exact_expense_cash_boundary(client, database, ready, cash, status):
    state = update_cash(database, [cash])
    response = client.post("/demo/emergency", json={"expected_state_version": 2})
    assert response.status_code == status
    after = client.get("/financial-state").json()
    assert after["snapshot"]["assets"][0]["amount_minor"] == (0 if status == 200 else cash)
    assert after["snapshot"]["version"] == (3 if status == 200 else 2)
    if status != 200:
        assert after["id"] == state.id


def test_multiple_balances_and_past_expense_are_not_double_deducted(client, database, ready):
    state = update_cash(database, [50000, 300000], realized=100000)
    response = client.post("/demo/emergency", json={"expected_state_version": 2})
    assert response.status_code == 200
    fresh = response.json()["state"]["snapshot"]
    assert [a["amount_minor"] for a in fresh["assets"]] == [0, 150000]
    assert fresh["realized_expense_minor"] == 300000
    assert fresh["as_of"] == state.snapshot.model_dump(mode="json")["as_of"]
    assert fresh["obligations"] == state.snapshot.model_dump(mode="json")["obligations"]


@pytest.mark.parametrize("flags", [{"liquid": False}, {"high_risk": True}])
def test_illiquid_or_risky_assets_cannot_pay_expense(client, database, ready, flags):
    from app.db.state import append_state

    with database[1].begin() as session:
        state = read_state(session)
        asset = state.snapshot.assets[0].model_copy(update=flags)
        append_state(
            session, state.snapshot.model_copy(update={"version": 2, "assets": [asset]}), 1
        )
    response = client.post("/demo/emergency", json={"expected_state_version": 2})
    assert response.status_code == 409
    assert client.get("/financial-state").json()["snapshot"]["realized_expense_minor"] == 0


def test_repeated_emergencies_debit_each_real_event_once(client, database, ready):
    for version in [1, 2]:
        assert (
            client.post("/demo/emergency", json={"expected_state_version": version}).status_code
            == 200
        )
    snapshot = client.get("/financial-state").json()["snapshot"]
    assert snapshot["assets"][0]["amount_minor"] == 800000
    assert snapshot["realized_expense_minor"] == 400000
    events = client.get("/audit").json()
    assert sum(e["event_type"] == "EMERGENCY_EXPENSE_RECORDED" for e in events) == 2


def test_configured_asset_and_destination_can_be_second_in_policy(client, database, ready, trusted):
    from app.core.canonical import digest

    rules = trusted.constitution.rules.model_copy(
        update={
            "allowed_tokens": ["0x" + "4" * 40, trusted.action.token_address],
            "known_recipients": ["0x" + "5" * 40, trusted.action.recipient],
        }
    )
    active = client.get("/financial-state").json()["active_constitution_version"]
    draft = client.post(
        "/constitutions/drafts",
        json={"rules": rules.model_dump(mode="json"), "base_version": active},
    ).json()
    assert (
        client.post(
            "/constitutions/confirm",
            json={
                "draft_id": draft["id"],
                "expected_policy_digest": digest(rules),
                "confirmed": True,
            },
        ).status_code
        == 200
    )
    # The integration below observes the exact candidate; chain RPC refusal is covered separately.
    observed = []
    from unittest.mock import patch

    from app.optimizer.service import ChainBounds

    def bounds_for(action):
        observed.append(action)
        assert action.token_address == trusted.action.token_address
        assert action.recipient == trusted.action.recipient
        return ChainBounds(2000000, 10000000, 100000, 10)

    with patch.object(emergency, "load_chain_bounds", bounds_for):
        response = client.post("/demo/emergency", json={"expected_state_version": 1})
    assert response.status_code == 200 and len(observed) == 1


@pytest.mark.parametrize(
    "name,value", [("TEST_TOKEN_ADDRESS", "0x" + "9" * 40), ("APPROVED_RECIPIENT", "0x" + "9" * 40)]
)
def test_policy_disallows_configured_destination_without_any_debit(
    client, ready, monkeypatch, name, value
):
    monkeypatch.setenv(name, value)
    if name == "APPROVED_RECIPIENT":
        # Unknown recipients require approval; only an explicitly blocked one is
        # forbidden. Keep the original no-debit assertion for genuine denial.
        from test_pf_041 import confirm_rules

        confirm_rules(client, blocked_recipients=[value])
    before = client.get("/financial-state").json()
    assert client.post("/demo/emergency", json={"expected_state_version": 1}).status_code == 403
    assert client.get("/financial-state").json() == before


def test_missing_operational_settings_rolls_back(client, ready, monkeypatch):
    monkeypatch.delenv("APPROVED_RECIPIENT")
    # Ignore the private local dotenv so the test exercises truly absent configuration.
    settings = emergency.ChainSettings
    monkeypatch.setattr(emergency, "ChainSettings", lambda: settings(_env_file=None))
    before = client.get("/financial-state").json()
    response = client.post("/demo/emergency", json={"expected_state_version": 1})
    assert response.status_code == 503
    assert client.get("/financial-state").json() == before


def test_emergency_between_claim_and_signing_never_calls_signer(
    client, database, issuance_configured, rpc, action, bounds, monkeypatch
):
    from app.core.errors import DomainError
    from app.db.models import ExecutionEnvelopeRecord, ExecutionRecord
    from app.execution import gate
    from app.execution.signer import LocalTestnetSigner, TestnetPolicy
    from app.models.contracts import ErrorCode, ExecuteRequest
    from sqlalchemy import func, select

    monkeypatch.setattr(emergency, "load_chain_bounds", lambda _: bounds)
    response = client.post("/verify", json={"action": action})
    assert response.status_code == 200
    certificate_id = response.json()["certificate_id"]
    certificate = client.get("/certificates/" + certificate_id).json()
    transaction = certificate["payload"]["transaction"]
    policy = TestnetPolicy(
        wallet_address=transaction["sender"],
        token_address=transaction["token_address"],
        recipient=transaction["recipient"],
        token_decimals=transaction["token_decimals"],
        max_gas_limit=transaction["gas_limit"],
        max_fee_per_gas_wei=transaction["max_fee_per_gas_wei"],
    )
    request = ExecuteRequest(
        certificate_id=certificate_id,
        action_digest=certificate["payload"]["action_digest"],
        idempotency_key="emergency-between-claim-and-sign",
    )
    real_claim = gate.claim_execution
    claims = []
    signer_calls = []

    def emergency_after_claim(*args, **kwargs):
        claim = real_claim(*args, **kwargs)
        claims.append(claim)
        result = client.post(
            "/demo/emergency",
            json={"expected_state_version": certificate["payload"]["state_version"]},
        )
        assert result.status_code == 200
        return claim

    def unexpected_sign(self, transaction):
        signer_calls.append(transaction)
        raise AssertionError("Stale authorization reached signer")

    monkeypatch.setattr(gate, "claim_execution", emergency_after_claim)
    monkeypatch.setattr(LocalTestnetSigner, "sign", unexpected_sign)
    with pytest.raises(DomainError) as error:
        gate.sign_authorized_once(client.app.state.engine, request, "demo-user", policy=policy)
    assert error.value.code == ErrorCode.STALE_STATE
    assert len(claims) == 1 and signer_calls == []
    with database[1]() as session:
        claim = session.get(ExecutionRecord, claims[0].id)
        assert claim.status == "CLAIMED" and claim.tx_hash is None
        assert session.scalar(select(func.count()).select_from(ExecutionEnvelopeRecord)) == 0
    assert client.get("/certificates/" + certificate_id).json() == certificate
    events = client.get("/audit").json()
    assert any(e["event_type"] == "EXECUTION_CLAIMED" for e in events)
    assert any(e["event_type"] == "EMERGENCY_EXPENSE_RECORDED" for e in events)
    assert not any(e["event_type"] == "EXECUTION_SIGNED" for e in events)


@pytest.mark.parametrize("mode,status", [("csrf", 403), ("session", 401)])
def test_emergency_requires_authenticated_csrf_boundary(client, ready, mode, status):
    before = client.get("/financial-state").json()
    if mode == "csrf":
        response = client.post(
            "/demo/emergency",
            json={"expected_state_version": 1},
            headers={"X-CSRF-Token": "forged"},
        )
        assert client.get("/financial-state").json() == before
    else:
        client.cookies.clear()
        response = client.post("/demo/emergency", json={"expected_state_version": 1})
    assert response.status_code == status


def test_audit_append_failure_rolls_back_expense_and_repricing(client, ready, monkeypatch):
    before = client.get("/financial-state").json()
    audit = client.get("/audit").json()

    def fail(*args, **kwargs):
        raise RuntimeError("private storage details")

    monkeypatch.setattr(emergency, "append_event", fail)
    response = client.post("/demo/emergency", json={"expected_state_version": 1})
    assert response.status_code == 503 and "private" not in response.text
    assert client.get("/financial-state").json() == before
    assert client.get("/audit").json() == audit
