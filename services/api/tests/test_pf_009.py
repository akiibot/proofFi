"""Real simulation arithmetic; assumptions exist only in isolated fixtures."""

import importlib

import pytest
from app.simulation.stress import project_ledger
from test_pf_007 import evidence as evidence


@pytest.fixture
def trusted(evidence):
    value, _ = evidence
    return value.model_copy(
        update={
            "config": value.config.model_copy(
                update={
                    "model_version": "pf-monte-carlo-v1",
                    "path_count": 100,
                }
            )
        }
    )


def simulate(value):
    return importlib.import_module("app.simulation.engine").simulate(value)


def test_zero_randomness_matches_deterministic_ledger(trusted):
    result = simulate(trusted)
    projection = project_ledger(trusted)
    assert result.metrics.goal_satisfaction_probability_bps == 10000
    assert result.metrics.reserve_breach_probability_bps == 10000
    assert result.metrics.p05_terminal_liquidity_minor == projection.liquidity_path_minor[-1]
    assert result.metrics.expected_terminal_value_minor == projection.terminal_value_minor
    assert result.sampled_liquidity_paths_minor == [list(projection.liquidity_path_minor)] * 20
    assert len(result.stress_results) == 4


def test_reproducible_samples_and_common_random_numbers(trusted):
    value = trusted.model_copy(
        update={
            "config": trusted.config.model_copy(
                update={
                    "daily_volatility_bps": 100,
                    "emergency_probability_bps": 5000,
                }
            )
        }
    )
    first = simulate(value)
    assert first.model_dump(exclude={"id", "created_at"}) == simulate(value).model_dump(
        exclude={"id", "created_at"}
    )
    other = value.model_copy(
        update={"action": value.action.model_copy(update={"id": "other", "amount_minor": 10001})}
    )
    second = simulate(other)
    assert all(
        a - b == 1
        for p, q in zip(first.sampled_liquidity_paths_minor, second.sampled_liquidity_paths_minor)
        for a, b in zip(p, q)
    )


@pytest.mark.parametrize(
    "updates", [{"model_version": "unknown"}, {"path_count": 100000, "horizon_days": 366}]
)
def test_unsupported_model_or_workload_refuses(trusted, updates):
    with pytest.raises(ValueError):
        simulate(trusted.model_copy(update={"config": trusted.config.model_copy(update=updates)}))


def test_certain_emergency_reduces_terminal_cash_once(trusted):
    value = trusted.model_copy(
        update={"config": trusted.config.model_copy(update={"emergency_probability_bps": 10000})}
    )
    result = simulate(value)
    normal = simulate(trusted)
    assert (
        result.metrics.p05_terminal_liquidity_minor
        == normal.metrics.p05_terminal_liquidity_minor - 200000
    )
    assert result.metrics.goal_satisfaction_probability_bps == 0


@pytest.fixture
def configured(client, database, trusted):
    from app.core.canonical import digest
    from app.db.models import SimulationConfigRecord

    draft = client.post(
        "/constitutions/drafts",
        json={"rules": trusted.constitution.rules.model_dump(mode="json"), "base_version": None},
    ).json()
    assert (
        client.post(
            "/constitutions/confirm",
            json={
                "draft_id": draft["id"],
                "expected_policy_digest": digest(draft["rules"]),
                "confirmed": True,
            },
        ).status_code
        == 200
    )
    with database[1].begin() as session:
        session.add(
            SimulationConfigRecord(
                id=trusted.config.id,
                config_digest=digest(trusted.config),
                payload=trusted.config.model_dump(mode="json"),
            )
        )
    return trusted.action.model_dump(mode="json")


def test_api_refuses_unconfigured_authority(client, trusted):
    response = client.post("/simulate", json={"action": trusted.action.model_dump(mode="json")})
    assert response.status_code == 503
    assert response.json()["code"] == "UNAVAILABLE"


def test_api_persists_and_replays_original_evidence(client, database, configured):
    from app.db.models import SimulationRecord
    from sqlalchemy import func, select

    first = client.post("/simulate", json={"action": configured})
    assert first.status_code == 200
    assert client.post("/simulate", json={"action": configured}).json() == first.json()
    assert (
        client.post("/simulate", json={"action": {**configured, "amount_minor": 10001}}).status_code
        == 409
    )
    with database[1]() as session:
        assert session.scalar(select(func.count()).select_from(SimulationRecord)) == 1
    events = client.get("/audit").json()
    assert sum(e["event_type"] == "SIMULATION_COMPLETED" for e in events) == 1


def test_api_rejects_public_authority_and_missing_session(client, configured):
    assert client.post("/simulate", json={"action": configured, "config": {}}).status_code == 422
    assert (
        client.post(
            "/simulate", json={"action": configured}, headers={"X-CSRF-Token": "bad"}
        ).status_code
        == 403
    )
    client.cookies.clear()
    assert client.post("/simulate", json={"action": configured}).status_code == 401


@pytest.mark.parametrize(
    "corruption", ["config", "multiple", "simulation", "timestamp", "candidate", "audit"]
)
def test_corrupt_or_ambiguous_authority_refuses_without_partial_writes(
    client, database, configured, corruption
):
    from app.db.models import AuditRecord, CandidateRecord, SimulationConfigRecord, SimulationRecord
    from sqlalchemy import func, select

    if corruption in {"simulation", "timestamp", "candidate"}:
        assert client.post("/simulate", json={"action": configured}).status_code == 200
    with database[1].begin() as session:
        if corruption == "config":
            session.scalar(select(SimulationConfigRecord)).config_digest = "f" * 64
        elif corruption == "multiple":
            row = session.scalar(select(SimulationConfigRecord))
            session.add(
                SimulationConfigRecord(id="second", config_digest="f" * 64, payload=row.payload)
            )
        elif corruption == "simulation":
            row = session.scalar(select(SimulationRecord))
            row.payload = {**row.payload, "state_snapshot_hash": "f" * 64}
        elif corruption == "timestamp":
            row = session.scalar(select(SimulationRecord))
            row.payload = {**row.payload, "created_at": "2000-01-01T00:00:00Z"}
        elif corruption == "candidate":
            session.get(CandidateRecord, configured["id"]).action_digest = "f" * 64
        else:
            session.scalar(select(AuditRecord).order_by(AuditRecord.sequence.desc())).event_hash = (
                "f" * 64
            )
    result = client.post("/simulate", json={"action": configured})
    assert result.status_code == (409 if corruption == "candidate" else 503)
    with database[1]() as session:
        assert session.scalar(select(func.count()).select_from(SimulationRecord)) == (
            1 if corruption in {"simulation", "timestamp", "candidate"} else 0
        )
        assert session.scalar(select(func.count()).select_from(CandidateRecord)) == (
            1 if corruption in {"simulation", "timestamp", "candidate"} else 0
        )


def test_duplicate_concurrent_requests_persist_one_result(client, database, configured):
    from concurrent.futures import ThreadPoolExecutor

    from app.db.models import SimulationRecord
    from sqlalchemy import func, select

    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(
            pool.map(lambda _: client.post("/simulate", json={"action": configured}), range(2))
        )
    assert all(response.status_code == 200 for response in responses)
    assert responses[0].json() == responses[1].json()
    with database[1]() as session:
        assert session.scalar(select(func.count()).select_from(SimulationRecord)) == 1


def test_policy_change_creates_distinct_simulation(client, configured, trusted):
    from app.core.canonical import digest

    first = client.post("/simulate", json={"action": configured}).json()
    active = client.get("/financial-state").json()["active_constitution_version"]
    rules = trusted.constitution.rules.model_copy(update={"emergency_floor_minor": 200001})
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
    second = client.post("/simulate", json={"action": configured})
    assert second.status_code == 200
    assert first["id"] != second.json()["id"]


def test_certain_income_delay_beyond_horizon_and_early_breach(trusted):
    from app.core.canonical import digest
    from app.models.contracts import ExpectedIncome

    income = ExpectedIncome(id="income", name="isolated", amount_minor=300000, due_day=120)
    snapshot = trusted.state.snapshot.model_copy(update={"expected_income": [income]})
    value = trusted.model_copy(
        update={
            "state": trusted.state.model_copy(
                update={"snapshot": snapshot, "snapshot_hash": digest(snapshot)}
            )
        }
    )
    normal = simulate(value)
    delayed = simulate(
        value.model_copy(
            update={
                "config": value.config.model_copy(update={"income_delay_probability_bps": 10000})
            }
        )
    )
    assert (
        normal.metrics.p05_terminal_liquidity_minor - delayed.metrics.p05_terminal_liquidity_minor
        == 300000
    )
    # Lower starting cash breaches protection before later income recovers it.
    assets = [snapshot.assets[0].model_copy(update={"amount_minor": 850000})]
    snapshot = snapshot.model_copy(update={"assets": assets})
    value = value.model_copy(
        update={
            "state": value.state.model_copy(
                update={"snapshot": snapshot, "snapshot_hash": digest(snapshot)}
            )
        }
    )
    assert simulate(value).metrics.reserve_breach_probability_bps == 10000


@pytest.mark.parametrize("corruption", ["hash", "duplicates", "overflow"])
def test_engine_corruption_and_overflow_refuse(trusted, corruption):
    from app.core.canonical import digest

    if corruption == "hash":
        value = trusted.model_copy(
            update={"state": trusted.state.model_copy(update={"snapshot_hash": "f" * 64})}
        )
    else:
        assets = trusted.state.snapshot.assets
        if corruption == "duplicates":
            assets = assets + assets
        else:
            assets = [
                assets[0].model_copy(update={"amount_minor": 9_000_000_000_000, "high_risk": True})
            ]
        snapshot = trusted.state.snapshot.model_copy(update={"assets": assets})
        value = trusted.model_copy(
            update={
                "state": trusted.state.model_copy(
                    update={"snapshot": snapshot, "snapshot_hash": digest(snapshot)}
                )
            }
        )
    with pytest.raises(ValueError):
        simulate(value)


def test_ledger_work_limit_refuses_before_random_allocation(trusted, monkeypatch):
    import numpy as np

    def allocation_forbidden(*args, **kwargs):
        raise AssertionError("Random allocation occurred before workload refusal")

    monkeypatch.setattr(np.random, "PCG64", allocation_forbidden)
    value = trusted.model_copy(
        update={"config": trusted.config.model_copy(update={"path_count": 60000})}
    )
    with pytest.raises(ValueError, match="ledger workload"):
        simulate(value)


def test_market_draws_are_common_across_action_ids(trusted):
    value = trusted.model_copy(
        update={"config": trusted.config.model_copy(update={"daily_volatility_bps": 100})}
    )
    changed = value.model_copy(
        update={"action": value.action.model_copy(update={"id": "another-id"})}
    )
    assert simulate(value).metrics == simulate(changed).metrics


def test_replay_refuses_corrupt_audit_chain(client, configured, database):
    from app.db.models import AuditRecord
    from sqlalchemy import select

    assert client.post("/simulate", json={"action": configured}).status_code == 200
    with database[1].begin() as session:
        session.scalar(select(AuditRecord)).event_hash = "f" * 64
    assert client.post("/simulate", json={"action": configured}).status_code == 503
