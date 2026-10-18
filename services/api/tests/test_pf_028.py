"""Actual authenticated funded reset on temporary migrated databases only."""

import importlib.util
import sqlite3
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from app.core.auth import hash_password
from app.core.canonical import digest
from app.core.errors import DomainError
from app.core.settings import Settings
from app.db.models import AuditRecord, FinancialStateRecord, SimulationConfigRecord
from app.db.session import make_engine, sessions
from app.db.state import append_state, read_state
from app.demo import reset as service
from app.demo.provision import provision_funded_demo
from app.main import create_app
from app.models.contracts import SimulationConfig
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import select


@pytest.fixture
def funded(tmp_path, monkeypatch):
    url = f"sqlite:///{tmp_path / 'funded.db'}"
    monkeypatch.setenv("DATABASE_URL", url)
    command.upgrade(Config("alembic.ini"), "head")
    engine = make_engine(url)
    factory = sessions(engine)
    config = SimulationConfig(
        id="reset-isolated-selection", model_version="pf-monte-carlo-v1",
        path_count=100, daily_volatility_bps=0, income_delay_probability_bps=0,
        emergency_probability_bps=0, fee_minor=100,
        model_assumptions=["Synthetic isolated reset test; not approved runtime inputs."],
    )
    with factory.begin() as session:
        provision_funded_demo(session, config)
    settings = Settings(_env_file=None, database_url=url, demo_mode=True)
    yield engine, factory, settings
    engine.dispose()


@pytest.fixture
def funded_client(funded):
    settings = funded[2].model_copy(update={
        "demo_password_hash": SecretStr(hash_password("isolated-reset-password-only"))
    })
    app = create_app(settings)
    with TestClient(app) as client:
        client.headers["Origin"] = "http://127.0.0.1:3000"
        login = client.post("/auth/login", json={"password": "isolated-reset-password-only"})
        assert login.status_code == 200
        client.headers["X-CSRF-Token"] = login.json()["csrf_token"]
        yield client
    app.state.engine.dispose()


def capture(factory):
    with factory() as session:
        return (
            read_state(session),
            [(r.id, r.payload) for r in session.scalars(select(FinancialStateRecord).order_by(FinancialStateRecord.version))],
            [(r.id, r.payload) for r in session.scalars(select(AuditRecord).order_by(AuditRecord.sequence))],
        )


def test_authenticated_reset_restores_funded_selection_and_preserves_policy_history(
    funded, funded_client
):
    _, factory, _ = funded
    original = funded_client.get("/financial-state").json()
    draft = funded_client.get("/constitutions/drafts").json()[0]
    confirmed = funded_client.post("/constitutions/confirm", json={
        "draft_id": draft["id"], "expected_policy_digest": digest(draft["rules"]),
        "confirmed": True,
    })
    assert confirmed.status_code == 200
    policy_history = funded_client.get("/constitutions/history").json()
    # A realized debit is staged only in this isolated test's state repository.
    with factory.begin() as session:
        current = read_state(session)
        append_state(session, current.snapshot.model_copy(update={
            "version": 3, "realized_expense_minor": 200000,
            "assets": [current.snapshot.assets[0].model_copy(update={"amount_minor": 1500000})],
        }), 2)
    before = capture(factory)
    response = funded_client.post("/demo/reset")
    assert response.status_code == 200
    result = response.json()
    assert result["snapshot"] == {**original["snapshot"], "version": 4}
    assert result["active_constitution_version"] == confirmed.json()["id"]
    assert result["snapshot_hash"] != original["snapshot_hash"]
    assert funded_client.get("/constitutions/history").json() == policy_history
    after = capture(factory)
    assert after[1][:-1] == before[1] and after[2][:-1] == before[2]
    assert next(payload for id, payload in after[1] if id == "state-v1")["assets"][0]["amount_minor"] == 1200000
    event = after[2][-1][1]
    assert event["event_type"] == "DEMO_RESET" and event["artifact_digest"] == digest(result)
    assert event["previous_hash"] == before[2][-1][1]["event_hash"]
    assert event["details"]["funded_source_state_id"] == original["id"]
    # Repeated explicit resets restore the fixed selection, never add another $5k.
    again = funded_client.post("/demo/reset").json()
    assert again["snapshot"] == {**original["snapshot"], "version": 5}


@pytest.mark.parametrize("status", ["CLAIMED", "PENDING", "REORGED", "CONFIRMED", "FAILED"])
def test_any_execution_history_refuses_without_changing_any_state_or_audit(funded, status):
    engine, factory, settings = funded
    # Deliberately minimal isolated row: guard must refuse even incomplete history.
    with sqlite3.connect(settings.database_url.removeprefix("sqlite:///")) as connection:
        connection.execute(
            "INSERT INTO executions (id, created_at, certificate_id, idempotency_key, status,"
            "tx_hash, payload) VALUES ('guard', CURRENT_TIMESTAMP, 'guard-cert', 'guard-key',"
            "?, NULL, '{}')", (status,),
        )
    before = capture(factory)
    with pytest.raises(DomainError) as error:
        service.reset_demo(engine, settings)
    assert error.value.status == 409 and "Execution history" in error.value.message
    assert capture(factory) == before
    with sqlite3.connect(settings.database_url.removeprefix("sqlite:///")) as connection:
        assert connection.execute("SELECT status FROM executions").fetchall() == [(status,)]


def test_demo_mode_guard_is_in_service_and_route(funded, funded_client):
    engine, factory, settings = funded
    before = capture(factory)
    with pytest.raises(DomainError) as error:
        service.reset_demo(engine, settings.model_copy(update={"demo_mode": False}))
    assert error.value.status == 403
    funded_client.app.state.auth.settings.demo_mode = False
    assert funded_client.post("/demo/reset").status_code == 403
    assert capture(factory) == before


def test_existing_auth_origin_csrf_and_empty_body_contract(funded, funded_client):
    before = capture(funded[1])
    for body in [b"{}", b'{"confirmed":true}', b"null", b" "]:
        assert funded_client.post("/demo/reset", content=body).status_code == 422
    csrf = funded_client.headers.pop("X-CSRF-Token")
    assert funded_client.post("/demo/reset").status_code == 403
    funded_client.headers["X-CSRF-Token"] = csrf
    assert funded_client.post("/demo/reset", headers={"Origin": "https://attacker.example"}).status_code == 403
    funded_client.cookies.clear()
    assert funded_client.post("/demo/reset").status_code == 401
    assert capture(funded[1]) == before


def test_unfunded_baseline_refuses_instead_of_inventing_cash(client):
    before = client.get("/financial-state").json()
    events = client.get("/audit").json()
    assert client.post("/demo/reset").status_code == 409
    assert client.get("/financial-state").json() == before
    assert client.get("/audit").json() == events


@pytest.mark.parametrize("target", ["state", "config", "event"])
def test_tampered_provisioning_provenance_refuses_atomically(funded, target):
    engine, factory, settings = funded
    with factory.begin() as session:
        if target == "state":
            row = session.get(FinancialStateRecord, read_state(session).id)
            row.payload = {**row.payload, "realized_expense_minor": 1}
            row.snapshot_hash = digest(row.payload)
        elif target == "config":
            row = session.scalar(select(SimulationConfigRecord))
            row.payload = {**row.payload, "fee_minor": 101}
            row.config_digest = digest(row.payload)
        else:
            row = session.scalar(select(AuditRecord))
            row.payload = {**row.payload, "artifact_digest": "f" * 64}
    before = capture(factory)
    with pytest.raises(DomainError) as error:
        service.reset_demo(engine, settings)
    assert error.value.status == 503
    assert capture(factory) == before


def test_audit_write_failure_rolls_back_reset(funded, monkeypatch):
    engine, factory, settings = funded
    before = capture(factory)
    def fail(*args, **kwargs):
        raise ValueError("private backend failure must not escape")
    monkeypatch.setattr(service, "append_event", fail)
    with pytest.raises(DomainError) as error:
        service.reset_demo(engine, settings)
    assert error.value.status == 503 and "private" not in error.value.message
    assert capture(factory) == before


def cli_module():
    spec = importlib.util.spec_from_file_location("reset_cli", Path("scripts/reset_demo.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_cli_preview_never_opens_database_and_demo_off_refuses(monkeypatch):
    module = cli_module()
    def forbidden(*args):
        pytest.fail("Preview opened a database")
    monkeypatch.setattr(module, "make_engine", forbidden)
    monkeypatch.setenv("DEMO_MODE", "true")
    assert module.main([]) == 0
    monkeypatch.setenv("DEMO_MODE", "false")
    assert module.main(["--confirm"]) == 2


def test_cli_explicit_confirmation_uses_same_funded_service(funded, capsys):
    assert cli_module().main(["--confirm"]) == 0
    assert "Recorded funded snapshot appended as version 3" in capsys.readouterr().out
    with funded[1]() as session:
        assert read_state(session).snapshot.assets[0].amount_minor == 1700000
