import pytest
from app.core.canonical import digest
from app.db.models import FinancialStateRecord, SimulationConfigRecord
from app.db.state import read_state
from app.demo.provision import provision_funded_demo
from app.models.contracts import SimulationConfig
from sqlalchemy import select


@pytest.fixture
def selected():
    return SimulationConfig(
        id="isolated-test-selection", model_version="pf-monte-carlo-v1",
        daily_volatility_bps=100, income_delay_probability_bps=0,
        emergency_probability_bps=2000, fee_minor=100,
        model_assumptions=["Synthetic isolated test inputs; not operator acceptance."],
    )


def test_existing_database_refuses_and_preserves_state(database, selected):
    _, factory = database
    with factory.begin() as session:
        before = read_state(session)
        with pytest.raises(ValueError, match="new empty"):
            provision_funded_demo(session, selected)
        assert read_state(session) == before
        assert not list(session.scalars(select(SimulationConfigRecord)))


def test_new_database_preserves_baseline_and_requires_policy_confirmation(tmp_path, selected):
    from app.db.models import Base
    from app.db.session import make_engine, sessions
    engine = make_engine(f"sqlite:///{tmp_path / 'fresh.db'}")
    Base.metadata.create_all(engine)
    try:
        with sessions(engine).begin() as session:
            funded = provision_funded_demo(session, selected)
            assert funded.snapshot.assets[0].amount_minor == 1700000
            assert funded.snapshot.expected_income == []
            assert funded.active_constitution_version is None
            original = session.get(FinancialStateRecord, "state-v1")
            assert original.payload["assets"][0]["amount_minor"] == 1200000
            assert digest(original.payload) == original.snapshot_hash
            stored = session.get(SimulationConfigRecord, selected.id)
            assert stored.config_digest == digest(selected)
        with sessions(engine).begin() as session:
            with pytest.raises(ValueError, match="new empty"):
                provision_funded_demo(session, selected)
    finally:
        engine.dispose()


def test_audit_failure_rolls_back_all_provisioning(tmp_path, selected, monkeypatch):
    from app.db.models import Base, User
    from app.db.session import make_engine, sessions
    from app.demo import provision as service
    engine = make_engine(f"sqlite:///{tmp_path / 'rollback.db'}")
    Base.metadata.create_all(engine)
    def fail(*args, **kwargs):
        raise ValueError("audit unavailable")
    monkeypatch.setattr(service, "append_event", fail)
    try:
        with pytest.raises(ValueError, match="audit unavailable"):
            with sessions(engine).begin() as session:
                provision_funded_demo(session, selected)
        with sessions(engine)() as session:
            assert not list(session.scalars(select(User)))
            assert not list(session.scalars(select(SimulationConfigRecord)))
            assert not list(session.scalars(select(FinancialStateRecord)))
    finally:
        engine.dispose()


def cli_module():
    import importlib.util
    from pathlib import Path
    spec = importlib.util.spec_from_file_location(
        "funded_cli", Path("scripts/provision_funded_demo.py")
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_cli_requires_exact_selection_and_never_overwrites(tmp_path, selected):
    module = cli_module()
    destination = tmp_path / "scenario.db"
    with pytest.raises(ValueError, match="digest confirmation"):
        module.provision(destination, selected, "0" * 64)
    assert not destination.exists()
    destination.write_bytes(b"original database")
    with pytest.raises(ValueError, match="already exists"):
        module.provision(destination, selected, module.selection_digest(selected))
    assert destination.read_bytes() == b"original database"


def test_cli_runs_real_migrations_and_publishes_private_database(tmp_path, selected):
    import os
    import stat

    from app.db.session import make_engine, sessions
    module = cli_module()
    destination = tmp_path / "scenario.db"
    prior_url = os.environ.get("DATABASE_URL")
    module.provision(destination, selected, module.selection_digest(selected))
    assert os.environ.get("DATABASE_URL") == prior_url
    if os.name != "nt":
        assert stat.S_IMODE(destination.stat().st_mode) == 0o600
    engine = make_engine(f"sqlite:///{destination}")
    try:
        with sessions(engine)() as session:
            current = read_state(session)
            assert current.snapshot.version == 2
            assert current.active_constitution_version is None
            assert session.get(SimulationConfigRecord, selected.id) is not None
    finally:
        engine.dispose()


@pytest.mark.parametrize("changes", [
    {"horizon_days": 119}, {"model_version": "unknown-model"},
    {"path_count": 100000}, {"model_assumptions": []},
])
def test_invalid_selection_publishes_no_database(tmp_path, selected, changes):
    module = cli_module()
    value = selected.model_copy(update=changes)
    destination = tmp_path / "scenario.db"
    with pytest.raises(ValueError):
        module.provision(destination, value, module.selection_digest(value))
    assert not destination.exists()
    assert not list(tmp_path.glob(".vallet-provision-*"))
