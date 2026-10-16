"""PF-028 demo reset (scripts/reset_demo.py): append-only, guarded, audited."""

import importlib.util
import sqlite3
from pathlib import Path

import pytest
from app.core.canonical import digest
from app.core.errors import DomainError
from app.db.models import AuditRecord, FinancialStateRecord, UserHead
from app.db.seed import baseline
from app.db.session import make_engine
from app.db.state import append_state, read_state
from sqlalchemy import func, select

SCRIPT = Path(__file__).resolve().parents[3] / "scripts" / "reset_demo.py"
spec = importlib.util.spec_from_file_location("reset_demo", SCRIPT)
reset_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reset_module)


def change_state(factory):
    """A later state that differs from the baseline (stands in for an emergency or execution)."""
    with factory.begin() as session:
        current = read_state(session)
        changed = current.snapshot.model_copy(
            update={"version": current.snapshot.version + 1, "realized_expense_minor": 200000}
        )
        return append_state(session, changed, current.snapshot.version)


def test_reset_appends_the_baseline_as_a_new_version_and_keeps_history(database):
    url, factory = database
    changed = change_state(factory)
    engine = make_engine(url)
    try:
        result = reset_module.reset_demo(engine)
    finally:
        engine.dispose()
    assert result.snapshot.version == changed.snapshot.version + 1
    expected = baseline().model_copy(update={"version": result.snapshot.version})
    assert result.snapshot == expected
    assert result.snapshot_hash == digest(expected)
    with factory() as session:
        assert session.scalar(select(func.count()).select_from(FinancialStateRecord)) == 3
        assert session.get(FinancialStateRecord, changed.id) is not None  # nothing deleted
        assert read_state(session).id == result.id


def test_reset_keeps_the_active_constitution_and_records_an_audit_event(database):
    url, factory = database
    with factory() as session:
        before_head = session.get(UserHead, "demo-user").constitution_id
        before_events = session.scalar(select(func.count()).select_from(AuditRecord))
    engine = make_engine(url)
    try:
        result = reset_module.reset_demo(engine)
    finally:
        engine.dispose()
    with factory() as session:
        assert session.get(UserHead, "demo-user").constitution_id == before_head
        events = list(session.scalars(select(AuditRecord).order_by(AuditRecord.sequence)))
        assert len(events) == before_events + 1
        last = events[-1].payload
        assert last["event_type"] == "DEMO_RESET"
        assert last["details"]["to_state_version"] == result.snapshot.version
        assert last["artifact_digest"] == digest(result.snapshot)


@pytest.mark.parametrize("status", ["CLAIMED", "PENDING"])
def test_reset_is_refused_while_an_execution_is_unsettled(database, status):
    url, factory = database
    # Stand-in execution row inserted directly (foreign keys off on this raw connection) only to exercise
    # the guard; building a fully signed certificate here would not change what the guard checks.
    path = url.removeprefix("sqlite:///")
    raw = sqlite3.connect(path)
    raw.execute(
        "INSERT INTO executions (id, created_at, certificate_id, idempotency_key, status, tx_hash,"
        " payload) VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, NULL, '{}')",
        ("exec-guard", "cert-guard", "guard-idempotency-key", status),
    )
    raw.commit()
    raw.close()
    with factory() as session:
        before = read_state(session).snapshot.version
    engine = make_engine(url)
    try:
        with pytest.raises(DomainError) as error:
            reset_module.reset_demo(engine)
    finally:
        engine.dispose()
    assert error.value.status == 409 and "pending" in error.value.message
    with factory() as session:
        assert read_state(session).snapshot.version == before  # nothing was written


def test_reset_command_refuses_outside_demo_mode(database, monkeypatch, capsys):
    monkeypatch.setenv("DEMO_MODE", "false")
    assert reset_module.main() == 2
    assert "DEMO_MODE is not true" in capsys.readouterr().err


def test_reset_command_succeeds_in_demo_mode(database, monkeypatch, capsys):
    monkeypatch.setenv("DEMO_MODE", "true")
    assert reset_module.main() == 0
    assert "reset to the seeded baseline" in capsys.readouterr().out
