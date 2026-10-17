"""PF-032 service tests without shared router activation; real DB/risk engines."""

import pytest
from app.core.errors import DomainError
from app.db.state import append_state, read_state
from app.demo import emergency
from app.models.contracts import EmergencyRequest, ErrorCode
from test_pf_007 import evidence as evidence
from test_pf_009 import configured as configured
from test_pf_009 import trusted as trusted
from test_pf_010 import bounds as bounds


@pytest.fixture
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
def ready(configured, operational_settings, bounds, monkeypatch):
    monkeypatch.setattr(emergency, "load_chain_bounds", lambda _: bounds)


def record(client, version):
    return emergency.record_emergency(
        client.app.state.engine, EmergencyRequest(expected_state_version=version), "demo-user"
    )


def test_baseline_expense_and_repeat_preserve_clock_and_history(client, database, ready):
    before = client.get("/financial-state").json()
    first = record(client, 1)
    second = record(client, 2)
    assert first.optimization.status == second.optimization.status == "NO_SAFE_ACTION"
    snapshot = second.state.snapshot
    assert snapshot.version == 3 and snapshot.realized_expense_minor == 400000
    assert sum(a.amount_minor for a in snapshot.assets) == 800000
    assert snapshot.model_dump(mode="json")["as_of"] == before["snapshot"]["as_of"]
    assert snapshot.model_dump(mode="json")["obligations"] == before["snapshot"]["obligations"]
    assert (
        snapshot.model_dump(mode="json")["expected_income"] == before["snapshot"]["expected_income"]
    )
    from app.db.models import FinancialStateRecord

    with database[1]() as session:
        assert session.get(FinancialStateRecord, before["id"]).payload == before["snapshot"]
    events = client.get("/audit").json()
    expenses = [e for e in events if e["event_type"] == "EMERGENCY_EXPENSE_RECORDED"]
    assert len(expenses) == 2
    assert expenses[-1]["details"]["state_id"] == second.state.id
    with pytest.raises(DomainError) as stale:
        record(client, 1)
    assert stale.value.code == ErrorCode.CONFLICT


@pytest.mark.parametrize(
    "amounts,realized,expected",
    [([199999], 0, None), ([200000], 0, [0]), ([50000, 300000], 100000, [0, 150000])],
)
def test_spendable_cash_boundaries(client, database, ready, amounts, realized, expected):
    with database[1].begin() as session:
        old = read_state(session)
        asset = old.snapshot.assets[0]
        assets = [
            asset.model_copy(update={"id": f"cash-{i}", "amount_minor": amount})
            for i, amount in enumerate(amounts)
        ]
        append_state(
            session,
            old.snapshot.model_copy(
                update={"version": 2, "assets": assets, "realized_expense_minor": realized}
            ),
            1,
        )
    before = client.get("/financial-state").json()
    if expected is None:
        with pytest.raises(DomainError) as denied:
            record(client, 2)
        assert denied.value.code == ErrorCode.POLICY_DENIED
        assert client.get("/financial-state").json() == before
    else:
        result = record(client, 2)
        assert [a.amount_minor for a in result.state.snapshot.assets] == expected
        assert result.state.snapshot.realized_expense_minor == realized + 200000


@pytest.mark.parametrize("flags", [{"liquid": False}, {"high_risk": True}])
def test_risky_or_illiquid_assets_are_not_spent(client, database, ready, flags):
    with database[1].begin() as session:
        old = read_state(session)
        asset = old.snapshot.assets[0].model_copy(update=flags)
        append_state(session, old.snapshot.model_copy(update={"version": 2, "assets": [asset]}), 1)
    before = client.get("/financial-state").json()
    with pytest.raises(DomainError) as denied:
        record(client, 2)
    assert denied.value.code == ErrorCode.POLICY_DENIED
    assert client.get("/financial-state").json() == before


def test_recalculation_failure_rolls_back_state_and_audit(client, ready, monkeypatch):
    before = client.get("/financial-state").json()
    audit = client.get("/audit").json()

    def fail(_):
        raise ValueError("private RPC details")

    monkeypatch.setattr(emergency, "load_chain_bounds", fail)
    with pytest.raises(DomainError) as unavailable:
        record(client, 1)
    assert unavailable.value.code == ErrorCode.UNAVAILABLE
    assert "private" not in unavailable.value.message
    assert client.get("/financial-state").json() == before
    assert client.get("/audit").json() == audit


@pytest.mark.parametrize("name", ["TEST_TOKEN_ADDRESS", "APPROVED_RECIPIENT"])
def test_operational_policy_mismatch_cannot_debit(client, ready, monkeypatch, name):
    monkeypatch.setenv(name, "0x" + "9" * 40)
    before = client.get("/financial-state").json()
    with pytest.raises(DomainError) as denied:
        record(client, 1)
    assert denied.value.code == ErrorCode.POLICY_DENIED
    assert client.get("/financial-state").json() == before


def test_service_does_not_activate_shared_route(client, ready):
    assert client.post("/demo/emergency", json={"expected_state_version": 1}).status_code == 501


def test_concurrent_emergencies_at_same_version_commit_one_outflow(client, database, ready):
    from concurrent.futures import ThreadPoolExecutor

    from app.db.models import AuditRecord
    from sqlalchemy import select

    before = client.get("/financial-state").json()

    def attempt(_):
        try:
            return record(client, before["snapshot"]["version"]).state.snapshot.version
        except DomainError as error:
            return error.code.value

    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(attempt, range(2)))
    assert outcomes.count(before["snapshot"]["version"] + 1) == 1
    assert outcomes.count("CONFLICT") == 1
    after = client.get("/financial-state").json()
    assert after["snapshot"]["realized_expense_minor"] == 200000
    assert sum(a["amount_minor"] for a in after["snapshot"]["assets"]) == 1000000
    with database[1]() as session:
        events = [row.payload for row in session.scalars(select(AuditRecord))]
    assert sum(event["event_type"] == "EMERGENCY_EXPENSE_RECORDED" for event in events) == 1
