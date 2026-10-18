"""Run reset assertions against PG, adapting SQLite-only fixture/injection mechanics."""

from app.db.models import ExecutionRecord
from app.db.postgres import acquire_authority_lock
from test_pf_028 import *  # noqa: F403
from test_storage_contract import storage_claim as storage_claim


@pytest.fixture  # noqa: F405
def funded(pg_database):
    url, engine, factory = pg_database
    config = SimulationConfig(  # noqa: F405
        id="reset-isolated-selection",
        model_version="pf-monte-carlo-v1",
        path_count=100,
        daily_volatility_bps=0,
        income_delay_probability_bps=0,
        emergency_probability_bps=0,
        fee_minor=100,
        model_assumptions=["Synthetic isolated reset test; not approved runtime inputs."],
    )
    with factory.begin() as session:
        acquire_authority_lock(session)
        provision_funded_demo(session, config)  # noqa: F405
    return engine, factory, Settings(_env_file=None, database_url=url, demo_mode=True)  # noqa: F405


@pytest.fixture  # noqa: F405
def seeded(funded):
    # Reuse the explicit FK-complete storage fixture. Never disable PG constraints
    # to emulate the original SQLite test's deliberately incomplete history row.
    return funded[2].database_url, funded[0], funded[1]


@pytest.mark.parametrize("status", ["CLAIMED", "PENDING", "REORGED", "CONFIRMED", "FAILED"])  # noqa: F405
def test_any_execution_history_refuses_without_changing_any_state_or_audit(
    funded, storage_claim, status
):
    engine, factory, settings = funded
    with factory.begin() as session:
        session.get(ExecutionRecord, "claim-test").status = status
    before = capture(factory)  # noqa: F405
    with pytest.raises(DomainError) as error:  # noqa: F405
        service.reset_demo(engine, settings)  # noqa: F405
    assert error.value.status == 409 and "Execution history" in error.value.message
    assert capture(factory) == before  # noqa: F405
    with factory() as session:
        assert session.get(ExecutionRecord, "claim-test").status == status
